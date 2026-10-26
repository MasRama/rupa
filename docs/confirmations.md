# Confirmations

`confirm()` asks before doing something that is hard to undo. It gives you a Confirm and a Cancel button and runs your handler only when Confirm is clicked:

```ts
import { confirm, requireBotPermissions } from '@/core';

export const banConfirm = confirm('moderation:ban/:userId', {
  confirmLabel: 'Ban',
  cancelled: 'Ban cancelled.',
  guards: [requireBotPermissions(PermissionFlagsBits.BanMembers)],
  async onConfirm(interaction, ctx) {
    await interaction.guild!.bans.create(ctx.params.userId);
    await interaction.update({ content: 'Done.', embeds: [], components: [] });
  },
});

// Mount it like any component:
export const moderation = defineFeature({ name: 'moderation', components: [banConfirm] /* ... */ });

// Ask from a command:
await interaction.reply({
  content: `Ban ${user}?`,
  components: [banConfirm.buttons({ userId: user.id })],
  flags: MessageFlags.Ephemeral,
});
```

| Option         | Default              | What it does                                                           |
| -------------- | -------------------- | ---------------------------------------------------------------------- |
| `onConfirm`    | (required)           | Runs on Confirm. `ctx.params` holds the route's params.                |
| `onCancel`     | replace the message  | Runs on Cancel instead of the default.                                 |
| `cancelled`    | `'Cancelled.'`       | What the message says after Cancel, when there is no `onCancel`.       |
| `confirmLabel` | `'Confirm'`          | Label of the confirm button.                                           |
| `cancelLabel`  | `'Cancel'`           | Label of the cancel button.                                            |
| `style`        | `ButtonStyle.Danger` | Style of the confirm button (`Primary`, `Success` or `Danger`).        |
| `expiresAfter` | `'15m'`              | How long after the question was sent the buttons still work.           |
| `guards`       | none                 | [Guards](./guards.md) checked on Confirm only, so Cancel always works. |

## How it works

The buttons are ordinary [routes](./interactions.md) with a `/:choice` segment, so the buttons above have ids like `moderation:ban/123/yes` and `moderation:ban/123/no`. Nothing is kept in memory, so a question asked before a restart can still be answered after it.

- A click after `expiresAfter` replaces the message with "This confirmation has expired. Run the command again." and runs neither handler. The age is measured from when the question was sent.
- On a public message, only the person who ran the original command can answer; anyone else gets a private notice, recorded as blocked in the stats.
- Things can change between the question and the answer (roles, a deleted item), so check again in `onConfirm` before acting.

Keep the route short: the params and `/yes` must fit in Discord's 100-character custom id. Put long text such as a reason in the message, and read it back from `interaction.message` in `onConfirm`.
