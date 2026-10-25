import {
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type RepliableInteraction,
} from 'discord.js';
import type { Database } from '@/core/database';
import type { Logger } from '@/core/logging';
import type { UsageKind, UsageRecorder } from '@/core/usage';
import type { ComponentKind, HandlerContext } from './definitions';
import type { FeatureRegistry } from './registry';

export interface RouterDeps {
  registry: FeatureRegistry;
  db: Database;
  logger: Logger;
  /** Records one usage event per handled interaction; omit to disable stats. */
  usage?: UsageRecorder;
}

const ERROR_MESSAGE = 'Something went wrong while handling that. The error has been logged.';
const STALE_MESSAGE = 'This interaction is no longer handled by the bot.';

function componentKind(interaction: Interaction): ComponentKind | null {
  if (interaction.isButton()) return 'button';
  if (interaction.isAnySelectMenu()) return 'select';
  if (interaction.isModalSubmit()) return 'modal';
  return null;
}

async function replyEphemeral(
  interaction: RepliableInteraction,
  content: string,
  logger: Logger,
): Promise<void> {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    // The interaction may have expired (3 s without a response) or been deleted.
    logger.error({ err: error }, 'Could not send the error reply');
  }
}

/** `/command`, plus the subcommand group and subcommand when present. */
export function commandTarget(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
): string {
  return [
    `/${interaction.commandName}`,
    interaction.options.getSubcommandGroup(false),
    interaction.options.getSubcommand(false),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Sends an interaction to the feature handler that owns it. Handler errors are
 * logged and answered with an ephemeral message; this function never rejects.
 */
export async function dispatchInteraction(
  interaction: Interaction,
  { registry, db, logger, usage }: RouterDeps,
): Promise<void> {
  const context = <Params>(feature: string, params: Params): HandlerContext<Params> => ({
    params,
    db,
    logger: logger.child({ feature }),
    client: interaction.client,
    registry,
    feature,
  });

  let target: string;
  let run: (() => Promise<void> | void) | null = null;
  // What to record once the handler settles; autocomplete stays null.
  let tracked: { feature: string; kind: UsageKind; target: string } | null = null;

  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    target = commandTarget(interaction);
    const registered = registry.commands.get(interaction.commandName);
    if (registered) {
      const ctx = context(registered.feature, {} as Record<string, never>);
      const { definition } = registered;
      if (interaction.isChatInputCommand()) {
        run = () => definition.execute(interaction, ctx);
        tracked = { feature: registered.feature, kind: 'command', target };
      } else if (definition.autocomplete) {
        const autocomplete = definition.autocomplete.bind(definition);
        run = () => autocomplete(interaction, ctx);
      } else {
        run = () => interaction.respond([]);
      }
    }
  } else {
    const kind = componentKind(interaction);
    if (!kind || !('customId' in interaction)) return;
    target = `${kind} ${interaction.customId}`;
    const match = registry.findComponent(kind, interaction.customId);
    if (match) {
      const ctx = context(match.feature, match.params as never);
      run = () => match.definition.handle(interaction as never, ctx);
      tracked = { feature: match.feature, kind, target: match.definition.route.pattern };
    }
  }

  if (!run) {
    logger.warn({ target, userId: interaction.user.id }, 'No handler for interaction');
    if (interaction.isRepliable()) await replyEphemeral(interaction, STALE_MESSAGE, logger);
    return;
  }

  const at = new Date();
  const startedAt = performance.now();
  let outcome: 'ok' | 'error' = 'ok';
  let durationMs: number;
  try {
    logger.debug(
      { target, userId: interaction.user.id, guildId: interaction.guildId },
      'Interaction',
    );
    await run();
    durationMs = performance.now() - startedAt;
  } catch (error) {
    durationMs = performance.now() - startedAt;
    outcome = 'error';
    logger.error({ err: error, target }, 'Interaction handler failed');
    if (interaction.isRepliable()) await replyEphemeral(interaction, ERROR_MESSAGE, logger);
  }

  if (usage && tracked) {
    try {
      usage.record({
        ...tracked,
        at,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        outcome,
        durationMs,
      });
    } catch (error) {
      logger.warn({ err: error, target }, 'Could not record usage');
    }
  }
}
