export type TicketType = 'incident' | 'request' | 'problem' | 'change';
export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed' | 'cancelled';
export type TicketPriority = 'p1' | 'p2' | 'p3' | 'p4';
export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    permissions: string[];
    iat?: number;
    exp?: number;
}
export interface TicketCreatedEvent {
    event: 'ticket.created';
    ticketId: string;
    number: number;
    type: TicketType;
    title: string;
    priority: TicketPriority;
    requesterId: string;
    at: string;
}
export interface TicketUpdatedEvent {
    event: 'ticket.updated';
    ticketId: string;
    changes: Record<string, {
        old: unknown;
        new: unknown;
    }>;
    at: string;
}
export type DomainEvent = TicketCreatedEvent | TicketUpdatedEvent;
