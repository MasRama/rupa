import type { GatewayIntentBits } from 'discord.js';
import type { Migration } from '@/core/database';
import type {
  CommandDefinition,
  ComponentDefinition,
  EventDefinition,
} from '@/core/routing/definitions';

/**
 * One business capability: its commands, components, events and tables.
 * Mount it by adding it to `src/app/features.ts`.
 */
export interface FeatureDefinition {
  /** kebab-case, unique; also the namespace for its migrations. */
  name: string;
  /** Gateway intents this feature needs beyond `Guilds`. */
  intents?: readonly GatewayIntentBits[];
  commands?: readonly CommandDefinition[];
  // `any` keeps each component's own pattern-typed params assignable here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components?: readonly ComponentDefinition<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events?: readonly EventDefinition<any>[];
  migrations?: readonly Migration[];
}

export type Feature = { readonly [Key in keyof FeatureDefinition]-?: NonNullable<FeatureDefinition[Key]> };

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function defineFeature(definition: FeatureDefinition): Feature {
  if (!FEATURE_NAME.test(definition.name)) {
    throw new Error(`Feature name "${definition.name}" must be kebab-case, e.g. "server-stats"`);
  }
  return Object.freeze({
    name: definition.name,
    intents: definition.intents ?? [],
    commands: definition.commands ?? [],
    components: definition.components ?? [],
    events: definition.events ?? [],
    migrations: definition.migrations ?? [],
  });
}
