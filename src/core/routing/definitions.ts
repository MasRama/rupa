import type {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { Database } from '@/core/database';
import type { Logger } from '@/core/logging';
import { compilePattern, type CompiledPattern, type RouteParams } from './pattern';
import type { FeatureRegistry } from './registry';

type Awaitable<T> = T | Promise<T>;

/** What every handler receives next to the interaction or event arguments. */
export interface HandlerContext<Params = Record<string, never>> {
  /** Values captured from the component's custom id route. */
  params: Params;
  db: Database;
  /** Child logger tagged with the feature name. */
  logger: Logger;
  client: Client;
  registry: FeatureRegistry;
  /** Name of the feature that owns the handler. */
  feature: string;
}

/** Any slash command builder (with or without options or subcommands). */
export interface CommandData {
  readonly name: string;
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

export interface CommandDefinition {
  readonly type: 'command';
  readonly data: CommandData;
  execute(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Awaitable<void>;
  autocomplete?(interaction: AutocompleteInteraction, ctx: HandlerContext): Awaitable<void>;
}

export function command(definition: Omit<CommandDefinition, 'type'>): CommandDefinition {
  return { type: 'command', ...definition };
}

interface ComponentInteractions {
  button: ButtonInteraction;
  select: AnySelectMenuInteraction;
  modal: ModalSubmitInteraction;
}

export type ComponentKind = keyof ComponentInteractions;

type IdArgs<Pattern extends string> = [keyof RouteParams<Pattern>] extends [never]
  ? []
  : [params: RouteParams<Pattern>];

export interface ComponentDefinition<
  Kind extends ComponentKind = ComponentKind,
  Pattern extends string = string,
> {
  readonly type: 'component';
  readonly kind: Kind;
  readonly route: CompiledPattern<Pattern>;
  handle(
    interaction: ComponentInteractions[Kind],
    ctx: HandlerContext<RouteParams<Pattern>>,
  ): Awaitable<void>;
  /** Builds the custom id for this route, e.g. `confirm.id({ userId })`. */
  id(...args: IdArgs<Pattern>): string;
}

function component<Kind extends ComponentKind, Pattern extends string>(
  kind: Kind,
  pattern: Pattern,
  handle: ComponentDefinition<Kind, Pattern>['handle'],
): ComponentDefinition<Kind, Pattern> {
  const route = compilePattern(pattern);
  return {
    type: 'component',
    kind,
    route,
    handle,
    id: (...args) => route.build((args[0] ?? {}) as RouteParams<Pattern>),
  };
}

export const button = <Pattern extends string>(
  pattern: Pattern,
  handle: ComponentDefinition<'button', Pattern>['handle'],
) => component('button', pattern, handle);

/** Any select menu: string, user, role, mentionable or channel. */
export const select = <Pattern extends string>(
  pattern: Pattern,
  handle: ComponentDefinition<'select', Pattern>['handle'],
) => component('select', pattern, handle);

export const modal = <Pattern extends string>(
  pattern: Pattern,
  handle: ComponentDefinition<'modal', Pattern>['handle'],
) => component('modal', pattern, handle);

export interface EventDefinition<Name extends keyof ClientEvents = keyof ClientEvents> {
  readonly type: 'event';
  readonly name: Name;
  readonly once: boolean;
  handle(...args: [...ClientEvents[Name], HandlerContext]): Awaitable<void>;
}

/** Gateway event handler; the context comes after the event's own arguments. */
export function event<Name extends keyof ClientEvents>(
  name: Name,
  handle: (...args: [...ClientEvents[Name], HandlerContext]) => Awaitable<void>,
  options: { once?: boolean } = {},
): EventDefinition<Name> {
  return { type: 'event', name, once: options.once ?? false, handle };
}
