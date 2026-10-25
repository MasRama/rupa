import { GatewayIntentBits } from 'discord.js';
import type { Feature } from '@/core/feature';
import type {
  CommandDefinition,
  ComponentDefinition,
  ComponentKind,
  EventDefinition,
} from './definitions';
import type { Guard } from './guards';

export interface RegisteredCommand {
  feature: string;
  definition: CommandDefinition;
  /** The feature's guards, then the command's own. */
  guards: readonly Guard[];
}

export interface MatchedComponent {
  feature: string;
  definition: ComponentDefinition;
  params: Record<string, string>;
  /** The feature's guards, then the component's own. */
  guards: readonly Guard[];
}

export interface RegisteredEvent {
  feature: string;
  definition: EventDefinition;
}

/** Everything the mounted features provide, indexed and checked for conflicts. */
export interface FeatureRegistry {
  readonly features: readonly Feature[];
  readonly commands: ReadonlyMap<string, RegisteredCommand>;
  readonly events: readonly RegisteredEvent[];
  /** First component of `kind` whose route matches, in mount order. */
  findComponent(kind: ComponentKind, customId: string): MatchedComponent | null;
  /** `Guilds` plus every feature-declared intent, without duplicates. */
  intents(): GatewayIntentBits[];
}

export function createRegistry(features: readonly Feature[]): FeatureRegistry {
  const featureNames = new Set<string>();
  const commands = new Map<string, RegisteredCommand>();
  const components: Omit<MatchedComponent, 'params'>[] = [];
  const componentOwners = new Map<string, string>();
  const events: RegisteredEvent[] = [];

  for (const feature of features) {
    if (featureNames.has(feature.name)) {
      throw new Error(`Feature "${feature.name}" is mounted twice`);
    }
    featureNames.add(feature.name);

    for (const definition of feature.commands) {
      const name = definition.data.name;
      const owner = commands.get(name);
      if (owner) {
        throw new Error(
          `Command "/${name}" is registered by both "${owner.feature}" and "${feature.name}"`,
        );
      }
      commands.set(name, {
        feature: feature.name,
        definition,
        guards: [...feature.guards, ...(definition.guards ?? [])],
      });
    }

    for (const definition of feature.components) {
      const key = `${definition.kind} "${definition.route.pattern}"`;
      const owner = componentOwners.get(key);
      if (owner) {
        throw new Error(`Component ${key} is registered by both "${owner}" and "${feature.name}"`);
      }
      componentOwners.set(key, feature.name);
      components.push({
        feature: feature.name,
        definition,
        guards: [...feature.guards, ...definition.guards],
      });
    }

    for (const definition of feature.events) {
      events.push({ feature: feature.name, definition });
    }
  }

  return {
    features,
    commands,
    events,

    findComponent(kind, customId) {
      for (const entry of components) {
        if (entry.definition.kind !== kind) continue;
        const params = entry.definition.route.match(customId);
        if (params) return { ...entry, params };
      }
      return null;
    },

    intents() {
      const intents = new Set<GatewayIntentBits>([GatewayIntentBits.Guilds]);
      for (const feature of features) {
        for (const intent of feature.intents) intents.add(intent);
      }
      return [...intents];
    },
  };
}
