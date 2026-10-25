import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '@/core/database';
import type { SessionUser } from './types';

export const SESSION_COOKIE = 'rupa_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionStore {
  /** Starts a session and returns the token for the cookie. */
  create(user: SessionUser): string;
  find(token: string): SessionUser | null;
  destroy(token: string): void;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Sessions keyed by the SHA-256 of a random token, so a leaked database holds no usable cookie. */
export function createSessionStore(db: Database): SessionStore {
  return {
    create(user) {
      const now = new Date();
      db.prepare('DELETE FROM rupa_sessions WHERE expires_at < ?').run(now.toISOString());
      const token = randomBytes(32).toString('base64url');
      db.prepare(
        `INSERT INTO rupa_sessions (id_hash, user_id, username, avatar, guild_ids, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        hash(token),
        user.id,
        user.username,
        user.avatar,
        JSON.stringify(user.guildIds),
        now.toISOString(),
        new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      );
      return token;
    },

    find(token) {
      const row = db
        .prepare(
          `SELECT user_id, username, avatar, guild_ids FROM rupa_sessions
           WHERE id_hash = ? AND expires_at > ?`,
        )
        .get(hash(token), new Date().toISOString()) as
        { user_id: string; username: string; avatar: string | null; guild_ids: string } | undefined;
      if (!row) return null;
      return {
        id: row.user_id,
        username: row.username,
        avatar: row.avatar,
        guildIds: JSON.parse(row.guild_ids) as string[],
      };
    },

    destroy(token) {
      db.prepare('DELETE FROM rupa_sessions WHERE id_hash = ?').run(hash(token));
    },
  };
}
