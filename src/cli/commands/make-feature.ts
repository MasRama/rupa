import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** Discord's limit for slash command names; the scaffold names its command after the feature. */
const MAX_NAME_LENGTH = 32;

const camelCase = (name: string) =>
  name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

function templates(name: string): Record<string, string> {
  const id = camelCase(name);
  return {
    'index.ts': `import { defineFeature } from '@/core';
import { ${id}Command } from './commands/${name}';
import { migrations } from './migrations';

export const ${id} = defineFeature({
  name: '${name}',
  commands: [${id}Command],
  migrations,
});
`,
    [`commands/${name}.ts`]: `import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { command } from '@/core';

export const ${id}Command = command({
  data: new SlashCommandBuilder()
    .setName('${name}')
    .setDescription('Describe what /${name} does'),

  async execute(interaction) {
    await interaction.reply({
      content: 'Hello from the ${name} feature.',
      flags: MessageFlags.Ephemeral,
    });
  },
});
`,
    'migrations.ts': `import type { Migration } from '@/core';

/**
 * Tables owned by this feature. Prefix table names with the feature name and
 * never edit a migration that already ran; add a new one instead.
 *
 * Example:
 *   { id: '001_create_items', up: \`CREATE TABLE ${name.replace(/-/g, '_')}_items (id INTEGER PRIMARY KEY)\` }
 */
export const migrations: Migration[] = [];
`,
    [`tests/${name}.test.ts`]: `import { describe, expect, it } from 'vitest';
import { ${id} } from '../index';

describe('${name} feature', () => {
  it('provides the /${name} command', () => {
    expect(${id}.commands.map(command => command.data.name)).toEqual(['${name}']);
  });
});
`,
  };
}

/**
 * Creates `src/features/<name>` under `rootDir` and returns the created files
 * relative to `rootDir`. Does not mount the feature.
 */
export function scaffoldFeature(rootDir: string, name: string): string[] {
  if (!FEATURE_NAME.test(name)) {
    throw new Error(`Feature name "${name}" must be kebab-case, e.g. "server-stats"`);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Feature name "${name}" is longer than ${MAX_NAME_LENGTH} characters`);
  }

  const featureDir = join('src', 'features', name);
  if (existsSync(join(rootDir, featureDir))) {
    throw new Error(`Feature "${name}" already exists at ${featureDir}`);
  }

  return Object.entries(templates(name)).map(([file, content]) => {
    const relative = join(featureDir, file);
    const absolute = join(rootDir, relative);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
    return relative.split('\\').join('/');
  });
}

export function makeFeatureCommand(name: string | undefined): void {
  if (!name) throw new Error('Usage: rupa make feature <name>');
  const created = scaffoldFeature(process.cwd(), name);
  const id = camelCase(name);

  console.log(`Created feature "${name}":`);
  for (const file of created) console.log(`  + ${file}`);
  console.log(`
Mount it in src/app/features.ts:

  import { ${id} } from '@/features/${name}';
  export const features: Feature[] = [/* ... */, ${id}];

Then run "npm run deploy" to register /${name} with Discord.`);
}
