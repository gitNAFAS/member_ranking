import { voiceTrackingService } from '../services/voiceTrackingService.js';
import { rankService } from '../services/rankService.js';
import { logger } from '../utils/logger.js';

export const name = 'voiceStateUpdate';

export async function execute(oldState, newState) {
  const member = newState.member || oldState.member;

  if (!member || member.user.bot) {
    return;
  }

  const userId = member.id;
  const guildId = newState.guild.id;
  const username = member.user.username;

  try {
    await handleVoiceStateChange(oldState, newState, userId, guildId, username);
  } catch (error) {
    logger.error(`Voice state update error for ${username}: ${error.message}`);
  }
}

async function handleVoiceStateChange(oldState, newState, userId, guildId, username) {
  const userJoined = !oldState.channelId && newState.channelId;
  const userLeft = oldState.channelId && !newState.channelId;
  const userSwitched =
    oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
  const muteChanged =
    oldState.selfMute !== newState.selfMute ||
    oldState.selfDeaf !== newState.selfDeaf ||
    oldState.serverMute !== newState.serverMute ||
    oldState.serverDeaf !== newState.serverDeaf;

  if (userJoined) {
    voiceTrackingService.startSession(guildId, userId, newState);
  } else if (userLeft) {
    const voiceData = await voiceTrackingService.endSession(guildId, userId, username);

    if (voiceData) {
      const totalHours = voiceData.getTotalHours();
      await rankService.assignRoles(newState.guild, userId, totalHours);
    }

    if (oldState.channel) {
      voiceTrackingService.handleMemberCountChange(oldState.channel);
    }
  } else if (userSwitched) {
    await voiceTrackingService.endSession(guildId, userId, username);
    voiceTrackingService.startSession(guildId, userId, newState);

    if (oldState.channel) {
      voiceTrackingService.handleMemberCountChange(oldState.channel);
    }
    if (newState.channel) {
      voiceTrackingService.handleMemberCountChange(newState.channel);
    }
  } else if (muteChanged) {
    voiceTrackingService.handleMuteChange(guildId, userId, oldState, newState);
  } else if (oldState.channel && newState.channel) {
    voiceTrackingService.handleMemberCountChange(newState.channel);
  }
}
