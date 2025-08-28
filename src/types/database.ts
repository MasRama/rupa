import { Knex } from 'knex';

export interface DatabaseConfig {
  client: string;
  connection: {
    filename: string;
  };
  useNullAsDefault: boolean;
  migrations: {
    directory: string;
  };
}

export interface UserModel {
  id: string;
  username: string;
  discriminator: string;
  created_at: Date;
  updated_at: Date;
}

export interface GuildModel {
  id: string;
  name: string;
  prefix: string;
  settings: string; // JSON string
  created_at: Date;
  updated_at: Date;
}

export interface UserGuildModel {
  user_id: string;
  guild_id: string;
  roles: string; // JSON string
  joined_at: Date;
}