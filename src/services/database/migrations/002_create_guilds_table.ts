import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create guilds table
  await knex.schema.createTable('guilds', (table) => {
    table.string('id', 20).primary();
    table.string('name', 100).notNullable();
    table.string('prefix', 5).defaultTo('!');
    table.text('settings').defaultTo('{}');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['name']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('guilds');
}