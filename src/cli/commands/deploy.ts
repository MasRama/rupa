import { REST, Routes } from 'discord.js';
import { requireDiscordCredentials, type AppConfig } from '@/core/config';
import { buildCommandPayloads, planCommandDeploy, type RemoteCommand } from '@/core/deploy/plan';
import type { FeatureRegistry } from '@/core/routing/registry';

interface Target {
  route: `/${string}`;
  label: string;
}

function resolveTarget(config: AppConfig, global: boolean): { rest: REST; target: Target } {
  const { token, clientId, guildId } = requireDiscordCredentials(config);
  const rest = new REST().setToken(token);
  if (guildId && !global) {
    return {
      rest,
      target: {
        route: Routes.applicationGuildCommands(clientId, guildId),
        label: `guild ${guildId}`,
      },
    };
  }
  return { rest, target: { route: Routes.applicationCommands(clientId), label: 'global scope' } };
}

/**
 * Current commands on Discord. Without `with_localizations` Discord omits the
 * localization maps, and every localized command would look changed.
 */
export async function fetchRemoteCommands(
  rest: Pick<REST, 'get'>,
  route: `/${string}`,
): Promise<RemoteCommand[]> {
  const query = new URLSearchParams({ with_localizations: 'true' });
  return (await rest.get(route, { query })) as RemoteCommand[];
}

/**
 * Shows what would change on Discord and, unless `planOnly`, applies it with
 * one bulk overwrite. Sends nothing when the plan is empty.
 */
export async function deployCommand(
  config: AppConfig,
  registry: FeatureRegistry,
  options: { planOnly: boolean; global: boolean },
): Promise<void> {
  const { rest, target } = resolveTarget(config, options.global);
  const local = buildCommandPayloads(registry);
  const remote = await fetchRemoteCommands(rest, target.route);
  const plan = planCommandDeploy(local, remote);

  console.log(`Command plan for ${target.label}:`);
  for (const name of plan.added) console.log(`  + /${name}`);
  for (const name of plan.changed) console.log(`  ~ /${name}`);
  for (const name of plan.removed) console.log(`  - /${name}`);
  console.log(`  ${plan.unchanged.length} unchanged`);

  const pending = plan.added.length + plan.changed.length + plan.removed.length;
  if (pending === 0) {
    console.log('Nothing to deploy.');
    return;
  }
  if (options.planOnly) {
    console.log('Plan only: nothing was sent. Run "npm run deploy" to apply.');
    return;
  }

  await rest.put(target.route, { body: local });
  console.log(`Deployed ${local.length} command(s) to ${target.label}.`);
  if (target.label === 'global scope') {
    console.log('Global commands can take a while to show up in every client.');
  }
}

export async function clearCommands(
  config: AppConfig,
  options: { global: boolean },
): Promise<void> {
  const { rest, target } = resolveTarget(config, options.global);
  await rest.put(target.route, { body: [] });
  console.log(`Removed every command from ${target.label}.`);
}
