import { defineFeature } from '@/core';
import { rolesCommand } from './commands/roles';
import { openPicker, pickRoles } from './components/picker';
import { migrations } from './migrations';

/**
 * Self-assignable roles: `/roles panel` posts a panel, and members pick their
 * roles from a private menu that shows what they already have.
 */
export const roles = defineFeature({
  name: 'roles',
  commands: [rolesCommand],
  components: [openPicker, pickRoles],
  migrations,
});
