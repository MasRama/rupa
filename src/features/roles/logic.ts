/** What the panel checks need to know about a role. */
export interface RoleInfo {
  id: string;
  name: string;
  position: number;
  managed: boolean;
}

/** Whether the bot can hand this role out: not @everyone, not managed, below its top role. */
export function canGive(role: RoleInfo, limits: { everyoneId: string; botTopPosition: number }) {
  return role.id !== limits.everyoneId && !role.managed && role.position < limits.botTopPosition;
}

/** Why these roles cannot go on a panel, or null when they can. */
export function panelProblem(
  roles: readonly RoleInfo[],
  limits: { everyoneId: string; botTopPosition: number },
): string | null {
  for (const role of roles) {
    if (role.id === limits.everyoneId) return '@everyone cannot be on a role panel.';
    if (role.managed) {
      return `${role.name} belongs to a bot or an integration, so nobody can be given it.`;
    }
    if (role.position >= limits.botTopPosition) {
      return `${role.name} is not below my highest role, so I cannot give it out. Move my role above it.`;
    }
  }
  return null;
}

/** Roles to add and remove so the member holds exactly the selected roles among those offered. */
export function roleChanges(input: {
  offered: readonly string[];
  selected: readonly string[];
  current: readonly string[];
}): { add: string[]; remove: string[] } {
  const selected = new Set(input.selected);
  const current = new Set(input.current);
  return {
    add: input.offered.filter(id => selected.has(id) && !current.has(id)),
    remove: input.offered.filter(id => current.has(id) && !selected.has(id)),
  };
}

const mentions = (ids: readonly string[]) => ids.map(id => `<@&${id}>`).join(', ');

/** The private answer after picking roles. */
export function changeSummary(input: {
  added: readonly string[];
  removed: readonly string[];
  skipped: readonly string[];
}): string {
  const parts: string[] = [];
  if (input.added.length > 0) parts.push(`Added ${mentions(input.added)}.`);
  if (input.removed.length > 0) parts.push(`Removed ${mentions(input.removed)}.`);
  if (parts.length === 0) parts.push('No changes.');
  if (input.skipped.length > 0) {
    parts.push(`Skipped ${mentions(input.skipped)}: I can no longer give it out.`);
  }
  return parts.join(' ');
}
