import type { Guild } from 'discord.js';
import {
  requireGuildManager,
  requireOwner,
  requireUser,
  SettingsError,
  writeSettings,
  type SessionUser,
  type WebApp,
  type WebContext,
} from '@/core';
import { GuildPage, OverviewPage, ServersPage, SignInPage } from './pages';
import { guildReferenceErrors, readSettingsForm, type FieldErrors } from './settings-form';
import { loadStats, parsePeriod } from './stats';
import { DASHBOARD_STYLES } from './styles';

export function registerDashboard(app: WebApp, ctx: WebContext): void {
  const { client, db, registry, access } = ctx;
  const botName = () => client.user?.username ?? 'Rupa';
  const base = async (user: SessionUser) => ({
    botName: botName(),
    user,
    owner: await access.isOwner(user.id),
  });
  const withSettings = registry.features.filter(feature => feature.settings);

  const guildPage = async (
    user: SessionUser,
    guild: Guild,
    days: string | undefined,
    extra: { errors?: { feature: string; fields: FieldErrors }; saved?: string },
  ) => (
    <GuildPage
      {...await base(user)}
      guild={guild}
      stats={loadStats(db, parsePeriod(days), guild.id)}
      settings={withSettings.map(feature => ({
        feature,
        values: feature.settings!.read({ db, feature: feature.name }, guild.id),
      }))}
      errors={extra.errors ?? null}
      saved={extra.saved ?? null}
    />
  );

  app.get('/assets/dashboard.css', c =>
    c.body(DASHBOARD_STYLES, 200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    }),
  );

  app.get('/', c =>
    c.var.user ? c.redirect('/servers', 302) : c.html(<SignInPage botName={botName()} />),
  );

  app.get('/servers', requireUser, async c => {
    const user = c.var.user!;
    const guilds = user.guildIds
      .map(id => client.guilds.cache.get(id))
      .filter((guild): guild is Guild => guild !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
    return c.html(<ServersPage {...await base(user)} guilds={guilds} />);
  });

  app.get('/overview', requireOwner, async c => {
    const stats = loadStats(db, parsePeriod(c.req.query('days')));
    return c.html(
      <OverviewPage
        {...await base(c.var.user!)}
        stats={stats}
        guildCount={client.guilds.cache.size}
      />,
    );
  });

  app.get('/servers/:guildId', requireGuildManager, async c => {
    const guild = client.guilds.cache.get(c.req.param('guildId'))!;
    const saved = c.req.query('saved');
    return c.html(await guildPage(c.var.user!, guild, c.req.query('days'), saved ? { saved } : {}));
  });

  app.post('/servers/:guildId/settings/:feature', requireGuildManager, async c => {
    const user = c.var.user!;
    const guild = client.guilds.cache.get(c.req.param('guildId'))!;
    const feature = withSettings.find(candidate => candidate.name === c.req.param('feature'));
    if (!feature) return c.notFound();
    const settings = feature.settings!;

    const values = readSettingsForm(settings, await c.req.parseBody());
    const fields = guildReferenceErrors(guild, settings, values);
    try {
      if (Object.keys(fields).length > 0) {
        throw new SettingsError(Object.entries(fields).map(([key, message]) => ({ key, message })));
      }
      writeSettings(db, settings, {
        feature: feature.name,
        guildId: guild.id,
        values,
        updatedBy: user.id,
      });
    } catch (error) {
      if (!(error instanceof SettingsError)) throw error;
      const errors = Object.fromEntries(error.issues.map(issue => [issue.key, issue.message]));
      return c.html(
        await guildPage(user, guild, undefined, {
          errors: { feature: feature.name, fields: errors },
        }),
        400,
      );
    }

    ctx.logger.info(
      { guildId: guild.id, userId: user.id, feature: feature.name },
      'Settings saved',
    );
    return c.redirect(`/servers/${guild.id}?saved=${feature.name}#settings-${feature.name}`, 303);
  });
}
