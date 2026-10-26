import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { coreSchema } from '@/core/schema';
import { tickets } from '../index';
import { canManageTicket, isIdle, threadName, ticketLogEmbed } from '../logic';
import { createTicketRepository } from '../repository';

function repository() {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema, tickets]);
  return createTicketRepository(db);
}

const HOUR = 60 * 60 * 1000;

describe('ticket repository', () => {
  it('opens a ticket, links its thread and finds it by opener or thread', () => {
    const repo = repository();
    const id = repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'Help' });
    expect(repo.findOpenByOpener('g1', 'u1')).toMatchObject({ id, threadId: null });

    repo.setThread(id, 't1');
    expect(repo.findByThread('t1')).toMatchObject({
      id,
      guildId: 'g1',
      channelId: 'c1',
      threadId: 't1',
      openerId: 'u1',
      subject: 'Help',
      status: 'open',
      closedAt: null,
      closedBy: null,
    });
    expect(repo.findOpenByOpener('g1', 'u2')).toBeNull();
    expect(repo.findOpenByOpener('g2', 'u1')).toBeNull();
  });

  it('closes a ticket once and remembers who closed it', () => {
    const repo = repository();
    const id = repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'Help' });
    expect(repo.close(id, 'staff')).toBe(true);
    expect(repo.close(id, 'someone-else')).toBe(false);
    expect(repo.get(id)).toMatchObject({ status: 'closed', closedBy: 'staff' });
    expect(repo.get(id)?.closedAt).toEqual(expect.any(String));
    expect(repo.findOpenByOpener('g1', 'u1')).toBeNull();
  });

  it('lists open tickets and forgets one whose thread could not be made', () => {
    const repo = repository();
    const a = repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'a' });
    const b = repo.open({ guildId: 'g2', channelId: 'c2', openerId: 'u2', subject: 'b' });
    repo.close(b, null);
    expect(repo.listOpen().map(ticket => ticket.id)).toEqual([a]);
    repo.remove(a);
    expect(repo.get(a)).toBeNull();
  });
});

describe('canManageTicket', () => {
  const base = {
    userId: 'u1',
    openerId: 'u1',
    roleIds: [],
    staffRoleId: null,
    manageThreads: false,
  };

  it('lets the opener, staff and thread managers close a ticket', () => {
    expect(canManageTicket(base)).toBe(true);
    expect(
      canManageTicket({ ...base, userId: 'u2', roleIds: ['staff'], staffRoleId: 'staff' }),
    ).toBe(true);
    expect(canManageTicket({ ...base, userId: 'u2', manageThreads: true })).toBe(true);
  });

  it('refuses anyone else', () => {
    expect(canManageTicket({ ...base, userId: 'u2', roleIds: ['staff'] })).toBe(false);
    expect(canManageTicket({ ...base, userId: 'u2', roleIds: ['x'], staffRoleId: 'staff' })).toBe(
      false,
    );
  });
});

describe('isIdle', () => {
  it('is idle once the last activity is older than the limit', () => {
    const now = Date.parse('2026-10-26T12:00:00Z');
    expect(isIdle(now - 25 * HOUR, now, 24)).toBe(true);
    expect(isIdle(now - 24 * HOUR, now, 24)).toBe(true);
    expect(isIdle(now - 23 * HOUR, now, 24)).toBe(false);
  });

  it('never closes when auto-close is off', () => {
    expect(isIdle(0, Date.now(), 0)).toBe(false);
  });
});

describe('threadName', () => {
  it('pads the ticket number', () => {
    expect(threadName(7)).toBe('ticket-0007');
    expect(threadName(12345)).toBe('ticket-12345');
  });
});

describe('ticketLogEmbed', () => {
  it('summarises who opened and closed the ticket and for how long', () => {
    const embed = ticketLogEmbed({
      ticket: {
        id: 7,
        openerId: 'u1',
        threadId: 't1',
        subject: 'My order is missing',
        createdAt: '2026-10-26T10:00:00.000Z',
      },
      closedBy: 'staff',
      reason: null,
      closedAt: new Date('2026-10-26T12:30:00Z'),
    }).toJSON();

    expect(embed.title).toBe('Ticket #7 closed');
    expect(embed.fields).toEqual([
      { name: 'Opened by', value: '<@u1>', inline: true },
      { name: 'Closed by', value: '<@staff>', inline: true },
      { name: 'Open for', value: '2h 30m', inline: true },
      { name: 'Subject', value: 'My order is missing' },
      { name: 'Thread', value: '<#t1>' },
    ]);
  });

  it('says why the bot closed it', () => {
    const embed = ticketLogEmbed({
      ticket: {
        id: 8,
        openerId: 'u1',
        threadId: null,
        subject: 'x',
        createdAt: '2026-10-26T10:00:00.000Z',
      },
      closedBy: null,
      reason: 'No activity for 24 hours',
      closedAt: new Date('2026-10-27T10:00:00Z'),
    }).toJSON();
    expect(embed.fields).toContainEqual({ name: 'Closed by', value: 'Auto-close', inline: true });
    expect(embed.fields).toContainEqual({ name: 'Reason', value: 'No activity for 24 hours' });
    expect(embed.fields?.map(field => field.name)).not.toContain('Thread');
  });
});
