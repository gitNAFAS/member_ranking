import { logger } from '../utils/logger.js';

export const name = 'ready';
export const once = true;

export async function execute(client) {
  logger.success(`Logged in as ${client.user.tag}`);
  logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
  logger.info(`Watching ${client.users.cache.size} user(s)`);
}
