import { MfaService } from './mfa.service';

describe('MfaService (TOTP)', () => {
  const svc = new MfaService();

  it('génère un secret et une uri otpauth valides à l\'enrôlement', () => {
    const { secret, uri } = svc.enroll('ops@twisterlab.local');
    expect(secret).toBeTruthy();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('TwisterITSM');
    expect(uri).toContain(encodeURIComponent('ops@twisterlab.local'));
  });

  it('vérifie un code TOTP valide pour le secret donné', () => {
    const { secret } = svc.enroll('ops@twisterlab.local');
    const token = require('@otplib/preset-default').authenticator.generate(secret);
    expect(svc.verify(token, secret)).toBe(true);
  });

  it('rejette un code invalide', () => {
    const { secret } = svc.enroll('ops@twisterlab.local');
    expect(svc.verify('000000', secret)).toBe(false);
  });

  it('rejette un code vide / mal formé sans planter', () => {
    const { secret } = svc.enroll('ops@twisterlab.local');
    expect(svc.verify('', secret)).toBe(false);
    expect(svc.verify('abcd', secret)).toBe(false);
  });

  it('tolère les espaces dans le code soumis', () => {
    const { secret } = svc.enroll('ops@twisterlab.local');
    const token = require('@otplib/preset-default').authenticator.generate(secret);
    expect(svc.verify(`${token} `, secret)).toBe(true);
  });
});
