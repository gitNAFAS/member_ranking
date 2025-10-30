import { SlashCommandBuilder } from 'discord.js';
import { VoiceSession } from '../models/VoiceSession.js';
import { rankService } from '../services/rankService.js';
import { createEmbed, createErrorEmbed } from '../utils/embedBuilder.js';
import { TIME_CONSTANTS } from '../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('time')
  .setDescription('Check voice chat time statistics')
  .addUserOption((option) =>
    option.setName('user').setDescription('The user to check (leave empty for yourself)')
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;
  const guildId = interaction.guild.id;

  try {
    const voiceData = await VoiceSession.findByUser(targetUser.id, guildId);

    if (!voiceData || voiceData.totalSeconds === 0) {
      const embed = createEmbed('warning')
        .setTitle('📊 Voice Time Statistics')
        .setDescription(
          `${targetUser} hasn't spent any tracked time in voice channels yet with their mic unmuted.`
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

      return await interaction.editReply({ embeds: [embed] });
    }

    const embed = await buildStatisticsEmbed(targetUser, voiceData, guildId, interaction.guild);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const errorEmbed = createErrorEmbed('Failed to fetch voice time statistics. Please try again.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function buildStatisticsEmbed(user, voiceData, guildId, guild) {
  const totalHours = voiceData.getTotalHours();
  const timeDisplay = formatDetailedTime(voiceData.totalSeconds);
  const rank = await VoiceSession.getRank(user.id, guildId);
  const totalUsers = await VoiceSession.countDocuments({ guildId, totalSeconds: { $gt: 0 } });
  const avgSessionDuration = voiceData.calculateAverageSessionDuration();
  const recentSessions = formatRecentSessions(voiceData.sessions);

  const currentRank = rankService.getCurrentRank(totalHours);
  const nextRank = rankService.getNextRank(totalHours);

  const embed = createEmbed('info')
    .setTitle('📊 Voice Time Statistics')
    .setDescription(`Voice activity stats for ${user}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '⏱️ Total Time (Unmuted)', value: timeDisplay, inline: false },
      { name: '🏆 Rank', value: `#${rank} of ${totalUsers}`, inline: true },
      { name: '📝 Total Sessions', value: `${voiceData.sessions.length}`, inline: true },
      {
        name: '📈 Average Session',
        value: formatDuration(avgSessionDuration),
        inline: true,
      }
    );

  if (currentRank) {
    embed.addFields({
      name: `${currentRank.emoji} Current Rank`,
      value: `**${currentRank.name}** (${currentRank.nameAr})`,
      inline: true,
    });
  }

  if (nextRank) {
    const progressBar = rankService.formatProgress(nextRank.progress);
    embed.addFields({
      name: `${nextRank.rank.emoji} Next Rank`,
      value: `**${nextRank.rank.name}** (${nextRank.rank.nameAr})\n${progressBar} ${Math.floor(nextRank.progress)}%\n\`${Math.floor(nextRank.hoursNeeded)}h needed\``,
      inline: true,
    });
  } else {
    embed.addFields({
      name: '⭐ Status',
      value: 'Max rank achieved!',
      inline: true,
    });
  }

  embed.addFields({
    name: '🕒 Recent Sessions',
    value: recentSessions,
    inline: false,
  });

  return embed;
}

function formatDetailedTime(totalSeconds) {
  const { SECONDS_PER_MINUTE, SECONDS_PER_HOUR, SECONDS_PER_DAY } = TIME_CONSTANTS;

  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `**${days}** days, **${remainingHours}** hours, **${minutes}** minutes`;
  }

  if (hours > 0) {
    return `**${hours}** hours, **${minutes}** minutes`;
  }

  if (minutes > 0) {
    return `**${minutes}** minutes, **${seconds}** seconds`;
  }

  return `**${seconds}** seconds`;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / TIME_CONSTANTS.SECONDS_PER_MINUTE);
  const secs = seconds % TIME_CONSTANTS.SECONDS_PER_MINUTE;
  return `${minutes}m ${secs}s`;
}

function formatRecentSessions(sessions) {
  const recent = sessions.slice(-5).reverse();

  if (recent.length === 0) {
    return 'No sessions recorded';
  }

  return recent
    .map((session) => {
      const duration = formatDuration(session.duration);
      const date = session.joinedAt.toLocaleDateString();
      return `\`${date}\` - ${session.channelName} - **${duration}**`;
    })
    .join('\n');
}
