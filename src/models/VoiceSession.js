import mongoose from 'mongoose';
import { TIME_CONSTANTS } from '../config/constants.js';

const { SECONDS_PER_MINUTE, SECONDS_PER_HOUR, SECONDS_PER_DAY } = TIME_CONSTANTS;

const sessionSchema = new mongoose.Schema(
  {
    joinedAt: {
      type: Date,
      required: true,
    },
    leftAt: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    channelId: {
      type: String,
      required: true,
    },
    channelName: {
      type: String,
    },
  },
  { _id: false }
);

const voiceSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    totalSeconds: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    sessions: [sessionSchema],
    currentSession: {
      joinedAt: Date,
      channelId: String,
      channelName: String,
      isMuted: {
        type: Boolean,
        default: true,
      },
      isTracking: {
        type: Boolean,
        default: false,
      },
      lastUnmuteTime: Date,
      accumulatedSeconds: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

voiceSessionSchema.index({ guildId: 1, userId: 1 }, { unique: true });
voiceSessionSchema.index({ guildId: 1, totalSeconds: -1 });

voiceSessionSchema.methods.formatTime = function () {
  const totalMinutes = Math.floor(this.totalSeconds / SECONDS_PER_MINUTE);
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
};

voiceSessionSchema.methods.getTotalHours = function () {
  return this.totalSeconds / SECONDS_PER_HOUR;
};

voiceSessionSchema.methods.calculateAverageSessionDuration = function () {
  if (this.sessions.length === 0) return 0;
  return Math.floor(this.totalSeconds / this.sessions.length);
};

voiceSessionSchema.statics.findByUser = async function (userId, guildId) {
  return this.findOne({ userId, guildId });
};

voiceSessionSchema.statics.getLeaderboard = async function (guildId, limit = 10, skip = 0) {
  const [users, total] = await Promise.all([
    this.find({ guildId, totalSeconds: { $gt: 0 } })
      .sort({ totalSeconds: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ guildId, totalSeconds: { $gt: 0 } }),
  ]);

  return { users, total };
};

voiceSessionSchema.statics.getRank = async function (userId, guildId) {
  const user = await this.findOne({ userId, guildId });
  if (!user) return null;

  const rank = await this.countDocuments({
    guildId,
    totalSeconds: { $gt: user.totalSeconds },
  });

  return rank + 1;
};

voiceSessionSchema.statics.incrementTime = async function (
  userId,
  guildId,
  username,
  seconds,
  sessionData = null
) {
  const update = {
    $inc: { totalSeconds: seconds },
    $set: { username },
  };

  if (sessionData) {
    update.$push = { sessions: sessionData };
  }

  return this.findOneAndUpdate({ userId, guildId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
};

export const VoiceSession = mongoose.model('VoiceSession', voiceSessionSchema);
