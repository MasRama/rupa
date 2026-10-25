import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { FeatureRegistry } from '@/core/routing/registry';

export type LocalCommand = RESTPostAPIChatInputApplicationCommandsJSONBody;

/** A command as returned by Discord's application commands endpoint. */
export type RemoteCommand = { name: string } & Record<string, unknown>;

export interface DeployPlan {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
}

/** Slash command bodies for every mounted feature, in mount order. */
export function buildCommandPayloads(registry: FeatureRegistry): LocalCommand[] {
  return [...registry.commands.values()].map(({ definition }) => definition.data.toJSON());
}

type Json = Record<string, unknown>;

const OPTION_FIELDS = [
  'type',
  'name',
  'description',
  'name_localizations',
  'description_localizations',
  'choices',
  'channel_types',
  'min_value',
  'max_value',
  'min_length',
  'max_length',
] as const;

/** Fields Discord fills in when they are left out, with the value it uses. */
const OPTION_DEFAULTS: Json = { required: false, autocomplete: false };

function normalizeOption(option: Json): Json {
  const normalized: Json = {};
  for (const field of OPTION_FIELDS) {
    if (option[field] !== undefined && option[field] !== null) normalized[field] = option[field];
  }
  for (const [field, fallback] of Object.entries(OPTION_DEFAULTS)) {
    normalized[field] = option[field] ?? fallback;
  }
  if (Array.isArray(option.options) && option.options.length > 0) {
    normalized.options = (option.options as Json[]).map(normalizeOption);
  }
  return normalized;
}

/**
 * Reduces both sides to the fields a developer controls, with Discord's
 * defaults filled in. `contexts` and `integration_types` are compared only
 * when the local command sets them, since Discord reports its own defaults.
 */
function normalizeCommand(command: Json, local: Json): Json {
  const normalized: Json = {
    type: command.type ?? 1,
    name: command.name,
    description: command.description,
    default_member_permissions: command.default_member_permissions ?? null,
    nsfw: command.nsfw ?? false,
    name_localizations: command.name_localizations ?? null,
    description_localizations: command.description_localizations ?? null,
    options: Array.isArray(command.options) ? (command.options as Json[]).map(normalizeOption) : [],
  };
  for (const field of ['contexts', 'integration_types']) {
    if (local[field] !== undefined) normalized[field] = command[field] ?? null;
  }
  return normalized;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify((value as Json)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Compares local command bodies with what Discord has, by command name. */
export function planCommandDeploy(
  local: readonly LocalCommand[],
  remote: readonly RemoteCommand[],
): DeployPlan {
  const plan: DeployPlan = { added: [], changed: [], removed: [], unchanged: [] };
  const remoteByName = new Map(remote.map(command => [command.name, command as Json]));

  for (const command of local) {
    const localJson = command as unknown as Json;
    const existing = remoteByName.get(command.name);
    if (!existing) {
      plan.added.push(command.name);
      continue;
    }
    const same =
      stableStringify(normalizeCommand(localJson, localJson)) ===
      stableStringify(normalizeCommand(existing, localJson));
    (same ? plan.unchanged : plan.changed).push(command.name);
  }

  const localNames = new Set(local.map(command => command.name));
  plan.removed = remote.map(command => command.name).filter(name => !localNames.has(name));
  return plan;
}
