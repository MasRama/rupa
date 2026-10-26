import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
  SnowflakeUtil,
} from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { GuardContext, HandlerContext, JobContext } from '@/core';
import { migrate, openDatabase } from '@/core/database';
import { createJobScheduler } from '@/core/jobs';
import { createRegistry } from '@/core/routing/registry';
import { stubLogger } from '@/core/routing/tests/fixtures';
import { coreSchema } from '@/core/schema';
import { writeSettings } from '@/core/settings';
import { ticketCommand } from '../commands/ticket';
import { closeButton, closeConfirm, ticketManager } from '../components/close';
import { openButton, openForm } from '../components/open';
import { ticketThreadDeleted } from '../events';
import { tickets } from '../index';
import { createTicketRepository } from '../repository';
import { ticketSettings } from '../settings';
import { closeIdleTickets } from '../tasks';

const HOUR = 60 * 60 * 1000;

function world(settings: Record<string, unknown> = {}) {
  const db = openDatabase(':memory:');
  migrate(db, [coreSchema, tickets]);
  if (Object.keys(settings).length > 0) {
    writeSettings(db, ticketSettings, {
      feature: 'tickets',
      guildId: 'g1',
      values: settings,
      updatedBy: 'admin',
    });
  }
  const registry = createRegistry([tickets]);
  const thread = {
    id: 't1',
    isThread: () => true,
    lastMessageId: null as string | null,
    createdTimestamp: Date.now(),
    send: vi.fn(async (_message: unknown) => ({})),
    edit: vi.fn(async (_changes: unknown) => ({})),
    delete: vi.fn(async () => undefined),
    members: { add: vi.fn(async (_id: string) => undefined) },
  };
  const panelChannel = {
    id: 'c1',
    type: ChannelType.GuildText,
    send: vi.fn(async (_message: unknown) => ({})),
    threads: { create: vi.fn(async (_options: unknown) => thread) },
  };
  const logChannel = { id: '999', isSendable: () => true, send: vi.fn(async () => ({})) };
  const channels = new Map<string, unknown>([
    ['t1', thread],
    ['999', logChannel],
  ]);
  const guild = {
    id: 'g1',
    channels: { fetch: vi.fn(async (id: string) => channels.get(id) ?? null) },
  };
  const client = { guilds: { cache: new Map([['g1', guild]]) }, user: { id: 'bot' } };
  const ctx = {
    db,
    logger: stubLogger(),
    client,
    registry,
    feature: 'tickets',
    jobs: createJobScheduler(db, registry),
    params: {},
  } as unknown as HandlerContext;
  const repo = createTicketRepository(db);
  return { ctx, repo, thread, panelChannel, logChannel, channels };
}

function interaction(
  w: ReturnType<typeof world>,
  options: { userId?: string; roles?: string[]; permissions?: bigint[]; channelId?: string } = {},
) {
  const userId = options.userId ?? 'u1';
  return {
    guildId: 'g1',
    channelId: options.channelId ?? 'c1',
    channel: w.panelChannel,
    user: { id: userId, username: `name-${userId}` },
    member: { roles: { cache: new Map((options.roles ?? []).map(id => [id, {}])) } },
    memberPermissions: new PermissionsBitField(options.permissions ?? []),
    inCachedGuild: () => true,
    fields: { getTextInputValue: () => 'My order is missing' },
    message: { createdTimestamp: Date.now() },
    reply: vi.fn(async (_message: unknown) => undefined),
    deferReply: vi.fn(async (_options: unknown) => undefined),
    editReply: vi.fn(async (_message: unknown) => undefined),
    update: vi.fn(async (_message: unknown) => undefined),
    showModal: vi.fn(async (_modal: unknown) => undefined),
  };
}

