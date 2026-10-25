import type { GatewayIntentBits } from 'discord.js';
import type { Migration } from '@/core/database';
import { CORE_SCHEMA_NAME } from '@/core/schema';
import type { Settings } from '@/core/settings';
import type { Guard } from '@/core/routing/guards';
import type { WebHook } from '@/core/web/types';
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
  /** Checks run before every command and component of this feature, before their own. */
  guards?: readonly Guard[];
  commands?: readonly CommandDefinition[];
  // `any` keeps each component's own pattern-typed params assignable here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components?: readonly ComponentDefinition<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events?: readonly EventDefinition<any>[];
  migrations?: readonly Migration[];
  /** Per-server settings, from `defineSettings`; editable in the dashboard. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: Settings<any>;
  /** Adds pages and routes to the dashboard (only runs when DASHBOARD_PORT is set). */
  web?: WebHook;
}

type ListKeys = 'intents' | 'guards' | 'commands' | 'components' | 'events' | 'migrations';

export type Feature = {
  readonly name: string;
} & {
  readonly [Key in ListKeys]-?: NonNullable<FeatureDefinition[Key]>;
} & {
  readonly settings: Settings | null;
  readonly web: WebHook | null;
};

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function defineFeature(definition: FeatureDefinition): Feature {
  if (!FEATURE_NAME.test(definition.name)) {
    throw new Error(`Feature name "${definition.name}" must be kebab-case, e.g. "server-stats"`);
  }
  if (definition.name === CORE_SCHEMA_NAME) {
    throw new Error(`Feature name "${CORE_SCHEMA_NAME}" is reserved for core tables`);
  }
  return Object.freeze({
    name: definition.name,
    intents: definition.intents ?? [],
    guards: definition.guards ?? [],
    commands: definition.commands ?? [],
    components: definition.components ?? [],
    events: definition.events ?? [],
    migrations: definition.migrations ?? [],
    settings: definition.settings ?? null,
    web: definition.web ?? null,
  });
}
