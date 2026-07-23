import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../core/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { LdapService } from './ldap.service';
import { MfaService } from './mfa.service';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

@Injectable()
export class IdentityService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private ldap: LdapService,
    private mfa: MfaService,
  ) {}

  private async permsFor(roleId: string | null): Promise<{ role: string; permissions: string[] }> {
    if (!roleId) return { role: 'user', permissions: [] };
    const role = await this.prisma.roles.findUnique({
      where: { id: roleId },
      include: { role_permissions: { include: { permissions: true } } },
    });
    return {
      role: role?.name ?? 'user',
      permissions: role?.role_permissions.map((rp) => rp.permissions.code) ?? [],
    };
  }

  private sign(user: { id: string; email: string }, role: string, permissions: string[]) {
    const payload = { sub: user.id, email: user.email, role, permissions };
    return {
      accessToken: this.jwt.sign(payload, { secret: SECRET, expiresIn: '15m' }),
    };
  }

  /** Token court pour la 2e étape MFA. */
  private mfaChallenge(user: { id: string; email: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, aud: 'mfa' }, { secret: SECRET, expiresIn: '5m' });
  }

  private async issue(authId: string) {
    const auth = await this.prisma.users_auth.findUnique({ where: { id: authId } });
    const profile = await this.prisma.users.findUnique({ where: { id: authId } });
    const { role, permissions } = await this.permsFor(auth?.role_id ?? null);
    const refreshToken = randomUUID();
    await this.prisma.refresh_tokens.create({
      data: { user_id: authId, token_hash: await bcrypt.hash(refreshToken, 10), expires_at: new Date(Date.now() + 7 * 864e5) },
    });
    return {
      ...this.sign({ id: authId, email: auth!.email }, role, permissions),
      refreshToken,
      user: { id: authId, email: auth!.email, displayName: profile?.display_name, role },
    };
  }

  async register(dto: { email: string; password: string; displayName: string }) {
    const exists = await this.prisma.users_auth.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('email already registered');
    const userRole = await this.prisma.roles.findUnique({ where: { name: 'user' } });
    const hash = await bcrypt.hash(dto.password, 10);
    const id = randomUUID();
    await this.prisma.$transaction([
      this.prisma.users_auth.create({ data: { id, email: dto.email, password_hash: hash, role_id: userRole?.id, source: 'local' } }),
      this.prisma.users.create({ data: { id, email: dto.email, display_name: dto.displayName } }),
    ]);
    return { id, email: dto.email };
  }

  /** Login unifié : local d'abord, puis fallback LDAP (compte AD). */
  async login(dto: { email: string; password: string }) {
    const email = dto.email.toLowerCase();
    let auth = await this.prisma.users_auth.findUnique({ where: { email } });

    // 1) Auth locale
    if (auth?.password_hash && (await bcrypt.compare(dto.password, auth.password_hash))) {
      // OK
    }
    // 2) Fallback LDAP
    else {
      const sam = email.split('@')[0];
      const bind = await this.ldap.bind(sam, dto.password);
      if (bind) {
        const profile = await this.ldap.profile(sam);
        if (profile) auth = await this.ldap.upsertFromAd(sam, profile);
        else if (!auth) throw new UnauthorizedException('invalid credentials');
      } else if (!auth) {
        throw new UnauthorizedException('invalid credentials');
      } else {
        throw new UnauthorizedException('invalid credentials');
      }
    }

    // 3) MFA ?
    if (auth.mfa_enabled && auth.mfa_secret) {
      return { mfaRequired: true, mfaToken: this.mfaChallenge({ id: auth.id, email: auth.email }) };
    }
    return this.issue(auth.id);
  }

  /** 2e étape : vérification du code TOTP. */
  async verifyMfa(dto: { mfaToken: string; code: string }) {
    let payload: any;
    try { payload = this.jwt.verify(dto.mfaToken, { secret: SECRET, audience: 'mfa' }); }
    catch { throw new UnauthorizedException('mfa token expiré'); }
    const auth = await this.prisma.users_auth.findUnique({ where: { id: payload.sub } });
    if (!auth?.mfa_enabled || !auth.mfa_secret) throw new ForbiddenException('mfa non activé');
    if (!this.mfa.verify(dto.code, auth.mfa_secret)) throw new UnauthorizedException('code MFA invalide');
    return this.issue(auth.id);
  }

  /** Enrôlement MFA (génère secret + uri QR, stocke le secret en attente de confirmation). */
  async enrollMfa(user: { sub: string }) {
    const auth = await this.prisma.users_auth.findUnique({ where: { id: user.sub } });
    if (!auth) throw new UnauthorizedException();
    const { secret, uri } = this.mfa.enroll(auth.email);
    this.pendingSecret.set(user.sub, secret);
    return { secret, uri };
  }

  /** Confirme l'enrôlement en vérifiant un premier code. */
  async confirmMfa(user: { sub: string }, dto: { code: string }) {
    const auth = await this.prisma.users_auth.findUnique({ where: { id: user.sub } });
    if (!auth) throw new UnauthorizedException();
    const pending = this.pendingSecret.get(user.sub);
    if (!pending) throw new ForbiddenException('relance enroll d\'abord');
    if (!this.mfa.verify(dto.code, pending)) throw new UnauthorizedException('code MFA invalide');
    await this.prisma.users_auth.update({ where: { id: user.sub }, data: { mfa_secret: pending, mfa_enabled: true } });
    this.pendingSecret.delete(user.sub);
    return { enabled: true };
  }

  private pendingSecret = new Map<string, string>();

  async refresh(dto: { refreshToken: string }) {
    const rows = await this.prisma.refresh_tokens.findMany({
      where: { revoked: false, expires_at: { gt: new Date() } }, orderBy: { created_at: 'desc' }, take: 200,
    });
    let match: (typeof rows)[number] | undefined;
    for (const r of rows) { if (await bcrypt.compare(dto.refreshToken, r.token_hash)) { match = r; break; } }
    if (!match) throw new UnauthorizedException('invalid refresh token');
    return this.issue(match.user_id);
  }

  async syncAd() {
    return this.ldap.syncAll();
  }
}
