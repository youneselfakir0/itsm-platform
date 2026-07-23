import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { DbService } from './db.service';

@Injectable()
export class AuthService {
  constructor(private db: DbService, private jwt: JwtService) {}

  async register(email: string, password: string, displayName: string) {
    const role = await this.db.query(`SELECT id FROM auth.roles WHERE name='user'`);
    const hash = await bcrypt.hash(password, 10);
    try {
      const r = await this.db.query(
        `INSERT INTO auth.users_auth (email, password_hash, role_id)
         VALUES ($1,$2,$3) RETURNING id`,
        [email, hash, role.rows[0].id],
      );
      await this.db.query(
        `INSERT INTO users.users (id, email, display_name) VALUES ($1,$2,$3)`,
        [r.rows[0].id, email, displayName],
      );
      return { id: r.rows[0].id, email };
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('email already exists');
      throw e;
    }
  }

  async login(email: string, password: string) {
    const r = await this.db.query(
      `SELECT u.id, u.email, u.password_hash, u.is_active, ro.name AS role,
              COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
       FROM auth.users_auth u
       LEFT JOIN auth.roles ro ON ro.id = u.role_id
       LEFT JOIN auth.role_permissions rp ON rp.role_id = ro.id
       LEFT JOIN auth.permissions p ON p.id = rp.permission_id
       WHERE u.email = $1
       GROUP BY u.id, u.email, u.password_hash, u.is_active, ro.name`,
      [email],
    );
    const user = r.rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash ?? ''))) {
      throw new UnauthorizedException('invalid credentials');
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id, email: user.email, role: user.role, permissions: user.permissions,
    });
    const refreshToken = randomBytes(32).toString('hex');
    await this.db.query(
      `INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() + interval '7 days')`,
      [user.id, createHash('sha256').update(refreshToken).digest('hex')],
    );
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  }

  async refresh(refreshToken: string) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const r = await this.db.query(
      `SELECT rt.user_id, u.email, ro.name AS role,
              COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
       FROM auth.refresh_tokens rt
       JOIN auth.users_auth u ON u.id = rt.user_id
       LEFT JOIN auth.roles ro ON ro.id = u.role_id
       LEFT JOIN auth.role_permissions rp ON rp.role_id = ro.id
       LEFT JOIN auth.permissions p ON p.id = rp.permission_id
       WHERE rt.token_hash = $1 AND NOT rt.revoked AND rt.expires_at > now()
       GROUP BY rt.user_id, u.email, ro.name`,
      [hash],
    );
    if (!r.rows[0]) throw new UnauthorizedException('invalid refresh token');
    const u = r.rows[0];
    const accessToken = await this.jwt.signAsync({
      sub: u.user_id, email: u.email, role: u.role, permissions: u.permissions,
    });
    return { accessToken };
  }
}
