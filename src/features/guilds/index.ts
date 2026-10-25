import { defineFeature } from '@/core';
import { guildJoined, guildLeft, syncOnReady } from './events/membership';
import { migrations } from './migrations';

export { createGuildRepository, type TrackedGuild } from './repository';

/** Keeps a table of the servers the bot is in. */
export const guilds = defineFeature({
  name: 'guilds',
  events: [syncOnReady, guildJoined, guildLeft],
  migrations,
});
