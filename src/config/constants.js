export const VOICE_RANKS = [
  {
    id: 'supporter',
    name: 'Supporter',
    nameAr: 'متعاطف',
    emoji: '⭐',
    requiredHours: 1,
    roleId: null,
  },
  {
    id: 'contributor',
    name: 'Contributor',
    nameAr: 'مشارك',
    emoji: '🤝',
    requiredHours: 48,
    roleId: null,
  },
  {
    id: 'proposer',
    name: 'Proposer',
    nameAr: 'مقترح',
    emoji: '💡',
    requiredHours: 72,
    roleId: null,
  },
  {
    id: 'voter',
    name: 'Voter',
    nameAr: 'مصوّت',
    emoji: '🗳️',
    requiredHours: 96,
    roleId: null,
  },
];

export const VOICE_TRACKING_CONFIG = {
  allowedChannels: [],
  minMembersRequired: 3,
  saveInterval: 300000,
};

export const LEADERBOARD_CONFIG = {
  usersPerPage: 10,
  cacheTimeout: 60000,
};

export const COLORS = {
  success: 0x00ff00,
  error: 0xff0000,
  info: 0x0099ff,
  warning: 0xffaa00,
  primary: 0x5865f2,
};

export const EMOJIS = {
  success: '✅',
  error: '❌',
  loading: '⏳',
  info: 'ℹ️',
  medal: {
    first: '🥇',
    second: '🥈',
    third: '🥉',
  },
};

export const TIME_CONSTANTS = {
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_DAY: 86400,
  MILLISECONDS_PER_SECOND: 1000,
};
