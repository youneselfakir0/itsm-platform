import { NotificationService } from './notification.service';

describe('NotificationService.ticketEvent', () => {
  let svc: NotificationService;
  beforeEach(() => {
    process.env.TEAMS_WEBHOOK = '';
    process.env.EVENTS_WEBHOOK_URL = '';
    process.env.EVENTS_WEBHOOK_SECRET = '';
    svc = new NotificationService();
  });

  it('dry-run si EVENTS_WEBHOOK_URL absent (retour ok/dry_run, pas de fetch)', async () => {
    const r = await svc.ticketEvent({ number: 1001, event_type: 'created' });
    expect(r.ok).toBe(true);
    expect(r.dry_run).toBe(true);
  });

  it("appelle le webhook avec payload {ticket_id,event_type} et header X-Events-Key", async () => {
    process.env.EVENTS_WEBHOOK_URL = 'http://localhost:9999/hook';
    process.env.EVENTS_WEBHOOK_SECRET = 'secret123';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;
    await svc.ticketEvent({ number: 1001, event_type: 'resolved' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:9999/hook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Events-Key': 'secret123' }),
        body: JSON.stringify({ ticket_id: '1001', event_type: 'resolved' }),
      }),
    );
  });

  it('ne throw jamais si le fetch échoue (best-effort)', async () => {
    process.env.EVENTS_WEBHOOK_URL = 'http://localhost:9999/hook';
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network down'));
    await expect(
      svc.ticketEvent({ number: 1, event_type: 'created' }),
    ).resolves.toEqual({ ok: false, dry_run: false });
  });
});
