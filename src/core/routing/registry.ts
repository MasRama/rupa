import { GatewayIntentBits } from 'discord.js';
import type { Feature } from '@/core/feature';
import type { JobDefinition, TaskDefinition } from '@/core/jobs/definitions';
import type {
  CommandDefinition,
  ComponentDefinition,
  ComponentKind,
  EventDefinition,
  MenuCommandDefinition,
  MenuType,
} from './definitions';
import type { Guard } from './guards';

export interface RegisteredCommand {
  feature: string;
  definition: CommandDefinition;
  /** The feature's guards, then the command's own. */
  guards: readonly Guard[];
}

export interface RegisteredMenu<Type extends MenuType = MenuType> {
  feature: string;
  definition: MenuCommandDefinition<Type>;
  /** The feature's guards, then the menu's own. */
  guards: readonly Guard[];
}

/** Discord's limit per scope for each kind of right-click command. */
const MAX_MENUS = 5;

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

export interface RegisteredTask {
  feature: string;
  definition: TaskDefinition;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJob = JobDefinition<any>;

/** Everything the mounted features provide, indexed and checked for conflicts. */
export interface FeatureRegistry {
  readonly features: readonly Feature[];
  /** Slash commands by name. */
  readonly commands: ReadonlyMap<string, RegisteredCommand>;
  /** Right-click commands, in mount order. */
  readonly menus: readonly RegisteredMenu[];
  findMenu<Type extends MenuType>(type: Type, name: string): RegisteredMenu<Type> | null;
  readonly events: readonly RegisteredEvent[];
  readonly tasks: readonly RegisteredTask[];
  /** Name of the feature that mounts this job, or null. */
  jobOwner(job: AnyJob): string | null;
  findJob(feature: string, name: string): AnyJob | null;
  /** First component of `kind` whose route matches, in mount order. */
  findComponent(kind: ComponentKind, customId: string): MatchedComponent | null;
  /** `Guilds` plus every feature-declared intent, without duplicates. */
  intents(): GatewayIntentBits[];
}

export function createRegistry(features: readonly Feature[]): FeatureRegistry {
  const featureNames = new Set<string>();
  const commands = new Map<string, RegisteredCommand>();
  const menus: RegisteredMenu[] = [];
  const components: Omit<MatchedComponent, 'params'>[] = [];
  const componentOwners = new Map<string, string>();
  const events: RegisteredEvent[] = [];
  const tasks: RegisteredTask[] = [];
  const jobOwners = new Map<AnyJob, string>();
  const jobsByName = new Map<string, AnyJob>();

  for (const feature of features) {
    if (featureNames.has(feature.name)) {
      throw new Error(`Feature "${feature.name}" is mounted twice`);
    }
    featureNames.add(feature.name);

    for (const definition of feature.commands) {
      if (definition.type !== 'command') {
        const type = definition.type === 'user-command' ? 'user' : 'message';
        const owner = menus.find(
          menu =>
            menu.definition.type === definition.type &&
            menu.definition.data.name === definition.data.name,
        );
        if (owner) {
          const label = type === 'user' ? 'User' : 'Message';
          throw new Error(
            `${label} command "${definition.data.name}" is registered by both "${owner.feature}" and "${feature.name}"`,
          );
        }
        menus.push({
          feature: feature.name,
          definition,
          guards: [...feature.guards, ...(definition.guards ?? [])],
        });
        continue;
      }
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

    for (const definition of feature.jobs) {
      const owner = jobOwners.get(definition);
      if (owner) {
        throw new Error(
          `Job "${definition.name}" is mounted by both "${owner}" and "${feature.name}"`,
        );
      }
      const key = `${feature.name}/${definition.name}`;
      if (jobsByName.has(key)) {
        throw new Error(`Feature "${feature.name}" has two jobs named "${definition.name}"`);
      }
      jobOwners.set(definition, feature.name);
      jobsByName.set(key, definition);
    }

    const taskNames = new Set<string>();
    for (const definition of feature.tasks) {
      if (taskNames.has(definition.name)) {
        throw new Error(`Feature "${feature.name}" has two tasks named "${definition.name}"`);
      }
      taskNames.add(definition.name);
      tasks.push({ feature: feature.name, definition });
    }
  }

  for (const type of ['user', 'message'] as const) {
    const count = menus.filter(menu => menu.definition.type === `${type}-command`).length;
    if (count > MAX_MENUS) {
      throw new Error(`Discord allows at most ${MAX_MENUS} ${type} commands; found ${count}`);
    }
  }

  return {
    features,
    commands,
    menus,
    events,
    tasks,

    findMenu<Type extends MenuType>(type: Type, name: string) {
      const found = menus.find(
        menu => menu.definition.type === `${type}-command` && menu.definition.data.name === name,
      );
      return (found as RegisteredMenu<Type> | undefined) ?? null;
    },

    jobOwner: job => jobOwners.get(job) ?? null,
    findJob: (feature, name) => jobsByName.get(`${feature}/${name}`) ?? null,

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
