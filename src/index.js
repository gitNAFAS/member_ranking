import { Client, Collection, GatewayIntentBits, REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import { environment } from './config/environment.js';
import { database } from './utils/database.js';
import { logger } from './utils/logger.js';
import { voiceTrackingService } from './services/voiceTrackingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class BotClient {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.client.commands = new Collection();
  }

  async initialize() {
    try {
      await database.connect(environment.mongoUri);
      await this.loadCommands();
      await this.loadEvents();
      await this.deployCommands();
      await this.login();
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
      process.exit(1);
    }
  }

  async loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const { data, execute } = await import(`./commands/${file}`);
      this.client.commands.set(data.name, { data, execute });
      logger.info(`Loaded command: ${data.name}`);
    }
  }

  async loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

    for (const file of eventFiles) {
      const event = await import(`./events/${file}`);
      const eventName = event.name || file.replace('.js', '');

      if (event.once) {
        this.client.once(eventName, (...args) => event.execute(...args));
      } else {
        this.client.on(eventName, (...args) => event.execute(...args));
      }

      logger.info(`Loaded event: ${eventName}`);
    }
  }

  async deployCommands() {
    try {
      const commands = Array.from(this.client.commands.values()).map((cmd) =>
        cmd.data.toJSON()
      );

      const rest = new REST().setToken(environment.token);

      logger.info(`Deploying ${commands.length} slash commands...`);

      await rest.put(Routes.applicationGuildCommands(environment.clientId, environment.guildId), {
        body: commands,
      });

      logger.success(`Successfully deployed ${commands.length} slash commands`);
    } catch (error) {
      logger.error(`Failed to deploy commands: ${error.message}`);
      throw error;
    }
  }

  async login() {
    await this.client.login(environment.token);
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await voiceTrackingService.saveAllActiveSessions();
        await database.disconnect();
        this.client.destroy();
        logger.success('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (error) => {
      logger.error(`Unhandled rejection: ${error.message}`);
    });

    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`);
      shutdown('UNCAUGHT_EXCEPTION');
    });
  }
}

const bot = new BotClient();
bot.initialize();
