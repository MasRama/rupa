import { defineFeature } from '@/core';
import { registerDashboard } from './web/routes';

/**
 * Web pages for the dashboard: sign-in, your servers, usage per server with
 * every feature's settings, and an all-servers overview for bot owners.
 * Only active when DASHBOARD_PORT is set.
 */
export const dashboard = defineFeature({
  name: 'dashboard',
  web: registerDashboard,
});
