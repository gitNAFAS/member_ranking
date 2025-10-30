import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../config/constants.js';

export const createEmbed = (type = 'info') => {
  const colorMap = {
    success: COLORS.success,
    error: COLORS.error,
    warning: COLORS.warning,
    info: COLORS.info,
    primary: COLORS.primary,
  };

  return new EmbedBuilder().setColor(colorMap[type] || COLORS.info).setTimestamp();
};

export const createErrorEmbed = (message) => {
  return createEmbed('error').setTitle('❌ Error').setDescription(message);
};

export const createSuccessEmbed = (message) => {
  return createEmbed('success').setTitle('✅ Success').setDescription(message);
};

export const createInfoEmbed = (message) => {
  return createEmbed('info').setDescription(message);
};
