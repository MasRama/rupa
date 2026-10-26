import type { Database } from '@/core';

export interface NewPanel {
  guildId: string;
  channelId: string;
  title: string;
  description: string | null;
  /** Members may hold only one of the panel's roles. */
  single: boolean;
  createdBy: string;
  /** In the order they are shown. */
  roleIds: string[];
}

export interface Panel extends Omit<NewPanel, 'createdBy'> {
  id: number;
  /** Null until the panel message is posted. */
  messageId: string | null;
}

interface PanelRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  description: string | null;
  single: number;
}

export function createPanelRepository(db: Database) {
  return {
    /** Stores a panel and its roles; returns the panel's id. */
    create: db.transaction((panel: NewPanel): number => {
      const id = Number(
        db
          .prepare(
            `INSERT INTO roles_panels (guild_id, channel_id, title, description, single, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            panel.guildId,
            panel.channelId,
            panel.title,
            panel.description,
            panel.single ? 1 : 0,
            panel.createdBy,
          ).lastInsertRowid,
      );
      const addRole = db.prepare(
        'INSERT INTO roles_panel_roles (panel_id, role_id, position) VALUES (?, ?, ?)',
      );
      panel.roleIds.forEach((roleId, position) => addRole.run(id, roleId, position));
      return id;
    }),

    setMessage(id: number, messageId: string): void {
      db.prepare('UPDATE roles_panels SET message_id = ? WHERE id = ?').run(messageId, id);
    },

    get(id: number): Panel | null {
      const row = db
        .prepare(
          `SELECT id, guild_id, channel_id, message_id, title, description, single
           FROM roles_panels WHERE id = ?`,
        )
        .get(id) as PanelRow | undefined;
      if (!row) return null;
      const roles = db
        .prepare('SELECT role_id FROM roles_panel_roles WHERE panel_id = ? ORDER BY position')
        .all(id) as { role_id: string }[];
      return {
        id: row.id,
        guildId: row.guild_id,
        channelId: row.channel_id,
        messageId: row.message_id,
        title: row.title,
        description: row.description,
        single: row.single === 1,
        roleIds: roles.map(entry => entry.role_id),
      };
    },
  };
}