describe('/ticket panel', () => {
  it('posts the panel with an Open ticket button in a text channel', async () => {
    const w = world();
    const i = Object.assign(interaction(w), {
      options: { getSubcommand: () => 'panel' },
    });
    await ticketCommand.execute(i as never, w.ctx);

    const posted = w.panelChannel.send.mock.calls[0]![0] as { components: { toJSON(): unknown }[] };
    expect(JSON.stringify(posted.components.map(row => row.toJSON()))).toContain('"tickets:open"');
    expect(i.reply).toHaveBeenCalledWith({
      content: 'Ticket panel posted.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

describe('opening a ticket', () => {
  it('asks what the user needs, unless they already have a ticket open', async () => {
    const w = world();
    const first = interaction(w);
    await openButton.handle(first as never, w.ctx as never);
    expect(first.showModal).toHaveBeenCalled();

    const id = w.repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'x' });
    w.repo.setThread(id, 't9');
    const again = interaction(w);
    await openButton.handle(again as never, w.ctx as never);
    expect(again.showModal).not.toHaveBeenCalled();
    expect(again.reply).toHaveBeenCalledWith({
      content: 'You already have an open ticket: <#t9>.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('makes a private thread, adds the user and mentions staff', async () => {
    const w = world({ staffRole: '555' });
    const i = interaction(w);
    await openForm.handle(i as never, w.ctx as never);

    expect(w.panelChannel.threads.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ticket-0001',
        type: ChannelType.PrivateThread,
        invitable: false,
      }),
    );
    expect(w.thread.members.add).toHaveBeenCalledWith('u1');
    expect(w.thread.send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<@u1> <@&555>',
        allowedMentions: { users: ['u1'], roles: ['555'] },
      }),
    );
    expect(w.repo.findByThread('t1')).toMatchObject({ id: 1, subject: 'My order is missing' });
    expect(i.editReply).toHaveBeenCalledWith('Your ticket is open: <#t1>.');
  });

  it('forgets the ticket when the thread cannot be made', async () => {
    const w = world();
    w.panelChannel.threads.create.mockRejectedValueOnce(new Error('Missing Permissions'));
    const i = interaction(w);
    await openForm.handle(i as never, w.ctx as never);
    expect(w.repo.get(1)).toBeNull();
    expect(i.editReply).toHaveBeenCalledWith(
      'I could not open a ticket here. Ask an admin to check my permissions.',
    );
  });
});

describe('a thread that could not be set up', () => {
  it('is deleted along with the ticket', async () => {
    const w = world();
    w.thread.send.mockRejectedValueOnce(new Error('Missing Permissions'));
    const i = interaction(w);
    await openForm.handle(i as never, w.ctx as never);
    expect(w.thread.delete).toHaveBeenCalled();
    expect(w.repo.get(1)).toBeNull();
  });
});

describe('closing a ticket', () => {
  const guardCtx = (w: ReturnType<typeof world>, params: Record<string, string>) =>
    ({ ...w.ctx, params, target: 'x' }) as unknown as GuardContext;

  function opened(w: ReturnType<typeof world>) {
    const id = w.repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'Help' });
    w.repo.setThread(id, 't1');
    return id;
  }

  it('lets the opener, staff and thread managers close it, and nobody else', async () => {
    const w = world({ staffRole: '555' });
    const id = String(opened(w));
    const check = (options: Parameters<typeof interaction>[1]) =>
      ticketManager(interaction(w, options) as never, guardCtx(w, { ticketId: id }));

    expect(await check({ userId: 'u1' })).toBeNull();
    expect(await check({ userId: 'u2', roles: ['555'] })).toBeNull();
    expect(
      await check({ userId: 'u2', permissions: [PermissionFlagsBits.ManageThreads] }),
    ).toBeNull();
    expect(await check({ userId: 'u2' })).toBe(
      'Only the person who opened this ticket or staff can close it.',
    );
  });

  it('finds the ticket from the thread for /ticket close', async () => {
    const w = world();
    opened(w);
    const inThread = interaction(w, { channelId: 't1' });
    expect(await ticketManager(inThread as never, guardCtx(w, {}))).toBeNull();
    const elsewhere = interaction(w, { channelId: 'c1' });
    expect(await ticketManager(elsewhere as never, guardCtx(w, {}))).toBe(
      'Use this inside an open ticket.',
    );
  });

  it('asks before closing', async () => {
    const w = world();
    const id = opened(w);
    const i = interaction(w);
    await closeButton.handle(i as never, { ...w.ctx, params: { ticketId: String(id) } } as never);
    const reply = i.reply.mock.calls[0]![0] as { content: string; components: unknown[] };
    expect(reply.content).toBe('Close this ticket?');
    expect(reply.components).toHaveLength(1);
  });

  it('closes, locks the thread and posts a summary to the log channel', async () => {
    const w = world({ logChannel: '999' });
    const id = opened(w);
    const i = interaction(w, { userId: 'staff' });
    await closeConfirm.handle(
      i as never,
      { ...w.ctx, params: { ticketId: String(id), choice: 'yes' } } as never,
    );

    expect(w.repo.get(id)).toMatchObject({ status: 'closed', closedBy: 'staff' });
    expect(i.update).toHaveBeenCalledWith({ content: 'Ticket closed.', components: [] });
    expect(w.thread.send).toHaveBeenCalledWith({
      content: 'Ticket closed by <@staff>.',
      allowedMentions: { parse: [] },
    });
    expect(w.thread.edit).toHaveBeenCalledWith({ locked: true, archived: true });
    expect(w.logChannel.send).toHaveBeenCalledWith({ embeds: [expect.anything()] });

    const again = interaction(w, { userId: 'staff' });
    await closeConfirm.handle(
      again as never,
      { ...w.ctx, params: { ticketId: String(id), choice: 'yes' } } as never,
    );
    expect(again.update).toHaveBeenCalledWith({
      content: 'This ticket is already closed.',
      components: [],
    });
    expect(w.thread.edit).toHaveBeenCalledOnce();
  });
});

