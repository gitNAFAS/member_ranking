import { SlashCommandBuilder } from 'discord.js';
import { rankService } from '../services/rankService.js';
import { createEmbed } from '../utils/embedBuilder.js';

export const data = new SlashCommandBuilder()
  .setName('ranks')
  .setDescription('View all available voice time ranks and their requirements');

export async function execute(interaction) {
  const allRanks = rankService.getAllRanks();

  const rankList = allRanks
    .map((rank) => {
      return `${rank.emoji} **${rank.name}** (${rank.nameAr})\n└ Required: \`${rank.requiredHours}h\` of voice time`;
    })
    .join('\n\n');

  const embed = createEmbed('info')
    .setTitle('🎖️ Voice Time Ranks')
    .setDescription(
      'Earn roles by spending time in voice channels with your mic unmuted!\n\n' + rankList
    )
    .setFooter({ text: 'Roles are assigned automatically when you reach the required time' });

  await interaction.reply({ embeds: [embed] });
}
