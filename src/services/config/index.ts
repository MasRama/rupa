export { ConfigService } from './ConfigService';
export type { AppConfig } from './ConfigService';

// Create a default config instance for convenience
export const config = ConfigService.getInstance();