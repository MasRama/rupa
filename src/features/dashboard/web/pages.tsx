import type { Guild } from 'discord.js';
import type { Feature, SessionUser } from '@/core';
import { formatNumber, plural } from './format';
import { Layout } from './layout';
import { SettingsForm, type FieldErrors } from './settings-form';
import { PeriodPicker, StatsSection, type StatsData } from './stats';

interface PageBase {
  botName: string;
  user: SessionUser;
  owner: boolean;
}

export function SignInPage({ botName }: { botName: string }) {
  return (
    <Layout title="Sign in" botName={botName} user={null}>
      <section class="signin">
        <h1>{botName}</h1>
        <p>
          Sign in with Discord to see how the bot is used in your servers and to change its
          settings.
        </p>
        <a class="button discord" href="/auth/login">
          Sign in with Discord
        </a>
      </section>
    </Layout>
  );
}

function GuildIcon({ guild, size }: { guild: Guild; size: number }) {
  const url = guild.iconURL({ size: size >= 64 ? 128 : 64 });
  if (url) return <img class="guild-icon" src={url} alt="" width={size} height={size} />;
  const initials = guild.name
    .split(/\s+/)
    .map(word => word[0])
    .join('')
    .slice(0, 3);
  return (
    <span class="guild-icon initials" style={`width:${size}px;height:${size}px`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function ServersPage({ guilds, ...base }: PageBase & { guilds: Guild[] }) {
  return (
    <Layout title="Servers" current="servers" {...base}>
      <h1>Your servers</h1>
      {guilds.length === 0 ? (
        <p class="lede">
          No servers to show. This list has the servers where you have Manage Server and the bot is
          a member. If you got the permission after signing in, sign out and in again.
        </p>
      ) : (
        <ul class="guilds">
          {guilds.map(guild => (
            <li>
              <a href={`/servers/${guild.id}`}>
                <GuildIcon guild={guild} size={40} />
                <span class="name">{guild.name}</span>
                <span class="sub">{plural(guild.memberCount, 'member')}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

export function OverviewPage({
  stats,
  guildCount,
  ...base
}: PageBase & { stats: StatsData; guildCount: number }) {
  return (
    <Layout title="All servers" current="overview" {...base}>
      <header class="hero">
        <div>
          <h1>All servers</h1>
          <p class="sub">The bot is in {plural(guildCount, 'server')}.</p>
        </div>
      </header>
      <PeriodPicker base="/overview" days={stats.days} />
      <StatsSection stats={stats} scope="all" />
    </Layout>
  );
}

export interface FeatureSettings {
  feature: Feature;
  values: Record<string, unknown>;
}

export function GuildPage({
  guild,
  stats,
  settings,
  errors,
  saved,
  ...base
}: PageBase & {
  guild: Guild;
  stats: StatsData;
  settings: FeatureSettings[];
  errors: { feature: string; fields: FieldErrors } | null;
  saved: string | null;
}) {
  return (
    <Layout title={guild.name} current="servers" {...base}>
      <header class="hero">
        <GuildIcon guild={guild} size={72} />
        <div>
          <h1>{guild.name}</h1>
          <p class="sub">{formatNumber(guild.memberCount)} members</p>
        </div>
      </header>
      <PeriodPicker base={`/servers/${guild.id}`} days={stats.days} />
      <StatsSection stats={stats} scope="server" />
      {settings.length > 0 && (
        <section class="settings-list">
          <h2>Settings</h2>
          {settings.map(({ feature, values }) => (
            <SettingsForm
              feature={feature.name}
              settings={feature.settings!}
              values={values}
              guild={guild}
              errors={errors?.feature === feature.name ? errors.fields : null}
              saved={saved === feature.name}
            />
          ))}
        </section>
      )}
    </Layout>
  );
}
