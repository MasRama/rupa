import { GatewayIntentBits } from 'discord.js';
import type { Feature } from '@/core/feature';
import type {
  CommandDefinition,
  ComponentDefinition,
  ComponentKind,
  EventDefinition,
} from './definitions';

export interface RegisteredCommand {
  feature: string;
  definition: CommandDefinition;
}

export interface MatchedComponent {
  feature: string;
  definition: ComponentDefinition;
  params: Record<string, string>;
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
  const components: { feature: string; definition: ComponentDefinition }[] = [];
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
      commands.set(name, { feature: feature.name, definition });
    }

    for (const definition of feature.components) {
      const key = `${definition.kind} "${definition.route.pattern}"`;
      const owner = componentOwners.get(key);
      if (owner) {
        throw new Error(`Component ${key} is registered by both "${owner}" and "${feature.name}"`);
      }
      componentOwners.set(key, feature.name);
      components.push({ feature: feature.name, definition });
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
      for (const { feature, definition } of components) {
        if (definition.kind !== kind) continue;
        const params = definition.route.match(customId);
        if (params) return { feature, definition, params };
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
