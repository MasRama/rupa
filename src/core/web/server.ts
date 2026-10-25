import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import type { Logger } from '@/core/logging';
import type { WebEnv } from './types';

export interface WebServer {
  close(): Promise<void>;
}

/** Serves the app on `port` (all interfaces) until `close()`. */
export function startWebServer(app: Hono<WebEnv>, port: number, logger: Logger): WebServer {
  const server = serve({ fetch: app.fetch, port }, info => {
    logger.info({ port: info.port }, 'Dashboard listening');
  });
  return {
    close: () =>
      new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  };
}
