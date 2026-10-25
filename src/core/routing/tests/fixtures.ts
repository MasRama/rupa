import { SlashCommandBuilder, type Interaction } from 'discord.js';
import { vi } from 'vitest';
import type { Logger } from '@/core/logging';

/** A logger whose calls can be asserted; child() returns the same stub. */
export function stubLogger() {
  const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: () => logger,
  };
  return logger as typeof logger & Logger;
}

export const slash = (name: string) =>
  new SlashCommandBuilder().setName(name).setDescription(`${name} command`);

type Kind = 'command' | 'autocomplete' | 'button' | 'select' | 'modal';

/**
 * Minimal stand-in for a discord.js interaction: the type guards the router
 * uses, reply state, and reply/followUp spies. Not a Discord simulation.
 */
export function stubInteraction(
  kind: Kind,
  key: string,
  options: { failReply?: boolean } = {},
) {
  const interaction = {
    client: { user: { id: 'bot' } },
    user: { id: 'user-1' },
    guildId: 'guild-1',
    commandName: kind === 'command' || kind === 'autocomplete' ? key : undefined,
    customId: kind === 'command' || kind === 'autocomplete' ? undefined : key,
    replied: false,
    deferred: false,
    responded: false,
    isChatInputCommand: () => kind === 'command',
    isAutocomplete: () => kind === 'autocomplete',
    isButton: () => kind === 'button',
    isAnySelectMenu: () => kind === 'select',
    isModalSubmit: () => kind === 'modal',
    isRepliable: () => kind !== 'autocomplete',
    reply: vi.fn(async () => {
      if (options.failReply) throw new Error('Unknown interaction');
      interaction.replied = true;
    }),
    deferReply: vi.fn(async () => {
      interaction.deferred = true;
    }),
    followUp: vi.fn(async () => undefined),
    respond: vi.fn(async () => {
      interaction.responded = true;
    }),
  };
  return interaction as typeof interaction & Interaction;
}
