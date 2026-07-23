import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { LdapService } from './ldap.service';
import { MfaService } from './mfa.service';

@Module({ providers: [IdentityService, LdapService, MfaService], controllers: [IdentityController] })
export class IdentityModule {}
