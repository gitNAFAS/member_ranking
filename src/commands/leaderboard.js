import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { VoiceSession } from '../models/VoiceSession.js';
import { rankService } from '../services/rankService.js';
import { createEmbed, createErrorEmbed } from '../utils/embedBuilder.js';
import { LEADERBOARD_CONFIG, EMOJIS } from '../config/constants.js';

const { usersPerPage } = LEADERBOARD_CONFIG;
const { medal } = EMOJIS;

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the voice time leaderboard')
  .addIntegerOption((option) =>
    option.setName('page').setDescription('Page number to view').setMinValue(1)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const requestedPage = interaction.options.getInteger('page') || 1;
  const guildId = interaction.guild.id;

  try {
    await displayLeaderboard(interaction, guildId, requestedPage);
  } catch (error) {
    const errorEmbed = createErrorEmbed('Failed to fetch the leaderboard. Please try again.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function displayLeaderboard(interaction, guildId, page) {
  const skip = (page - 1) * usersPerPage;
  const { users, total } = await VoiceSession.getLeaderboard(guildId, usersPerPage, skip);

  if (users.length === 0) {
    const embed = createEmbed('warning')
      .setTitle('🏆 Voice Time Leaderboard')
      .setDescription(
        'No voice activity recorded yet. Start talking in voice channels to get on the leaderboard!'
      );

    return await interaction.editReply({ embeds: [embed] });
  }

  const totalPages = Math.ceil(total / usersPerPage);
  const leaderboardText = await buildLeaderboardText(interaction.guild, users, page);

  const embed = createEmbed('info')
    .setTitle('🏆 Voice Time Leaderboard')
    .setDescription(`Top users by voice activity (unmuted time)\n\n${leaderboardText}`)
    .setFooter({
      text: `Showing ${skip + 1}-${Math.min(skip + usersPerPage, total)} of ${total} users`,
    });

  const components =
    totalPages > 1 ? [createPaginationRow(page, totalPages)] : [];

  const response = await interaction.editReply({ embeds: [embed], components });

  if (components.length > 0) {
    handlePagination(response, interaction, guildId, page, totalPages);
  }
}

async function buildLeaderboardText(guild, users, currentPage) {
  const entries = await Promise.all(
    users.map(async (userData, index) => {
      const rank = (currentPage - 1) * usersPerPage + index + 1;
      const medalEmoji = getMedalForRank(rank);
      const userDisplay = await fetchUserDisplay(guild, userData);
      const timeDisplay = formatTime(userData.totalSeconds);
      const currentRank = rankService.getCurrentRank(userData.totalSeconds / 3600);
      const rankEmoji = currentRank ? currentRank.emoji : '';

      return `${medalEmoji} ${rankEmoji} ${userDisplay} - \`${timeDisplay}\``;
    })
  );

  return entries.join('\n');
}

function getMedalForRank(rank) {
  if (rank === 1) return medal.first;
  if (rank === 2) return medal.second;
  if (rank === 3) return medal.third;
  return `**${rank}.**`;
}

async function fetchUserDisplay(guild, userData) {
  try {
    const member = await guild.members.fetch(userData.userId);
    return member.user.tag;
  } catch {
    return userData.username;
  }
}

function formatTime(totalSeconds) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}d ${remainingHours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function createPaginationRow(currentPage, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('leaderboard_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId('leaderboard_page')
      .setLabel(`Page ${currentPage}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('leaderboard_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= totalPages)
  );
}

function handlePagination(response, interaction, guildId, initialPage, totalPages) {
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000,
  });

  let currentPage = initialPage;

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      return await buttonInteraction.reply({
        content: 'Use `/leaderboard` to view the leaderboard yourself!',
        ephemeral: true,
      });
    }

    await buttonInteraction.deferUpdate();

    if (buttonInteraction.customId === 'leaderboard_prev') {
      currentPage--;
    } else if (buttonInteraction.customId === 'leaderboard_next') {
      currentPage++;
    }

    const skip = (currentPage - 1) * usersPerPage;
    const { users, total } = await VoiceSession.getLeaderboard(guildId, usersPerPage, skip);

    const leaderboardText = await buildLeaderboardText(interaction.guild, users, currentPage);

    const embed = createEmbed('info')
      .setTitle('🏆 Voice Time Leaderboard')
      .setDescription(`Top users by voice activity (unmuted time)\n\n${leaderboardText}`)
      .setFooter({
        text: `Showing ${skip + 1}-${Math.min(skip + usersPerPage, total)} of ${total} users`,
      });

    const row = createPaginationRow(currentPage, totalPages);

    await buttonInteraction.editReply({ embeds: [embed], components: [row] });
  });

  collector.on('end', () => {
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('disabled_prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('disabled_page')
        .setLabel(`Page ${currentPage}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('disabled_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    interaction.editReply({ components: [disabledRow] }).catch(() => {});
  });
}
