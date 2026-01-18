
export const WORLD_SIZE = 5000;
export const SHAPE_COUNT = 400;
export const BOT_COUNT = 24; // Increased for more intense team battles
export const BOSS_COUNT = 0; // Removed boss as requested
export const CENTER_ZONE_SIZE = 1200;
export const BASE_SIZE = 800; // Larger base zones like in the image

export const COLORS = {
  BACKGROUND: '#cdcdcd',
  VOID: '#8a8a8a', 
  GRID: '#c0c0c0',
  PLAYER: '#00b2e1',
  TEAM_BLUE: '#00b2e1',
  TEAM_RED: '#f14e54',
  BOT: '#f14e54',
  BOSS: '#ffe869',
  BOSS_BARREL: '#999999',
  SHAPE_SQUARE: '#ffe869',
  SHAPE_TRIANGLE: '#fc7677',
  SHAPE_PENTAGON: '#768dfc',
  SHAPE_HEXAGON: '#76fc9b',
  SHAPE_ALPHA: '#9b76fc',
  BULLET: '#00b2e1',
  HP_BAR_BG: '#555555',
  HP_BAR_FILL: '#85e37d',
  // Updated base colors to be more solid/defined like the reference
  BASE_BLUE: '#11b2e1aa', 
  BASE_RED: '#f14e54aa'
};

export const XP_REQUIREMENTS = Array.from({ length: 60 }, (_, i) => Math.floor(Math.pow(i + 1, 2.6) * 12));

export const BOT_NAMES = [
  "Crasher", "Fighter", "Guardian", "Stalker", "Nemesis", 
  "Hunter", "Gladiator", "Titan", "Phantom", "Slayer",
  "Raptor", "Viper", "Goliath", "Specter", "Warlord"
];
