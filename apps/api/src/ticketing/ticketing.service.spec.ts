import { TicketingService } from './ticketing.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../core/prisma.service';

function makeNotifMock() {
  return {
    ticketCreated: jest.fn().mockResolvedValue(undefined),
    ticketEvent: jest.fn().mockResolvedValue({ ok: true, dry_run: false }),
  } as any;
}

describe('TicketingService events (Option C, piste 2)', () => {
  it('create déclenche ticketEvent event_type=created', async () => {
    const prisma = {
      tickets: { create: jest.fn().mockResolvedValue({ number: 1001, title: 'x', priority: 'p3', category: null }) },
    } as any;
    const notif = makeNotifMock();
    const svc = new TicketingService(prisma, undefined, notif);
    await svc.create({ sub: 'u1', permissions: [] } as any, { title: 'x' });
    expect(notif.ticketEvent).toHaveBeenCalledWith({ number: 1001, event_type: 'created' });
  });

  it("update avec status='resolved' déclenche ticketEvent event_type=resolved", async () => {
    const prisma = {
      tickets: {
        findUnique: jest.fn().mockResolvedValue({ id: '1', status: 'open' }),
        update: jest.fn().mockResolvedValue({ number: 1002, status: 'resolved' }),
      },
      ticket_history: { createMany: jest.fn().mockResolvedValue(undefined) },
    } as any;
    const notif = makeNotifMock();
    const svc = new TicketingService(prisma, undefined, notif);
    await svc.update({ sub: 'u1', permissions: [] } as any, '1', { status: 'resolved' });
    expect(notif.ticketEvent).toHaveBeenCalledWith({ number: 1002, event_type: 'resolved' });
  });

  it("update sans status='resolved' déclenche ticketEvent event_type=status_changed", async () => {
    const prisma = {
      tickets: {
        findUnique: jest.fn().mockResolvedValue({ id: '1', status: 'open' }),
        update: jest.fn().mockResolvedValue({ number: 1003, status: 'in_progress' }),
      },
      ticket_history: { createMany: jest.fn().mockResolvedValue(undefined) },
    } as any;
    const notif = makeNotifMock();
    const svc = new TicketingService(prisma, undefined, notif);
    await svc.update({ sub: 'u1', permissions: [] } as any, '1', { status: 'in_progress' });
    expect(notif.ticketEvent).toHaveBeenCalledWith({ number: 1003, event_type: 'status_changed' });
  });
});
