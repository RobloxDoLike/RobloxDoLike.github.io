
export enum ShapeType {
  SQUARE = 'SQUARE',
  TRIANGLE = 'TRIANGLE',
  PENTAGON = 'PENTAGON',
  HEXAGON = 'HEXAGON',
  ALPHA_PENTAGON = 'ALPHA_PENTAGON'
}

export enum TankClass {
  BASIC = 'BASIC',
  TWIN = 'TWIN',
  SNIPER = 'SNIPER',
  MACHINE_GUN = 'MACHINE_GUN',
  FLANK_GUARD = 'FLANK_GUARD',
  TRIPLET = 'TRIPLET',
  ASSASSIN = 'ASSASSIN',
  DESTROYER = 'DESTROYER',
  OVERSEER = 'OVERSEER',
  NECROMANCER = 'NECROMANCER',
  CHIEF_NECROMANCER = 'CHIEF_NECROMANCER',
  PENTA_SHOT = 'PENTA_SHOT',
  STALKER = 'STALKER',
  HYBRID = 'HYBRID',
  ARENA_CLOSER = 'ARENA_CLOSER'
}

export enum GameMode {
  FFA = 'FFA',
  TEAMS = 'TEAMS',
  MAZE = 'MAZE'
}

export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector;
  vel: Vector;
  radius: number;
  hp: number;
  maxHp: number;
  color: string;
  team?: number;
}

export interface Shape extends Entity {
  type: ShapeType;
  rotation: number;
  rotSpeed: number;
  exp: number;
  damageRecord: Record<string, number>; // Maps ownerId to damage dealt
}

export interface Bullet extends Entity {
  ownerId: string;
  damage: number;
  lifeTime: number;
}

export interface Bot extends Entity {
  name: string;
  angle: number;
  tankClass: TankClass;
  lastFire: number;
  score: number;
  level: number;
  targetId: string | null;
  stats: Stats;
}

export interface Boss extends Entity {
  name: string;
  angle: number;
  bossType: 'NECROMANCER' | 'GUARDIAN' | 'DEFENDER';
  lastFire: number;
}

export interface Stats {
  regen: number;
  maxHp: number;
  bodyDamage: number;
  bulletSpeed: number;
  bulletPen: number;
  bulletDamage: number;
  reload: number;
  moveSpeed: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  isPlayer: boolean;
}