describe('auto-close', () => {
  function jobCtx(w: ReturnType<typeof world>) {
    return { ...w.ctx, attempt: 1 } as unknown as JobContext;
  }

  it('closes tickets nobody wrote in for longer than the setting', async () => {
    const w = world({ autoCloseHours: 24 });
    const id = w.repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'x' });
    w.repo.setThread(id, 't1');
    w.thread.lastMessageId = SnowflakeUtil.generate({
      timestamp: Date.now() - 25 * HOUR,
    }).toString();

    await closeIdleTickets.run(jobCtx(w));
    expect(w.repo.get(id)).toMatchObject({ status: 'closed', closedBy: null });
    expect(w.thread.send).toHaveBeenCalledWith({
      content: 'Ticket closed: no activity for 24 hours.',
      allowedMentions: { parse: [] },
    });
  });

  it('leaves active tickets, and servers with auto-close off, alone', async () => {
    const w = world({ autoCloseHours: 24 });
    const id = w.repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'x' });
    w.repo.setThread(id, 't1');
    w.thread.lastMessageId = SnowflakeUtil.generate({ timestamp: Date.now() - HOUR }).toString();
    await closeIdleTickets.run(jobCtx(w));
    expect(w.repo.get(id)?.status).toBe('open');

    const off = world();
    const other = off.repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'x' });
    off.repo.setThread(other, 't1');
    off.thread.lastMessageId = SnowflakeUtil.generate({ timestamp: 0 }).toString();
    await closeIdleTickets.run(jobCtx(off));
    expect(off.repo.get(other)?.status).toBe('open');
  });

  it('marks a ticket closed when its thread is gone', async () => {
    const w = world({ autoCloseHours: 24 });
    const id = w.repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'x' });
    w.repo.setThread(id, 'gone');
    await closeIdleTickets.run(jobCtx(w));
    expect(w.repo.get(id)?.status).toBe('closed');
  });
});

describe('deleting a ticket thread', () => {
  it('closes the ticket', async () => {
    const w = world();
    const id = w.repo.open({ guildId: 'g1', channelId: 'c1', openerId: 'u1', subject: 'x' });
    w.repo.setThread(id, 't1');
    await ticketThreadDeleted.handle({ id: 't1' } as never, w.ctx);
    expect(w.repo.get(id)).toMatchObject({ status: 'closed', closedBy: null });
  });
});

describe('tickets feature', () => {
  it('mounts its commands, components, task and event', () => {
    expect(tickets.commands).toEqual([ticketCommand]);
    expect(tickets.components).toEqual([openButton, openForm, closeButton, closeConfirm]);
    expect(tickets.tasks).toEqual([closeIdleTickets]);
    expect(tickets.events).toEqual([ticketThreadDeleted]);
  });
});
