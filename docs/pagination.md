# Pagination

`pages()` turns a long list into pages with ◀ and ▶ buttons:

```ts
import { pages } from '@/core';

export const casePages = pages('moderation:cases/:userId', {
  pageSize: 5,
  count: (ctx, interaction) =>
    createCaseRepository(ctx.db).countForMember(interaction.guildId!, ctx.params.userId),
  async render(page, ctx, interaction) {
    const cases = createCaseRepository(ctx.db).listForMember(
      interaction.guildId!,
      ctx.params.userId,
      page.limit,
      page.offset,
    );
    return { embeds: [casesEmbed(cases, page)] };
  },
});

// Mount it like any component:
export const moderation = defineFeature({ name: 'moderation', components: [casePages] /* ... */ });

// Send the first page from a command:
const first = await casePages.first(interaction, ctx, { userId: user.id });
await interaction.reply({ ...first, flags: MessageFlags.Ephemeral });
```

- `count` returns how many items there are. `render` returns the message for one page (`content` and/or `embeds`). Rupa adds the buttons.
- `render` gets `page`, `pageCount`, `total`, and `offset` and `limit` to use in SQL (`LIMIT ? OFFSET ?`).
- The route's params (`:userId` here) are passed to `first()` and come back as `ctx.params` on every page.

## How it works

The buttons are ordinary [routes](./interactions.md): the pattern gets a `/:page` segment, so the buttons above have ids like `moderation:cases/123/2`. Each click runs `count` and `render` again and edits the message in place. Nothing is kept in memory, so the buttons keep working after the bot restarts, and a page always shows current data.

- When there is only one page, there are no buttons.
- If the list shrank since the message was sent, a click on a page that no longer exists shows the last page.
- On a public message, only the person who ran the original command can turn the pages; anyone else gets a private notice, recorded as blocked in the stats. On an ephemeral message only that person can see the buttons anyway.
- Add your own checks with `pages(pattern, { ..., guards: [...] })`.

Keep the route short: the page number and the params must fit in Discord's 100-character custom id.

`/cases` and `/remind list` in the example features use it.
