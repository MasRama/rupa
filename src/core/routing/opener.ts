import { MessageFlags, type ButtonInteraction } from 'discord.js';
import type { Guard } from './guards';

/**
 * On a public message, only the user who ran the original command may use its
 * buttons; everyone else gets `refusal`. Ephemeral messages are only visible
 * to that user anyway.
 */
export function onlyOpener(refusal: string): Guard {
  return interaction => {
    const { message } = interaction as ButtonInteraction;
    if (!message || message.flags.has(MessageFlags.Ephemeral)) return null;
    const openerId = message.interactionMetadata?.user.id;
    return openerId && openerId !== interaction.user.id ? refusal : null;
  };
}
