import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { createCaseRepository } from '../repository';
import { moderation } from '../index';

function repository() {
  const db = openDatabase(':memory:');
  migrate(db, [moderation]);
  return createCaseRepository(db);
}

describe('case repository', () => {
  it('records a case and returns its number', () => {
    const cases = repository();
    const first = cases.add({
      guildId: 'g',
      userId: 'u',
      moderatorId: 'm',
      action: 'warn',
      reason: 'spam',
    });
    const second = cases.add({
      guildId: 'g',
      userId: 'u',
      moderatorId: 'm',
      action: 'kick',
      reason: null,
    });
    expect(second).toBe(first + 1);
  });

  it("lists a member's cases in one guild, newest first", () => {
    const cases = repository();
    cases.add({ guildId: 'g', userId: 'u', moderatorId: 'm', action: 'warn', reason: 'one' });
    cases.add({ guildId: 'g', userId: 'u', moderatorId: 'm', action: 'ban', reason: 'two' });
    cases.add({
      guildId: 'other',
      userId: 'u',
      moderatorId: 'm',
      action: 'warn',
      reason: 'elsewhere',
    });
    cases.add({
      guildId: 'g',
      userId: 'someone-else',
      moderatorId: 'm',
      action: 'warn',
      reason: 'x',
    });

    const listed = cases.listForMember('g', 'u');
    expect(listed.map(entry => [entry.action, entry.reason])).toEqual([
      ['ban', 'two'],
      ['warn', 'one'],
    ]);
    expect(listed[0]).toMatchObject({ guildId: 'g', userId: 'u', moderatorId: 'm' });
    expect(typeof listed[0]!.createdAt).toBe('string');
  });

  it('limits the list', () => {
    const cases = repository();
    for (let index = 0; index < 5; index++) {
      cases.add({
        guildId: 'g',
        userId: 'u',
        moderatorId: 'm',
        action: 'warn',
        reason: `${index}`,
      });
    }
    expect(cases.listForMember('g', 'u', 2)).toHaveLength(2);
    expect(cases.countForMember('g', 'u')).toBe(5);
  });
});
