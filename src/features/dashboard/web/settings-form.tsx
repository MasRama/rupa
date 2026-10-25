import { ChannelType, type Guild } from 'discord.js';
import { formValue, type SettingDefinition, type Settings } from '@/core';
import { featureTitle } from './format';

const TEXT_CHANNELS = new Set<ChannelType>([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

export type FieldErrors = Record<string, string>;

/** Form fields → setting values, in the shape `writeSettings` expects. */
export function readSettingsForm(
  settings: Settings,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(settings.definitions)) {
    const raw = body[key];
    values[key] = formValue(definition, typeof raw === 'string' ? raw : undefined);
  }
  return values;
}

/** Channels and roles must belong to this server; channels must accept messages. */
export function guildReferenceErrors(
  guild: Guild,
  settings: Settings,
  values: Record<string, unknown>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, definition] of Object.entries(settings.definitions)) {
    const value = values[key];
    if (value === null || value === undefined) continue;
    if (definition.kind === 'channel') {
      const channel = guild.channels.cache.get(String(value));
      if (!channel || !TEXT_CHANNELS.has(channel.type)) {
        errors[key] = 'Choose a text channel in this server';
      }
    }
    if (definition.kind === 'role' && !guild.roles.cache.has(String(value))) {
      errors[key] = 'Choose a role in this server';
    }
  }
  return errors;
}

function textChannels(guild: Guild) {
  return [...guild.channels.cache.values()]
    .filter(channel => TEXT_CHANNELS.has(channel.type))
    .sort((a, b) => ('rawPosition' in a && 'rawPosition' in b ? a.rawPosition - b.rawPosition : 0));
}

function assignableRoles(guild: Guild) {
  return [...guild.roles.cache.values()]
    .filter(role => role.id !== guild.id && !role.managed)
    .sort((a, b) => b.position - a.position);
}

function Input({
  name,
  definition,
  value,
  guild,
  describedBy,
}: {
  name: string;
  definition: SettingDefinition;
  value: unknown;
  guild: Guild;
  describedBy: string | undefined;
}) {
  const id = `field-${name}`;
  const { constraints } = definition;
  switch (definition.kind) {
    case 'boolean':
      return (
        <input
          type="checkbox"
          id={id}
          name={name}
          checked={value === true}
          aria-describedby={describedBy}
        />
      );
    case 'channel':
    case 'role': {
      const options =
        definition.kind === 'channel'
          ? textChannels(guild).map(channel => ({ id: channel.id, label: `#${channel.name}` }))
          : assignableRoles(guild).map(role => ({ id: role.id, label: `@${role.name}` }));
      return (
        <select id={id} name={name} aria-describedby={describedBy}>
          <option value="">Not set</option>
          {options.map(option => (
            <option value={option.id} selected={option.id === value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    case 'number':
      return (
        <input
          type="number"
          id={id}
          name={name}
          value={value === null ? '' : String(value)}
          min={constraints.min}
          max={constraints.max}
          step={constraints.integer ? 1 : 'any'}
          aria-describedby={describedBy}
        />
      );
    case 'string':
      return (
        <input
          type="text"
          id={id}
          name={name}
          value={value === null ? '' : String(value)}
          maxlength={constraints.maxLength}
          aria-describedby={describedBy}
        />
      );
  }
}

export function SettingsForm({
  feature,
  settings,
  values,
  guild,
  errors,
  saved,
}: {
  feature: string;
  settings: Settings;
  values: Record<string, unknown>;
  guild: Guild;
  errors: FieldErrors | null;
  saved: boolean;
}) {
  return (
    <section class="settings" id={`settings-${feature}`}>
      <h3>{featureTitle(feature)}</h3>
      {saved && (
        <p class="notice" role="status">
          Settings saved.
        </p>
      )}
      {errors && (
        <p class="notice error" role="alert">
          Nothing was saved. Fix the highlighted settings and try again.
        </p>
      )}
      <form method="post" action={`/servers/${guild.id}/settings/${feature}`}>
        {Object.entries(settings.definitions).map(([name, definition]) => {
          const error = errors?.[name];
          const help = definition.description ? `help-${name}` : undefined;
          const describedBy = [help, error ? `error-${name}` : undefined].filter(Boolean).join(' ');
          return (
            <div
              class={`field ${definition.kind === 'boolean' ? 'toggle' : ''} ${error ? 'invalid' : ''}`}
            >
              <label for={`field-${name}`}>{definition.label}</label>
              <Input
                name={name}
                definition={definition}
                value={values[name]}
                guild={guild}
                describedBy={describedBy || undefined}
              />
              {definition.description && (
                <p class="help" id={help}>
                  {definition.description}
                </p>
              )}
              {error && (
                <p class="field-error" id={`error-${name}`}>
                  {error}
                </p>
              )}
            </div>
          );
        })}
        <button type="submit">Save changes</button>
      </form>
    </section>
  );
}
