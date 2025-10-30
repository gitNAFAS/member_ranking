import mongoose from 'mongoose';
import { logger } from './logger.js';

class Database {
  constructor() {
    this.connection = null;
  }

  async connect(uri) {
    try {
      const options = {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.connection = await mongoose.connect(uri, options);

      logger.success('Database connected successfully');

      mongoose.connection.on('error', (error) => {
        logger.error(`Database error: ${error.message}`);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('Database disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.success('Database reconnected');
      });

      return this.connection;
    } catch (error) {
      logger.error(`Database connection failed: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      logger.info('Database disconnected gracefully');
    }
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

export const database = new Database();
