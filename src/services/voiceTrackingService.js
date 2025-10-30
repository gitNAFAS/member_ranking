import { VoiceSession } from '../models/VoiceSession.js';
import { VOICE_TRACKING_CONFIG, TIME_CONSTANTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const { MILLISECONDS_PER_SECOND } = TIME_CONSTANTS;

class VoiceTrackingService {
  constructor() {
    this.activeSessions = new Map();
  }

  isChannelEligible(channelId) {
    const { allowedChannels } = VOICE_TRACKING_CONFIG;
    return allowedChannels.length === 0 || allowedChannels.includes(channelId);
  }

  hasMinimumMembers(channel) {
    const nonBotMembers = channel.members.filter((member) => !member.user.bot);
    return nonBotMembers.size >= VOICE_TRACKING_CONFIG.minMembersRequired;
  }

  isUserMuted(state) {
    return state.selfMute || state.selfDeaf || state.serverMute || state.serverDeaf;
  }

  shouldTrackUser(state) {
    if (!state.channel) return false;
    if (!this.isChannelEligible(state.channelId)) return false;
    if (!this.hasMinimumMembers(state.channel)) return false;
    return true;
  }

  getSessionKey(guildId, userId) {
    return `${guildId}-${userId}`;
  }

  startSession(guildId, userId, state) {
    const sessionKey = this.getSessionKey(guildId, userId);
    const isMuted = this.isUserMuted(state);
    const isEligible = this.shouldTrackUser(state);
    const isTracking = isEligible && !isMuted;

    const session = {
      joinedAt: Date.now(),
      channelId: state.channelId,
      channelName: state.channel.name,
      isMuted,
      isTracking,
      lastUnmuteTime: isTracking ? Date.now() : null,
      accumulatedSeconds: 0,
    };

    this.activeSessions.set(sessionKey, session);

    logger.info(
      `User ${userId} joined ${state.channel.name} - ${isTracking ? 'TRACKING' : 'NOT TRACKING'}`
    );

    return session;
  }

  async endSession(guildId, userId, username) {
    const sessionKey = this.getSessionKey(guildId, userId);
    const session = this.activeSessions.get(sessionKey);

    if (!session) return null;

    const totalSeconds = this.calculateSessionDuration(session);

    if (totalSeconds > 0) {
      const sessionData = {
        joinedAt: new Date(session.joinedAt),
        leftAt: new Date(),
        duration: totalSeconds,
        channelId: session.channelId,
        channelName: session.channelName,
      };

      const voiceData = await VoiceSession.incrementTime(
        userId,
        guildId,
        username,
        totalSeconds,
        sessionData
      );

      logger.info(`User ${userId} session ended - Tracked: ${totalSeconds}s`);

      this.activeSessions.delete(sessionKey);
      return voiceData;
    }

    this.activeSessions.delete(sessionKey);
    return null;
  }

  calculateSessionDuration(session) {
    let totalSeconds = session.accumulatedSeconds;

    if (session.isTracking && session.lastUnmuteTime) {
      const additionalSeconds = Math.floor((Date.now() - session.lastUnmuteTime) / MILLISECONDS_PER_SECOND);
      totalSeconds += additionalSeconds;
    }

    return totalSeconds;
  }

  handleMuteChange(guildId, userId, oldState, newState) {
    const sessionKey = this.getSessionKey(guildId, userId);
    const session = this.activeSessions.get(sessionKey);

    if (!session) return;

    const wasMuted = this.isUserMuted(oldState);
    const isMuted = this.isUserMuted(newState);
    const isEligible = this.shouldTrackUser(newState);

    if (wasMuted && !isMuted) {
      session.isMuted = false;

      if (isEligible) {
        session.isTracking = true;
        session.lastUnmuteTime = Date.now();
        logger.info(`User ${userId} unmuted - Tracking started`);
      } else {
        session.isTracking = false;
        session.lastUnmuteTime = null;
        logger.info(`User ${userId} unmuted - Not eligible for tracking`);
      }
    } else if (!wasMuted && isMuted) {
      if (session.isTracking && session.lastUnmuteTime) {
        const duration = Math.floor((Date.now() - session.lastUnmuteTime) / MILLISECONDS_PER_SECOND);
        session.accumulatedSeconds += duration;
        logger.info(`User ${userId} muted - Tracked ${duration}s`);
      }

      session.isMuted = true;
      session.isTracking = false;
      session.lastUnmuteTime = null;
    }

    this.activeSessions.set(sessionKey, session);
  }

  handleMemberCountChange(channel) {
    if (!this.isChannelEligible(channel.id)) return;

    const hasEnough = this.hasMinimumMembers(channel);

    channel.members.forEach((member) => {
      if (member.user.bot) return;

      const sessionKey = this.getSessionKey(channel.guild.id, member.id);
      const session = this.activeSessions.get(sessionKey);

      if (!session || session.channelId !== channel.id) return;

      const wasTracking = session.isTracking;
      const shouldTrack = hasEnough && !session.isMuted;

      if (!wasTracking && shouldTrack) {
        session.isTracking = true;
        session.lastUnmuteTime = Date.now();
        logger.info(`User ${member.id} tracking started - Member threshold reached`);
      } else if (wasTracking && !shouldTrack) {
        if (session.lastUnmuteTime) {
          const duration = Math.floor((Date.now() - session.lastUnmuteTime) / MILLISECONDS_PER_SECOND);
          session.accumulatedSeconds += duration;
          logger.info(`User ${member.id} tracking paused - Below member threshold`);
        }
        session.isTracking = false;
        session.lastUnmuteTime = null;
      }

      this.activeSessions.set(sessionKey, session);
    });
  }

  async saveAllActiveSessions() {
    logger.info('Saving all active sessions...');

    const savePromises = Array.from(this.activeSessions.entries()).map(
      async ([sessionKey, session]) => {
        const [guildId, userId] = sessionKey.split('-');
        const totalSeconds = this.calculateSessionDuration(session);

        if (totalSeconds > 0) {
          try {
            const sessionData = {
              joinedAt: new Date(session.joinedAt),
              leftAt: new Date(),
              duration: totalSeconds,
              channelId: session.channelId,
              channelName: session.channelName,
            };

            await VoiceSession.incrementTime(userId, guildId, 'Unknown', totalSeconds, sessionData);
          } catch (error) {
            logger.error(`Failed to save session for ${userId}: ${error.message}`);
          }
        }
      }
    );

    await Promise.all(savePromises);
    this.activeSessions.clear();
    logger.info('All active sessions saved');
  }
}

export const voiceTrackingService = new VoiceTrackingService();
