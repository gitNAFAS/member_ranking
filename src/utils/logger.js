import { environment } from '../config/environment.js';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class Logger {
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  info(message) {
    const formatted = this.formatMessage('INFO', message);
    console.log(`${COLORS.blue}${formatted}${COLORS.reset}`);
  }

  success(message) {
    const formatted = this.formatMessage('SUCCESS', message);
    console.log(`${COLORS.green}${formatted}${COLORS.reset}`);
  }

  warn(message) {
    const formatted = this.formatMessage('WARN', message);
    console.warn(`${COLORS.yellow}${formatted}${COLORS.reset}`);
  }

  error(message) {
    const formatted = this.formatMessage('ERROR', message);
    console.error(`${COLORS.red}${formatted}${COLORS.reset}`);
  }

  debug(message) {
    if (environment.isDevelopment) {
      const formatted = this.formatMessage('DEBUG', message);
      console.log(`${COLORS.magenta}${formatted}${COLORS.reset}`);
    }
  }
}

export const logger = new Logger();
