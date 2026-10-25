import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '@/core/database';
import { createCaseRepository } from '../repository';
import { casePages, casesEmbed } from '../commands/cases';
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

describe('case pages', () => {
  it('lists a page of cases with offset', () => {
    const cases = repository();
    for (const reason of ['one', 'two', 'three']) {
      cases.add({ guildId: 'g', userId: 'u', moderatorId: 'm', action: 'warn', reason });
    }
    expect(cases.listForMember('g', 'u', 2, 1).map(entry => entry.reason)).toEqual(['two', 'one']);
  });

  it('renders one page of the history', () => {
    const embed = casesEmbed({
      username: 'rama',
      page: { page: 2, pageCount: 3, total: 11, offset: 5, limit: 5 },
      cases: [
        {
          id: 7,
          guildId: 'g',
          userId: 'u',
          moderatorId: 'm',
          action: 'warn',
          reason: null,
          createdAt: '2026-10-26T08:00:00.000Z',
          expiresAt: null,
        },
      ],
    }).toJSON();
    expect(embed.title).toBe('Cases for rama');
    expect(embed.description).toBe('**#7** warn · <t:1793001600:R> · by <@m>\nNo reason given');
    expect(embed.footer?.text).toBe('11 total');
  });

  it('says so when there are no cases', () => {
    const embed = casesEmbed({
      username: 'rama',
      page: { page: 1, pageCount: 1, total: 0, offset: 0, limit: 5 },
      cases: [],
    }).toJSON();
    expect(embed.description).toBe('No cases on record.');
  });

  it('is mounted as a page component', () => {
    expect(moderation.components).toContain(casePages);
  });
});
