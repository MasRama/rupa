import type { Database } from '@/core';

export interface NewTicket {
  guildId: string;
  /** The channel the panel is in; the ticket thread is made there. */
  channelId: string;
  openerId: string;
  subject: string;
}

export interface Ticket extends NewTicket {
  id: number;
  /** Null until the thread exists. */
  threadId: string | null;
  status: 'open' | 'closed';
  /** ISO timestamps. */
  createdAt: string;
  closedAt: string | null;
  /** Who closed it; null when the bot did or the thread was deleted. */
  closedBy: string | null;
}

interface TicketRow {
  id: number;
  guild_id: string;
  channel_id: string;
  thread_id: string | null;
  opener_id: string;
  subject: string;
  status: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
  closed_by: string | null;
}

const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  guildId: row.guild_id,
  channelId: row.channel_id,
  threadId: row.thread_id,
  openerId: row.opener_id,
  subject: row.subject,
  status: row.status,
  createdAt: row.created_at,
  closedAt: row.closed_at,
  closedBy: row.closed_by,
});

const COLUMNS =
  'id, guild_id, channel_id, thread_id, opener_id, subject, status, created_at, closed_at, closed_by';

export function createTicketRepository(db: Database) {
  const one = (sql: string, ...args: unknown[]) => {
    const row = db.prepare(`SELECT ${COLUMNS} FROM tickets_tickets WHERE ${sql}`).get(...args) as
      TicketRow | undefined;
    return row ? toTicket(row) : null;
  };

  return {
    /** Records a new open ticket and returns its number. */
    open(entry: NewTicket): number {
      const result = db
        .prepare(
          `INSERT INTO tickets_tickets (guild_id, channel_id, opener_id, subject)
           VALUES (?, ?, ?, ?)`,
        )
        .run(entry.guildId, entry.channelId, entry.openerId, entry.subject);
      return Number(result.lastInsertRowid);
    },

    setThread(id: number, threadId: string): void {
      db.prepare('UPDATE tickets_tickets SET thread_id = ? WHERE id = ?').run(threadId, id);
    },

    get: (id: number) => one('id = ?', id),

    findByThread: (threadId: string) => one('thread_id = ?', threadId),

    /** The user's open ticket in that server, if any. */
    findOpenByOpener: (guildId: string, openerId: string) =>
      one("guild_id = ? AND opener_id = ? AND status = 'open'", guildId, openerId),

    /** Every open ticket, oldest first. */
    listOpen(): Ticket[] {
      const rows = db
        .prepare(`SELECT ${COLUMNS} FROM tickets_tickets WHERE status = 'open' ORDER BY id`)
        .all() as TicketRow[];
      return rows.map(toTicket);
    },

    /** Marks an open ticket closed; false when it was already closed or does not exist. */
    close(id: number, closedBy: string | null): boolean {
      return (
        db
          .prepare(
            `UPDATE tickets_tickets
             SET status = 'closed', closed_by = ?, closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND status = 'open'`,
          )
          .run(closedBy, id).changes > 0
      );
    },

    /** Forgets a ticket whose thread could not be made. */
    remove(id: number): void {
      db.prepare('DELETE FROM tickets_tickets WHERE id = ?').run(id);
    },
  };
}
