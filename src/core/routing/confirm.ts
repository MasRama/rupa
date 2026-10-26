import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js';
import { parseDuration } from '@/core/time';
import { button, type ComponentDefinition, type HandlerContext } from './definitions';
import type { Guard } from './guards';
import { onlyOpener } from './opener';
import type { RouteParams } from './pattern';

type Awaitable<T> = T | Promise<T>;

type Answer<Pattern extends string> = (
  interaction: ButtonInteraction,
  ctx: HandlerContext<RouteParams<Pattern>>,
) => Awaitable<void>;

export interface ConfirmOptions<Pattern extends string> {
  /** Runs when the confirm button is clicked; `ctx.params` holds the route's params. */
  onConfirm: Answer<Pattern>;
  /** Runs when cancel is clicked. By default the message is replaced with `cancelled`. */
  onCancel?: Answer<Pattern>;
  /** Label of the confirm button. Default "Confirm". */
  confirmLabel?: string;
  /** Label of the cancel button. Default "Cancel". */
  cancelLabel?: string;
  /** Style of the confirm button. Default `ButtonStyle.Danger`. */
  style?: ButtonStyle.Primary | ButtonStyle.Success | ButtonStyle.Danger;
  /** What the message says after cancelling, unless `onCancel` is given. Default "Cancelled.". */
  cancelled?: string;
  /** How long the buttons answer after the message was sent, e.g. `'15m'` (the default). */
  expiresAfter?: string;
  /** Checks run before `onConfirm`; cancelling skips them. */
  guards?: readonly Guard[];
}

type ButtonsArgs<Pattern extends string> = [keyof RouteParams<Pattern>] extends [never]
  ? []
  : [params: RouteParams<Pattern>];

/** A confirmation: the button component, plus `buttons()` to put on the question. */
export interface Confirm<Pattern extends string> extends ComponentDefinition<
  'button',
  `${Pattern}/:choice`
> {
  /** The confirm and cancel buttons, as one row for `components`. */
  buttons(...params: ButtonsArgs<Pattern>): ActionRowBuilder<ButtonBuilder>;
}

const EXPIRED = 'This confirmation has expired. Run the command again.';
const opener = onlyOpener('Only the person who asked can answer this.');

/**
 * Confirm and cancel buttons for an action that is hard to undo. The params
 * live in the button's route, so the buttons keep working after a restart
 * until they expire. Mount the result in the feature's `components`.
 */
export function confirm<Pattern extends string>(
  pattern: Pattern,
  options: ConfirmOptions<Pattern>,
): Confirm<Pattern> {
  const expiresAfterMs = parseDuration(options.expiresAfter ?? '15m');
  const confirmOnly = (options.guards ?? []).map(
    (guard): Guard =>
      (interaction, ctx) =>
        ctx.params.choice === 'yes' ? guard(interaction, ctx) : null,
  );

  const component = button(
    `${pattern}/:choice` as `${Pattern}/:choice`,
    async (interaction, ctx) => {
      const { choice, ...params } = ctx.params as Record<string, string>;
      if (Date.now() - interaction.message.createdTimestamp > expiresAfterMs) {
        await interaction.update({ content: EXPIRED, embeds: [], components: [] });
        return;
      }
      const answerCtx = { ...ctx, params } as HandlerContext<RouteParams<Pattern>>;
      if (choice === 'yes') {
        await options.onConfirm(interaction, answerCtx);
      } else if (options.onCancel) {
        await options.onCancel(interaction, answerCtx);
      } else {
        await interaction.update({
          content: options.cancelled ?? 'Cancelled.',
          embeds: [],
          components: [],
        });
      }
    },
    { guards: [opener, ...confirmOnly] },
  );

  const buildId = component.id as (params: Record<string, string>) => string;
  return {
    ...component,
    buttons: (...params) => {
      const to = (choice: string) => buildId({ ...params[0], choice });
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(to('yes'))
          .setLabel(options.confirmLabel ?? 'Confirm')
          .setStyle(options.style ?? ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(to('no'))
          .setLabel(options.cancelLabel ?? 'Cancel')
          .setStyle(ButtonStyle.Secondary),
      );
    },
  };
}
