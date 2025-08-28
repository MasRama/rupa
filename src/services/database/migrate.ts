import { DatabaseService } from './DatabaseService';
import { logger } from '@/services/logger';
import { config } from '@/services/config';

async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');
    
    const db = DatabaseService.getInstance();
    await db.initialize(config.databasePath);
    
    await db.runMigrations();
    
    logger.info('Database migrations completed successfully');
    
    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error running migrations', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}