import { config } from 'dotenv';

config();

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const environment = {
  token: getRequiredEnv('DISCORD_TOKEN'),
  clientId: getRequiredEnv('CLIENT_ID'),
  guildId: getRequiredEnv('GUILD_ID'),
  mongoUri: getRequiredEnv('MONGODB_URI'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
};
