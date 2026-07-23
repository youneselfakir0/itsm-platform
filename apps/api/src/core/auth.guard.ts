import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, SetMetadata, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export interface JwtUser { sub: string; email: string; role: string; permissions: string[]; }

export const Public = () => SetMetadata('isPublic', true);
export const Permissions = (...perms: string[]) => SetMetadata('perms', perms);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('missing token');
    try {
      req.user = this.jwt.verify<JwtUser>(token, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
    } catch {
      throw new UnauthorizedException('invalid token');
    }

    const perms = this.reflector.getAllAndOverride<string[]>('perms', [ctx.getHandler(), ctx.getClass()]);
    if (perms?.length) {
      const held: string[] = req.user.permissions || [];
      const ok = held.includes('admin:*') || perms.every((p) => held.includes(p));
      if (!ok) throw new ForbiddenException(`missing permission ${perms.join(',')}`);
    }
    return true;
  }
}
