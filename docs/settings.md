# Server settings

A feature can declare settings that each server sets for itself, such as a log channel or whether to DM members. Values are typed, validated and stored by Rupa, and server managers can edit them in the [dashboard](./dashboard.md).

## Declaring settings

```ts
// src/features/moderation/settings.ts
import { defineSettings, setting } from '@/core';

export const moderationSettings = defineSettings({
  logChannel: setting.channel({
    label: 'Log channel',
    description: 'Every warn, kick and ban is also posted here.',
  }),
  dmMembers: setting.boolean({
    label: 'DM members about actions',
    default: true,
  }),
});
```

```ts
// src/features/moderation/index.ts
export const moderation = defineFeature({
  name: 'moderation',
  settings: moderationSettings,
  // ...
});
```

| Kind              | Stored value     | Options                 |
| ----------------- | ---------------- | ----------------------- |
| `setting.string`  | text             | `maxLength`             |
| `setting.number`  | number           | `min`, `max`, `integer` |
| `setting.boolean` | `true` / `false` |                         |
| `setting.channel` | a channel id     |                         |
| `setting.role`    | a role id        |                         |

Every kind takes a `label`, an optional `description` and an optional `default`. Without a default, an unset value reads as `null`.

## Reading them

```ts
const settings = moderationSettings.read(ctx, interaction.guildId);
settings.dmMembers; // boolean (it has a default)
settings.logChannel; // string | null
```

`read` takes the handler context (or any `{ db, feature }`) and a server id. The result is typed from the definitions. Values that no longer pass validation, for example after you lowered a `max`, read as the default.

## Writing them

The dashboard writes settings for you. To write them from your own code, for example from a slash command:

```ts
import { SettingsError, writeSettings } from '@/core';

try {
  writeSettings(ctx.db, moderationSettings, {
    feature: ctx.feature,
    guildId: interaction.guildId,
    values: { logChannel: channel.id },
    updatedBy: interaction.user.id,
  });
} catch (error) {
  if (error instanceof SettingsError) {
    // error.issues: [{ key: 'logChannel', message: 'Must be a channel id' }]
  }
}
```

Every value is validated first, unknown keys are rejected, and nothing is saved unless everything is valid. `null` resets a setting to its default. Keys you leave out stay as they are. `writeSettings` checks the shape of channel and role ids, not that they belong to the server, so check that yourself when the id comes from a user. The dashboard does.

Settings live in the core table `rupa_guild_settings`, keyed by server, feature and setting name.
