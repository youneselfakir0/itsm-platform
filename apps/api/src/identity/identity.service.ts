import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../core/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

@Injectable()
export class IdentityService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

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
      accessToken: this.jwt.sign(payload, { secret: process.env.JWT_SECRET || 'dev-secret-change-me', expiresIn: '15m' }),
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

  async login(dto: { email: string; password: string }) {
    const auth = await this.prisma.users_auth.findUnique({ where: { email: dto.email } });
    if (!auth?.password_hash || !(await bcrypt.compare(dto.password, auth.password_hash))) {
      throw new UnauthorizedException('invalid credentials');
    }
    const profile = await this.prisma.users.findUnique({ where: { id: auth.id } });
    const { role, permissions } = await this.permsFor(auth.role_id);
    const refreshToken = randomUUID();
    await this.prisma.refresh_tokens.create({
      data: { user_id: auth.id, token_hash: await bcrypt.hash(refreshToken, 10), expires_at: new Date(Date.now() + 7 * 864e5) },
    });
    return {
      ...this.sign(auth, role, permissions),
      refreshToken,
      user: { id: auth.id, email: auth.email, displayName: profile?.display_name, role },
    };
  }

  async refresh(dto: { refreshToken: string }) {
    const rows = await this.prisma.refresh_tokens.findMany({
      where: { revoked: false, expires_at: { gt: new Date() } }, orderBy: { created_at: 'desc' }, take: 200,
    });
    let match: (typeof rows)[number] | undefined;
    for (const r of rows) { if (await bcrypt.compare(dto.refreshToken, r.token_hash)) { match = r; break; } }
    if (!match) throw new UnauthorizedException('invalid refresh token');
    const auth = await this.prisma.users_auth.findUnique({ where: { id: match.user_id } });
    if (!auth) throw new UnauthorizedException('invalid refresh token');
    const { role, permissions } = await this.permsFor(auth.role_id);
    return this.sign(auth, role, permissions);
  }
}
