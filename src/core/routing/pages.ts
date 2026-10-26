import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type APIEmbed,
  type JSONEncodable,
  type RepliableInteraction,
} from 'discord.js';
import { button, type ComponentDefinition, type HandlerContext } from './definitions';
import type { Guard } from './guards';
import { onlyOpener } from './opener';
import type { RouteParams } from './pattern';

type Awaitable<T> = T | Promise<T>;

/** Which slice of the list a page shows. `page` counts from 1. */
export interface PageInfo {
  page: number;
  pageCount: number;
  total: number;
  /** Rows to skip, e.g. for SQL `OFFSET`. */
  offset: number;
  /** Rows to show, e.g. for SQL `LIMIT`. */
  limit: number;
}

/** What `render` returns for one page; the page buttons are added for you. */
export interface PageContent {
  content?: string;
  embeds?: (APIEmbed | JSONEncodable<APIEmbed>)[];
}

export interface PageMessage extends PageContent {
  components: ActionRowBuilder<ButtonBuilder>[];
}

export interface PagesOptions<Pattern extends string> {
  /** Items per page. */
  pageSize: number;
  /** How many items there are in total. */
  count(
    ctx: HandlerContext<RouteParams<Pattern>>,
    interaction: RepliableInteraction,
  ): Awaitable<number>;
  /** Renders one page; query with `offset` and `limit`. */
  render(
    page: PageInfo,
    ctx: HandlerContext<RouteParams<Pattern>>,
    interaction: RepliableInteraction,
  ): Awaitable<PageContent>;
  /** Extra checks before a page is turned. */
  guards?: readonly Guard[];
}

type FirstArgs<Pattern extends string> = [keyof RouteParams<Pattern>] extends [never]
  ? []
  : [params: RouteParams<Pattern>];

/** A paginated list: the page button component, plus `first()` to send page 1. */
export interface Pages<Pattern extends string> extends ComponentDefinition<
  'button',
  `${Pattern}/:page`
> {
  /** The first page with its buttons; pass it to `interaction.reply`. */
  first(
    interaction: RepliableInteraction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: HandlerContext<any>,
    ...params: FirstArgs<Pattern>
  ): Promise<PageMessage>;
}

/** The page to show for `requested`, kept within 1..pageCount. */
export function pageWindow(total: number, pageSize: number, requested: number): PageInfo {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const wanted = Number.isFinite(requested) ? Math.trunc(requested) : 1;
  const page = Math.min(Math.max(wanted, 1), pageCount);
  return { page, pageCount, total, offset: (page - 1) * pageSize, limit: pageSize };
}

const opener = onlyOpener('Only the person who opened this list can turn its pages.');

/**
 * A list split into pages with ◀ ▶ buttons. The page number lives in the
 * button's route, so the buttons keep working after a restart. Mount the
 * result in the feature's `components`.
 */
export function pages<Pattern extends string>(
  pattern: Pattern,
  options: PagesOptions<Pattern>,
): Pages<Pattern> {
  const { pageSize } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError(`Page size for "${pattern}" must be a whole number of at least 1`);
  }

  async function render(
    requested: number,
    params: RouteParams<Pattern>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: HandlerContext<any>,
    interaction: RepliableInteraction,
  ): Promise<PageMessage> {
    const pageCtx = { ...ctx, params } as HandlerContext<RouteParams<Pattern>>;
    const info = pageWindow(await options.count(pageCtx, interaction), pageSize, requested);
    const content = await options.render(info, pageCtx, interaction);
    if (info.pageCount === 1) return { ...content, components: [] };

    const buildId = component.id as (params: Record<string, string>) => string;
    const to = (page: number) => buildId({ ...params, page: String(page) });
    const nav = (id: string, label: string, disabled: boolean) =>
      new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      nav(to(info.page - 1), '◀', info.page === 1),
      nav(to(info.page), `${info.page} / ${info.pageCount}`, true),
      nav(to(info.page + 1), '▶', info.page === info.pageCount),
    );
    return { ...content, components: [row] };
  }

  const component = button(
    `${pattern}/:page` as `${Pattern}/:page`,
    async (interaction, ctx) => {
      const { page, ...params } = ctx.params as Record<string, string>;
      const message = await render(Number(page), params as RouteParams<Pattern>, ctx, interaction);
      await interaction.update(message);
    },
    { guards: [opener, ...(options.guards ?? [])] },
  );

  return {
    ...component,
    first: (interaction, ctx, ...params) =>
      render(1, (params[0] ?? {}) as RouteParams<Pattern>, ctx, interaction),
  };
}
