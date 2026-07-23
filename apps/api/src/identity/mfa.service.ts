import { Injectable } from '@nestjs/common';
import { authenticator } from '@otplib/preset-default';

@Injectable()
export class MfaService {
  /** Génère un secret + uri otpauth (pour QR). */
  enroll(email: string) {
    const secret = authenticator.generateSecret();
    const uri = authenticator.keyuri(email, 'TwisterITSM', secret);
    return { secret, uri };
  }

  verify(token: string, secret: string): boolean {
    try { return authenticator.verify({ token: token.replace(/\s/g, ''), secret }); }
    catch { return false; }
  }
}
