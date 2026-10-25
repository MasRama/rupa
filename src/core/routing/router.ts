import { MessageFlags, type Interaction, type RepliableInteraction } from 'discord.js';
import type { Database } from '@/core/database';
import type { Logger } from '@/core/logging';
import type { ComponentKind, HandlerContext } from './definitions';
import type { FeatureRegistry } from './registry';

export interface RouterDeps {
  registry: FeatureRegistry;
  db: Database;
  logger: Logger;
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

/**
 * Sends an interaction to the feature handler that owns it. Handler errors are
 * logged and answered with an ephemeral message; this function never rejects.
 */
export async function dispatchInteraction(
  interaction: Interaction,
  { registry, db, logger }: RouterDeps,
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

  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    target = `/${interaction.commandName}`;
    const registered = registry.commands.get(interaction.commandName);
    if (registered) {
      const ctx = context(registered.feature, {} as Record<string, never>);
      const { definition } = registered;
      if (interaction.isChatInputCommand()) {
        run = () => definition.execute(interaction, ctx);
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
    }
  }

  if (!run) {
    logger.warn({ target, userId: interaction.user.id }, 'No handler for interaction');
    if (interaction.isRepliable()) await replyEphemeral(interaction, STALE_MESSAGE, logger);
    return;
  }

  try {
    logger.debug({ target, userId: interaction.user.id, guildId: interaction.guildId }, 'Interaction');
    await run();
  } catch (error) {
    logger.error({ err: error, target }, 'Interaction handler failed');
    if (interaction.isRepliable()) await replyEphemeral(interaction, ERROR_MESSAGE, logger);
  }
}
