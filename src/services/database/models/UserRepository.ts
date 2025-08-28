import { DatabaseService } from '../DatabaseService';
import { UserModel } from '@/types/database';

export class UserRepository {
  private db = DatabaseService.getInstance();

  async findById(id: string): Promise<UserModel | undefined> {
    const connection = this.db.getConnection();
    return await connection('users').where('id', id).first();
  }

  async findByUsername(username: string): Promise<UserModel[]> {
    const connection = this.db.getConnection();
    return await connection('users').where('username', 'like', `%${username}%`);
  }

  async create(user: Omit<UserModel, 'created_at' | 'updated_at'>): Promise<void> {
    const connection = this.db.getConnection();
    await connection('users').insert({
      ...user,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  async update(id: string, updates: Partial<Omit<UserModel, 'id' | 'created_at'>>): Promise<void> {
    const connection = this.db.getConnection();
    await connection('users')
      .where('id', id)
      .update({
        ...updates,
        updated_at: new Date(),
      });
  }

  async delete(id: string): Promise<void> {
    const connection = this.db.getConnection();
    await connection('users').where('id', id).del();
  }

  async exists(id: string): Promise<boolean> {
    const connection = this.db.getConnection();
    const result = await connection('users').where('id', id).first();
    return !!result;
  }
}