import type {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import type { Database } from '@/core/database';
import type { JobScheduler } from '@/core/jobs/scheduler';
import type { Logger } from '@/core/logging';
import { compilePattern, type CompiledPattern, type RouteParams } from './pattern';
import type { Guard } from './guards';
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
  /** Schedules and cancels jobs; see docs/jobs.md. */
  jobs: JobScheduler;
}

/** Any slash command builder (with or without options or subcommands). */
export interface CommandData {
  readonly name: string;
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

export interface CommandDefinition {
  readonly type: 'command';
  readonly data: CommandData;
  /** Checks run before `execute`, after the feature's own guards. */
  readonly guards?: readonly Guard[];
  execute(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Awaitable<void>;
  autocomplete?(interaction: AutocompleteInteraction, ctx: HandlerContext): Awaitable<void>;
}

export function command(definition: Omit<CommandDefinition, 'type'>): CommandDefinition {
  return { type: 'command', ...definition };
}

/** A `ContextMenuCommandBuilder`; its type is set by `userCommand` or `messageCommand`. */
export interface MenuData {
  readonly name: string;
  toJSON(): RESTPostAPIContextMenuApplicationCommandsJSONBody;
}

interface MenuInteractions {
  user: UserContextMenuCommandInteraction;
  message: MessageContextMenuCommandInteraction;
}

export type MenuType = keyof MenuInteractions;

/** A right-click command, shown under Apps when right-clicking a user or a message. */
export interface MenuCommandDefinition<Type extends MenuType = MenuType> {
  readonly type: `${Type}-command`;
  readonly data: MenuData;
  /** Checks run before `execute`, after the feature's own guards. */
  readonly guards?: readonly Guard[];
  execute(interaction: MenuInteractions[Type], ctx: HandlerContext): Awaitable<void>;
}

export type UserCommandDefinition = MenuCommandDefinition<'user'>;
export type MessageCommandDefinition = MenuCommandDefinition<'message'>;

/** Anything a feature can list in `commands`. */
export type AnyCommandDefinition =
  CommandDefinition | UserCommandDefinition | MessageCommandDefinition;

/** Right-click a user → Apps → this command. `interaction.targetUser` is who was clicked. */
export function userCommand(
  definition: Omit<UserCommandDefinition, 'type'>,
): UserCommandDefinition {
  return { type: 'user-command', ...definition };
}

/** Right-click a message → Apps → this command. `interaction.targetMessage` is the message. */
export function messageCommand(
  definition: Omit<MessageCommandDefinition, 'type'>,
): MessageCommandDefinition {
  return { type: 'message-command', ...definition };
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
  /** Checks run before `handle`, after the feature's own guards. */
  readonly guards: readonly Guard[];
  handle(
    interaction: ComponentInteractions[Kind],
    ctx: HandlerContext<RouteParams<Pattern>>,
  ): Awaitable<void>;
  /** Builds the custom id for this route, e.g. `confirm.id({ userId })`. */
  id(...args: IdArgs<Pattern>): string;
}

export interface ComponentOptions {
  guards?: readonly Guard[];
}

function component<Kind extends ComponentKind, Pattern extends string>(
  kind: Kind,
  pattern: Pattern,
  handle: ComponentDefinition<Kind, Pattern>['handle'],
  options: ComponentOptions,
): ComponentDefinition<Kind, Pattern> {
  const route = compilePattern(pattern);
  return {
    type: 'component',
    kind,
    route,
    guards: options.guards ?? [],
    handle,
    id: (...args) => route.build((args[0] ?? {}) as RouteParams<Pattern>),
  };
}

export const button = <Pattern extends string>(
  pattern: Pattern,
  handle: ComponentDefinition<'button', Pattern>['handle'],
  options: ComponentOptions = {},
) => component('button', pattern, handle, options);

/** Any select menu: string, user, role, mentionable or channel. */
export const select = <Pattern extends string>(
  pattern: Pattern,
  handle: ComponentDefinition<'select', Pattern>['handle'],
  options: ComponentOptions = {},
) => component('select', pattern, handle, options);

export const modal = <Pattern extends string>(
  pattern: Pattern,
  handle: ComponentDefinition<'modal', Pattern>['handle'],
  options: ComponentOptions = {},
) => component('modal', pattern, handle, options);

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
