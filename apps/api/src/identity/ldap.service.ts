import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { PrismaService } from '../core/prisma.service';
import { randomUUID } from 'crypto';

const AD_URL = process.env.AD_URL || 'ldaps://192.168.0.20:636';
const AD_BASE = process.env.AD_BASE || 'DC=twisterlab,DC=local';
const AD_BIND = process.env.AD_BIND_DN || '';
const AD_BIND_PW = process.env.AD_BIND_PW || '';
// Mapping groupe AD -> rôle TwisterITSM
const GROUP_ROLE: Record<string, string> = {
  'CN=IT-Admin,OU=Groups,DC=twisterlab,DC=local': 'admin',
  'CN=Support,OU=Groups,DC=twisterlab,DC=local': 'agent',
};

@Injectable()
export class LdapService {
  private log = new Logger('LdapService');
  constructor(private prisma: PrismaService) {}

  private client(): Client {
    return new Client({ url: AD_URL, tlsOptions: { rejectUnauthorized: false } });
  }

  /** Tente un bind Simple avec un compte AD (authentification). */
  async bind(sam: string, password: string): Promise<{ dn: string } | null> {
    const c = this.client();
    try {
      await c.bind(AD_BIND, AD_BIND_PW);
      const res = await c.search(AD_BASE, {
        scope: 'sub',
        filter: `(sAMAccountName=${sam})`,
        attributes: ['distinguishedName'],
      });
      const entry = res.searchEntries[0];
      if (!entry) return null;
      const dn = String(entry.distinguishedName);
      await c.bind(dn, password); // bind de l'utilisateur = auth réussie
      return { dn };
    } catch (e: any) {
      if (e?.response?.resultCode === 49) return null; // invalid credentials
      this.log.warn(`LDAP injoignable pour ${sam}: ${e?.message ?? e}`);
      return null;
    } finally {
      await c.unbind().catch(() => {});
    }
  }

  /** Récupère le profil AD d'un sAMAccountName (groupes, displayName, mail). */
  async profile(sam: string): Promise<null | { dn: string; displayName: string; mail: string; roles: string[] }> {
    const c = this.client();
    try {
      await c.bind(AD_BIND, AD_BIND_PW);
      const res = await c.search(AD_BASE, {
        scope: 'sub',
        filter: `(sAMAccountName=${sam})`,
        attributes: ['distinguishedName', 'displayName', 'mail', 'memberOf', 'title', 'department'],
      });
      const e = res.searchEntries[0];
      if (!e) return null;
      const memberOf: string[] = Array.isArray(e.memberOf) ? e.memberOf as string[] : e.memberOf ? [String(e.memberOf)] : [];
      const roles = [...new Set(memberOf.map((g) => GROUP_ROLE[g]).filter(Boolean))];
      return {
        dn: String(e.distinguishedName),
        displayName: String(e.displayName ?? sam),
        mail: String(e.mail ?? `${sam}@twisterlab.local`),
        roles: roles.length ? roles : ['user'],
      };
    } catch (e: any) {
      this.log.warn(`profile AD échoué pour ${sam}: ${e?.message ?? e}`);
      return null;
    } finally {
      await c.unbind().catch(() => {});
    }
  }

  /** Provisionne/met à jour un utilisateur à partir du profil AD. */
  async upsertFromAd(sam: string, profile: { dn: string; displayName: string; mail: string; roles: string[] }) {
    const roleRow = await this.prisma.roles.findFirst({ where: { name: profile.roles[0] } }) ?? await this.prisma.roles.findUnique({ where: { name: 'user' } });
    const id = randomUUID();
    const email = profile.mail.toLowerCase();
    const existing = await this.prisma.users_auth.findUnique({ where: { email } });
    if (existing) {
      const updated = await this.prisma.users_auth.update({
        where: { email },
        data: { source: 'ldap', external_dn: profile.dn, role_id: roleRow?.id, last_synced_at: new Date() },
      });
      await this.prisma.users.upsert({ where: { id: existing.id }, create: { id: existing.id, email, display_name: profile.displayName }, update: { display_name: profile.displayName } });
      return updated;
    }
    return this.prisma.$transaction(async (tx) => {
      const auth = await tx.users_auth.create({ data: { id, email, source: 'ldap', external_dn: profile.dn, role_id: roleRow?.id, last_synced_at: new Date() } });
      await tx.users.create({ data: { id, email, display_name: profile.displayName } });
      return auth;
    });
  }

  /** Recherche les ordinateurs/serveurs AD (pour discovery CMDB). Résilient. */
  async searchComputers(): Promise<{ dnsHostName: string; cn: string; os: string; osVer: string }[]> {
    const c = this.client();
    try {
      await c.bind(AD_BIND, AD_BIND_PW);
      const res = await c.search(AD_BASE, {
        scope: 'sub',
        filter: '(objectClass=computer)',
        attributes: ['dNSHostName', 'cn', 'operatingSystem', 'operatingSystemVersion'],
      });
      return res.searchEntries.map((e) => ({
        dnsHostName: String((e as any).dNSHostName ?? ''),
        cn: String((e as any).cn ?? ''),
        os: String((e as any).operatingSystem ?? ''),
        osVer: String((e as any).operatingSystemVersion ?? ''),
      })).filter((x) => x.cn);
    } catch (e: any) {
      this.log.warn(`discovery AD échouée: ${e?.message ?? e}`);
      return []; // résilient: pas de crash
    } finally { await c.unbind().catch(() => {}); }
  }

  /** Synchronisation complète (tous les users AD -> TwisterITSM). */
  async syncAll(): Promise<{ synced: number; errors: string[] }> {
    const c = this.client();
    const errors: string[] = [];
    let synced = 0;
    try {
      await c.bind(AD_BIND, AD_BIND_PW);
      const res = await c.search(AD_BASE, {
        scope: 'sub',
        filter: '(&(objectClass=user)(sAMAccountName=*))',
        attributes: ['sAMAccountName', 'distinguishedName', 'displayName', 'mail', 'memberOf'],
      });
      for (const e of res.searchEntries) {
        const sam = String((e as any).sAMAccountName);
        try {
          const memberOf: string[] = Array.isArray((e as any).memberOf) ? ((e as any).memberOf as string[]) : (e as any).memberOf ? [String((e as any).memberOf)] : [];
          const roles = [...new Set(memberOf.map((g) => GROUP_ROLE[g]).filter(Boolean))];
          await this.upsertFromAd(sam, {
            dn: String((e as any).distinguishedName),
            displayName: String((e as any).displayName ?? sam),
            mail: String((e as any).mail ?? `${sam}@twisterlab.local`),
            roles: roles.length ? roles : ['user'],
          });
          synced++;
        } catch (err: any) { errors.push(`${sam}: ${err?.message ?? err}`); }
      }
    } catch (e: any) { errors.push(`connexion AD: ${e?.message ?? e}`); }
    finally { await c.unbind().catch(() => {}); }
    return { synced, errors };
  }
}
