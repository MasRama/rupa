import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create user_guilds junction table
  await knex.schema.createTable('user_guilds', (table) => {
    table.string('user_id', 20).notNullable();
    table.string('guild_id', 20).notNullable();
    table.text('roles').defaultTo('[]');
    table.datetime('joined_at').defaultTo(knex.fn.now());
    
    // Primary key
    table.primary(['user_id', 'guild_id']);
    
    // Foreign keys
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('guild_id').references('id').inTable('guilds').onDelete('CASCADE');
    
    // Indexes
    table.index(['user_id']);
    table.index(['guild_id']);
    table.index(['joined_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_guilds');
}