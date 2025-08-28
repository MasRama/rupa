import { DatabaseService } from '../DatabaseService';
import { GuildModel } from '@/types/database';

export class GuildRepository {
  private db = DatabaseService.getInstance();

  async findById(id: string): Promise<GuildModel | undefined> {
    const connection = this.db.getConnection();
    return await connection('guilds').where('id', id).first();
  }

  async findByName(name: string): Promise<GuildModel[]> {
    const connection = this.db.getConnection();
    return await connection('guilds').where('name', 'like', `%${name}%`);
  }

  async create(guild: Omit<GuildModel, 'created_at' | 'updated_at'>): Promise<void> {
    const connection = this.db.getConnection();
    await connection('guilds').insert({
      ...guild,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  async update(id: string, updates: Partial<Omit<GuildModel, 'id' | 'created_at'>>): Promise<void> {
    const connection = this.db.getConnection();
    await connection('guilds')
      .where('id', id)
      .update({
        ...updates,
        updated_at: new Date(),
      });
  }

  async delete(id: string): Promise<void> {
    const connection = this.db.getConnection();
    await connection('guilds').where('id', id).del();
  }

  async exists(id: string): Promise<boolean> {
    const connection = this.db.getConnection();
    const result = await connection('guilds').where('id', id).first();
    return !!result;
  }

  async updateSettings(id: string, settings: object): Promise<void> {
    const connection = this.db.getConnection();
    await connection('guilds')
      .where('id', id)
      .update({
        settings: JSON.stringify(settings),
        updated_at: new Date(),
      });
  }

  async getSettings(id: string): Promise<object> {
    const guild = await this.findById(id);
    if (!guild) {
      throw new Error(`Guild with id ${id} not found`);
    }
    
    try {
      return JSON.parse(guild.settings);
    } catch {
      return {};
    }
  }
}