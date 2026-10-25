import {
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { command, cooldown, type HandlerContext } from '@/core';
import { formatReminderList, parseReminder } from '../input';
import { deliver } from '../jobs';
import { createReminderRepository } from '../repository';

const reply = (interaction: ChatInputCommandInteraction, content: string) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

export const remindCommand = command({
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Get reminded about something later')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set a reminder')
        .addStringOption(option =>
          option
            .setName('in')
            .setDescription('How long from now, e.g. 10m, 2h or 1d')
            .setMaxLength(20)
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('text')
            .setDescription('What to remind you about')
            .setMaxLength(500)
            .setRequired(true),
        ),
    )
    .addSubcommand(sub => sub.setName('list').setDescription('Show your reminders'))
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Cancel a reminder')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('The reminder number from /remind list')
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  guards: [cooldown('5s')],

  async execute(interaction, ctx) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'set') await set(interaction, ctx);
    else if (subcommand === 'list') await list(interaction, ctx);
    else if (subcommand === 'cancel') await cancel(interaction, ctx);
  },
});

async function set(interaction: ChatInputCommandInteraction, ctx: HandlerContext) {
  const reminders = createReminderRepository(ctx.db);
  const userId = interaction.user.id;
  const parsed = parseReminder({
    in: interaction.options.getString('in', true),
    now: new Date(),
    active: reminders.countForUser(userId),
  });
  if ('error' in parsed) {
    await reply(interaction, parsed.error);
    return;
  }

  const id = reminders.add({
    userId,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    text: interaction.options.getString('text', true),
    remindAt: parsed.remindAt,
  });
  ctx.jobs.schedule(deliver, { reminderId: id }, { at: parsed.remindAt, key: `${id}` });
  const when = Math.floor(parsed.remindAt.getTime() / 1000);
  await reply(interaction, `Reminder #${id} set for <t:${when}:f> (<t:${when}:R>).`);
}

async function list(interaction: ChatInputCommandInteraction, ctx: HandlerContext) {
  const items = createReminderRepository(ctx.db).listForUser(interaction.user.id);
  await reply(interaction, formatReminderList(items));
}

async function cancel(interaction: ChatInputCommandInteraction, ctx: HandlerContext) {
  const id = interaction.options.getInteger('id', true);
  if (!createReminderRepository(ctx.db).remove(id, interaction.user.id)) {
    await reply(interaction, `You have no reminder #${id}.`);
    return;
  }
  ctx.jobs.cancel(deliver, `${id}`);
  await reply(interaction, `Reminder #${id} cancelled.`);
}
