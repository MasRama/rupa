import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { createGuildRepository } from '../repository';
import { guilds } from '../index';

function repository() {
  const db = openDatabase(':memory:');
  migrate(db, [guilds]);
  return createGuildRepository(db);
}

describe('guild repository', () => {
  it('tracks joined guilds and updates their name', () => {
    const repo = repository();
    repo.joined('1', 'Old name');
    repo.joined('1', 'New name');
    repo.joined('2', 'Second');
    expect(repo.find('1')).toMatchObject({ id: '1', name: 'New name', leftAt: null });
    expect(repo.countActive()).toBe(2);
  });

  it('marks a guild as left and counts it as inactive', () => {
    const repo = repository();
    repo.joined('1', 'Guild');
    repo.left('1');
    expect(repo.find('1')?.leftAt).not.toBeNull();
    expect(repo.countActive()).toBe(0);
  });

  it('clears the left mark when the bot rejoins', () => {
    const repo = repository();
    repo.joined('1', 'Guild');
    repo.left('1');
    repo.joined('1', 'Guild');
    expect(repo.find('1')?.leftAt).toBeNull();
  });

  it('returns null for unknown guilds', () => {
    expect(repository().find('nope')).toBeNull();
  });
});
