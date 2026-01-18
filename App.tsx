import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ShapeType, TankClass, Vector, Shape, Bullet, Stats, Bot, LeaderboardEntry, Boss, GameMode, Entity } from './types';
import { WORLD_SIZE, SHAPE_COUNT, COLORS, XP_REQUIREMENTS, BOT_COUNT, BOT_NAMES, CENTER_ZONE_SIZE, BOSS_COUNT, BASE_SIZE } from './constants';

const EVOLUTION_TREE: Record<TankClass, TankClass[]> = {
  [TankClass.BASIC]: [TankClass.TWIN, TankClass.SNIPER, TankClass.MACHINE_GUN, TankClass.FLANK_GUARD],
  [TankClass.TWIN]: [TankClass.TRIPLET, TankClass.PENTA_SHOT],
  [TankClass.SNIPER]: [TankClass.ASSASSIN, TankClass.OVERSEER],
  [TankClass.MACHINE_GUN]: [TankClass.DESTROYER, TankClass.HYBRID],
  [TankClass.OVERSEER]: [TankClass.NECROMANCER],
  [TankClass.NECROMANCER]: [TankClass.CHIEF_NECROMANCER],
  [TankClass.FLANK_GUARD]: [TankClass.STALKER],
  [TankClass.TRIPLET]: [], [TankClass.ASSASSIN]: [], [TankClass.DESTROYER]: [], [TankClass.CHIEF_NECROMANCER]: [],
  [TankClass.PENTA_SHOT]: [], [TankClass.STALKER]: [], [TankClass.HYBRID]: [], [TankClass.ARENA_CLOSER]: []
};

const UPGRADE_GRID_COLORS = ['#72d2c5', '#91ff4b', '#f14e54', '#ffe869'];

// Cores pastéis estilo Diep.io original
const STAT_COLORS: Record<keyof Stats, string> = {
  regen: '#ffb48f',       // Laranja pastel
  maxHp: '#ff77ff',       // Rosa choque pastel
  bodyDamage: '#9a77ff',  // Roxo pastel
  bulletSpeed: '#77b4ff', // Azul pastel
  bulletPen: '#ffeb77',   // Amarelo pastel
  bulletDamage: '#ff7777',// Vermelho pastel
  reload: '#9aff77',      // Verde pastel
  moveSpeed: '#77ffff'    // Ciano pastel
};

const STAT_LABELS: Record<keyof Stats, string> = {
  regen: 'Health Regen',
  maxHp: 'Max Health',
  bodyDamage: 'Body Damage',
  bulletSpeed: 'Bullet Speed',
  bulletPen: 'Bullet Penetration',
  bulletDamage: 'Bullet Damage',
  reload: 'Reload',
  moveSpeed: 'Movement Speed'
};

const getDynamicStatLabel = (key: keyof Stats, tankClass: TankClass): string => {
  const isDroneClass = [TankClass.OVERSEER, TankClass.NECROMANCER, TankClass.CHIEF_NECROMANCER].includes(tankClass);
  
  if (isDroneClass) {
    if (key === 'bulletDamage') return 'Drone Damage';
    if (key === 'bulletPen') return 'Drone Health';
    if (key === 'bulletSpeed') return 'Drone Speed';
    if (key === 'reload') return 'Drone Reload';
  }
  return STAT_LABELS[key];
};

interface LearningBot extends Bot {
  intelligence: number;
  learningRate: number;
  wanderAngle: number; // Para movimento aleatório
}

interface Minion extends Entity {
  ownerId: string;
  minionType: 'SQUARE' | 'TANK';
  targetPos: Vector;
  damage: number;
  speed: number;
  angle: number;
  lastFire: number;
  stats: Stats; // Snapshot of stats for shooting
}

interface ColoredLeaderboardEntry extends LeaderboardEntry {
  teamColor: string;
}

const TankPreview: React.FC<{ tankClass: TankClass; color: string; size?: number }> = ({ tankClass, color, size = 80 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 8);

    ctx.fillStyle = '#999';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;

    const scale = size / 80;
    const drawBarrel = (w: number, h: number, ox = 0, oy = 0, rot = 0) => {
      ctx.save();
      ctx.rotate(rot);
      ctx.fillRect(ox * scale, (-h / 2 + oy) * scale, w * scale, h * scale);
      ctx.strokeRect(ox * scale, (-h / 2 + oy) * scale, w * scale, h * scale);
      ctx.restore();
    };

    const r = 12 * scale;

    if (tankClass === TankClass.TWIN) {
      drawBarrel(25, 10, 0, -7); drawBarrel(25, 10, 0, 7);
    } else if (tankClass === TankClass.SNIPER) {
      drawBarrel(35, 10);
    } else if (tankClass === TankClass.MACHINE_GUN) {
      drawBarrel(25, 14);
    } else if (tankClass === TankClass.FLANK_GUARD) {
      drawBarrel(25, 10); drawBarrel(25, 10, -25, 0, Math.PI);
    } else if (tankClass === TankClass.TRIPLET) {
      drawBarrel(22, 9, 0, -10); drawBarrel(22, 9, 0, 10); drawBarrel(26, 9, 0, 0);
    } else if (tankClass === TankClass.PENTA_SHOT) {
      for(let i=-2; i<=2; i++) drawBarrel(25, 10, 0, 0, i * 0.4);
    } else if (tankClass === TankClass.ARENA_CLOSER) {
      drawBarrel(35, 18, 0, 0);
    } else if (tankClass === TankClass.NECROMANCER) {
      drawBarrel(35, 35, 0, 0); // Square drone spawner look
    } else if (tankClass === TankClass.CHIEF_NECROMANCER) {
      drawBarrel(45, 45, 0, 0); // Bigger square drone spawner
    } else if (tankClass === TankClass.OVERSEER) {
      drawBarrel(30, 15, 0, 10, 0.4); drawBarrel(30, 15, 0, -10, -0.4);
    } else {
      drawBarrel(25, 10);
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [tankClass, color, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="pointer-events-none" />;
};

// --- Evolution Tree Component ---
const EvolutionTreeOverlay: React.FC<{ onClose: () => void; onSelect: (t: TankClass) => void }> = ({ onClose, onSelect }) => {
  const TIER_1 = [TankClass.TWIN, TankClass.SNIPER, TankClass.MACHINE_GUN, TankClass.FLANK_GUARD];
  const BRANCH_COLORS = ['#91ff4b', '#f14e54', '#72d2c5', '#ffe869']; // Twin(Green), Sniper(Red), Machine(Cyan), Flank(Yellow)

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderBranch = (root: TankClass, startAngle: number, depth: number, color: string) => {
    const nodes = [];
    const children = EVOLUTION_TREE[root] || [];
    
    // Render current node
    const dist = depth * 160; // Distance from center
    const x = dist * Math.cos(startAngle * Math.PI / 180);
    const y = dist * Math.sin(startAngle * Math.PI / 180);

    // Style for the node
    const nodeStyle: React.CSSProperties = {
      left: `calc(50% + ${x}px)`,
      top: `calc(50% + ${y}px)`,
    };

    nodes.push(
      <div 
        key={root} 
        className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer" 
        style={nodeStyle}
        onClick={(e) => { e.stopPropagation(); onSelect(root); }}
        onMouseDown={(e) => e.stopPropagation()} // Prevent dragging when clicking node
      >
        <div className="rounded-full border-[3px] border-[#555] bg-[#cdcdcd] shadow-lg overflow-hidden hover:scale-110 transition-transform duration-200 active:scale-95" style={{ width: 70, height: 70 }}>
           <TankPreview tankClass={root} color={color} size={70} />
        </div>
        <span className="mt-1 text-white font-bold text-[9px] uppercase bg-black/60 px-2 py-0.5 rounded-full whitespace-nowrap">{root}</span>
      </div>
    );
    
    // Render children
    if (children.length > 0) {
      const spread = 40 / depth; // Angle spread
      const startChildAngle = startAngle - (spread * (children.length - 1)) / 2;
      children.forEach((child, i) => {
        const childAngle = startChildAngle + i * spread;
        nodes.push(...renderBranch(child, childAngle, depth + 1, color));
        
        const childDist = (depth + 1) * 160;
        const childX = childDist * Math.cos(childAngle * Math.PI / 180);
        const childY = childDist * Math.sin(childAngle * Math.PI / 180);

        nodes.push(
          <svg key={`line-${root}-${child}`} className="absolute left-1/2 top-1/2 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
            <line x1={x} y1={y} x2={childX} y2={childY} stroke={color} strokeWidth="3" opacity="0.6" />
          </svg>
        );
      });
    }
    return nodes;
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-900/90 z-50 flex items-center justify-center backdrop-blur-md animate-fade-in overflow-hidden cursor-move" 
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
       <div 
         className="relative w-full h-full flex items-center justify-center transition-transform duration-75 ease-linear"
         style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
       >
          {/* Center BASIC Node */}
          <div 
            className="absolute z-30 flex flex-col items-center transform scale-125 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onSelect(TankClass.BASIC); }}
            onMouseDown={(e) => e.stopPropagation()}
          >
             <div className="rounded-full border-[4px] border-[#555] bg-[#cdcdcd] shadow-2xl overflow-hidden active:scale-95 transition-transform" style={{ width: 80, height: 80 }}>
                <TankPreview tankClass={TankClass.BASIC} color={COLORS.TEAM_BLUE} size={80} />
             </div>
             <span className="mt-1 text-white font-black text-xs uppercase bg-black/60 px-3 rounded-full">BASIC</span>
          </div>

          {/* Render 4 Main Branches */}
          {TIER_1.map((root, i) => {
             // Angles: -135 (TL), -45 (TR), 45 (BR), 135 (BL)
             const angle = -135 + (i * 90); 
             return (
               <React.Fragment key={`branch-${i}`}>
                 {renderBranch(root, angle, 1, BRANCH_COLORS[i])}
                 {/* Connection from Basic to Tier 1 */}
                 <svg className="absolute left-1/2 top-1/2 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
                    <line x1={0} y1={0} x2={160 * Math.cos(angle * Math.PI / 180)} y2={160 * Math.sin(angle * Math.PI / 180)} stroke={BRANCH_COLORS[i]} strokeWidth="4" opacity="0.8" />
                 </svg>
               </React.Fragment>
             );
          })}
       </div>
       <div className="absolute bottom-10 text-white/50 font-black text-xl animate-pulse select-none pointer-events-none">PRESS 'Y' TO CLOSE</div>
    </div>
  );
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [points, setPoints] = useState(0);
  const [tankClass, setTankClass] = useState<TankClass>(TankClass.BASIC);
  const [playerName, setPlayerName] = useState('Player');
  const [selectedTeam, setSelectedTeam] = useState<1 | 2>(1);
  const [leaderboard, setLeaderboard] = useState<ColoredLeaderboardEntry[]>([]);
  const [teamScores, setTeamScores] = useState({ blue: 0, red: 0 });
  const [showTree, setShowTree] = useState(false);
  const [isStatsHovered, setIsStatsHovered] = useState(false);
  
  const cameraRef = useRef({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 });
  const themeColor = selectedTeam === 1 ? COLORS.TEAM_BLUE : COLORS.TEAM_RED;
  const themeBorder = selectedTeam === 1 ? 'border-blue-500' : 'border-red-500';
  const themeBg = selectedTeam === 1 ? 'bg-blue-500' : 'bg-red-500';
  const themeText = selectedTeam === 1 ? 'text-blue-600' : 'text-red-600';

  const initialStats: Stats = {
    regen: 0, maxHp: 0, bodyDamage: 0, bulletSpeed: 0, 
    bulletPen: 0, bulletDamage: 0, reload: 0, moveSpeed: 0
  };

  const [stats, setStats] = useState<Stats>(initialStats);
  const playerRef = useRef({
    id: 'player', pos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }, vel: { x: 0, y: 0 }, angle: 0, hp: 100, maxHp: 100, radius: 20, lastFire: 0, score: 0, team: 1 as 1 | 2
  });

  const keys = useRef<Record<string, boolean>>({});
  const mouse = useRef({ x: 0, y: 0 });
  const shapesRef = useRef<Shape[]>([]);
  const botsRef = useRef<LearningBot[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const minionsRef = useRef<Minion[]>([]); // Minions for Necromancer/Overseer
  const animationFrameRef = useRef<number>(null!);
  const lastActivityRef = useRef<number>(Date.now());

  const resetServer = useCallback(() => {
    shapesRef.current = [];
    botsRef.current = [];
    bulletsRef.current = [];
    minionsRef.current = [];
    setGameState('START');
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const checkActivity = setInterval(() => {
      if (gameState === 'START' && Date.now() - lastActivityRef.current > 60000) {
        resetServer();
      }
    }, 10000);
    return () => clearInterval(checkActivity);
  }, [gameState, resetServer]);

  const createRandomShape = (inCenter = false): Shape => {
    let type = ShapeType.SQUARE;
    let radius = 15, hp = 15, color = COLORS.SHAPE_SQUARE, exp = 25;
    const rand = Math.random();
    if (inCenter || rand > 0.85) {
      if (rand > 0.98) { type = ShapeType.ALPHA_PENTAGON; radius = 60; hp = 1000; color = COLORS.SHAPE_ALPHA; exp = 3000; }
      else { type = ShapeType.PENTAGON; radius = 25; hp = 120; color = COLORS.SHAPE_PENTAGON; exp = 150; }
    } else if (rand > 0.7) { type = ShapeType.HEXAGON; radius = 22; hp = 70; color = COLORS.SHAPE_HEXAGON; exp = 100; }
    else if (rand > 0.45) { type = ShapeType.TRIANGLE; radius = 18; hp = 40; color = COLORS.SHAPE_TRIANGLE; exp = 45; }
    
    let pos: Vector;
    do {
      pos = inCenter ? { x: WORLD_SIZE/2 - CENTER_ZONE_SIZE/2 + Math.random() * CENTER_ZONE_SIZE, y: WORLD_SIZE/2 - CENTER_ZONE_SIZE/2 + Math.random() * CENTER_ZONE_SIZE } : { x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE };
    } while (pos.x < BASE_SIZE || pos.x > WORLD_SIZE - BASE_SIZE);
    
    return { 
      id: Math.random().toString(36).substr(2, 9), 
      pos, 
      vel: { x: (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.2 }, 
      radius, 
      hp, 
      maxHp: hp, 
      color, 
      type, 
      exp, 
      rotation: Math.random() * Math.PI * 2, 
      rotSpeed: (Math.random() - 0.5) * 0.02,
      damageRecord: {} 
    };
  };

  const createBot = (): LearningBot => {
    const team = Math.random() > 0.5 ? 1 : 2;
    const pos = team === 1 ? { x: Math.random() * BASE_SIZE, y: Math.random() * WORLD_SIZE } : { x: WORLD_SIZE - Math.random() * BASE_SIZE, y: Math.random() * WORLD_SIZE };
    return {
      id: 'bot-' + Math.random().toString(36).substr(2, 9),
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      pos, vel: { x: 0, y: 0 }, radius: 20, hp: 100, maxHp: 100,
      color: team === 1 ? COLORS.TEAM_BLUE : COLORS.TEAM_RED, team,
      angle: 0, tankClass: TankClass.BASIC, lastFire: 0, score: 0, level: 1, targetId: null,
      // Bots mais lentos e menos agressivos
      stats: { regen: 1, maxHp: 1, bodyDamage: 1, bulletSpeed: 2, bulletPen: 2, bulletDamage: 2, reload: 2, moveSpeed: 1 }, 
      intelligence: Math.floor(Math.random() * 20),
      learningRate: 0.05,
      wanderAngle: Math.random() * Math.PI * 2
    };
  };

  const addXP = useCallback((amount: number) => {
    setXp(prev => {
      const nextXp = prev + amount;
      let currentLevel = level;
      let newPoints = points;
      while (currentLevel < 60 && nextXp >= XP_REQUIREMENTS[currentLevel - 1]) {
        currentLevel++;
        if (currentLevel % 2 === 0 || currentLevel < 10) newPoints += 1;
      }
      if (currentLevel !== level) { setLevel(currentLevel); setPoints(newPoints); }
      return nextXp;
    });
  }, [level, points]);

  const fireBullet = (entity: any, type: 'PLAYER' | 'BOT' | 'MINION', angleOffset = 0, speedMult = 1) => {
    const eStats = type === 'PLAYER' ? stats : entity.stats;
    const bulletSpeed = (5.0 + eStats.bulletSpeed * 0.7) * speedMult;
    
    // For minions, use a slightly different ID generation or logic if needed
    const bullet: Bullet = {
      id: Math.random().toString(36).substr(2, 9),
      ownerId: entity.id,
      pos: { ...entity.pos },
      vel: {
        x: Math.cos(entity.angle + angleOffset) * bulletSpeed,
        y: Math.sin(entity.angle + angleOffset) * bulletSpeed
      },
      radius: (entity.tankClass === TankClass.DESTROYER ? 15 : (type === 'MINION' ? 6 : 8)),
      hp: (1 + eStats.bulletPen * 1.5),
      maxHp: (1 + eStats.bulletPen * 1.5),
      color: (type === 'PLAYER' ? themeColor : entity.color),
      damage: (8 + eStats.bulletDamage * 3.5),
      lifeTime: type === 'MINION' ? 80 : 120, // Minion bullets expire faster
      team: entity.team
    };
    bulletsRef.current.push(bullet);
  };

  const spawnMinion = (entity: any, type: 'PLAYER' | 'BOT') => {
    const eStats = type === 'PLAYER' ? stats : entity.stats;
    const minionLimit = 8;
    const currentMinions = minionsRef.current.filter(m => m.ownerId === entity.id);
    const reloadTime = (850 / (1 + (eStats?.reload || 0) * 0.7)); // Reuse reload for spawn rate
    const tc = type === 'PLAYER' ? tankClass : entity.tankClass;
    
    const isChief = tc === TankClass.CHIEF_NECROMANCER;

    if (currentMinions.length < minionLimit && Date.now() - entity.lastFire > reloadTime) {
      const minionType = isChief ? 'TANK' : 'SQUARE';
      
      const minion: Minion = {
        id: `minion-${entity.id}-${Date.now()}`,
        ownerId: entity.id,
        minionType: minionType,
        pos: { x: entity.pos.x + (Math.random()-0.5)*10, y: entity.pos.y + (Math.random()-0.5)*10 },
        vel: { x: 0, y: 0 },
        radius: isChief ? 15 : 12, // Tank minion is slightly bigger
        hp: 10 + (eStats.bulletPen * 4), // HP scales with Penetration (Drone Health)
        maxHp: 10 + (eStats.bulletPen * 4),
        damage: 2 + (eStats.bulletDamage * 2), // Damage (Collision damage)
        color: type === 'PLAYER' ? themeColor : entity.color,
        speed: 3 + (eStats.bulletSpeed * 0.5), // Speed scales with Bullet Speed (Drone Speed)
        team: entity.team,
        targetPos: { x: 0, y: 0 },
        angle: 0,
        lastFire: 0,
        stats: { ...eStats } // Pass stats for shooting logic
      };
      minionsRef.current.push(minion);
      entity.lastFire = Date.now();
    }
  };

  const processFiring = (entity: any, type: 'PLAYER' | 'BOT') => {
    const now = Date.now();
    let eStats = type === 'PLAYER' ? stats : entity.stats;
    const reloadTime = (850 / (1 + (eStats?.reload || 0) * 0.7));
    const tc = type === 'PLAYER' ? tankClass : entity.tankClass;

    if (tc === TankClass.NECROMANCER || tc === TankClass.CHIEF_NECROMANCER) {
      spawnMinion(entity, type);
      return;
    }

    if (now - entity.lastFire > reloadTime) {
      switch(tc) {
        case TankClass.TWIN: fireBullet(entity, type, -0.2); fireBullet(entity, type, 0.2); break;
        case TankClass.TRIPLET: fireBullet(entity, type, -0.3); fireBullet(entity, type, 0); fireBullet(entity, type, 0.3); break;
        case TankClass.FLANK_GUARD: fireBullet(entity, type, 0); fireBullet(entity, type, Math.PI); break;
        case TankClass.SNIPER: fireBullet(entity, type, 0, 1.4); break;
        case TankClass.MACHINE_GUN: fireBullet(entity, type, (Math.random() - 0.5) * 0.8); break;
        case TankClass.PENTA_SHOT: for(let i=-2; i<=2; i++) fireBullet(entity, type, i*0.4); break;
        case TankClass.DESTROYER: fireBullet(entity, type, 0, 0.5); break;
        default: fireBullet(entity, type);
      }
      entity.lastFire = now;
    }
  };

  const addDamage = (shape: Shape, attackerId: string, amount: number) => {
    if (!shape.damageRecord[attackerId]) {
      shape.damageRecord[attackerId] = 0;
    }
    shape.damageRecord[attackerId] += amount;
  };

  const handleScoreDistribution = (shape: Shape) => {
    const records = shape.damageRecord;
    const attackerIds = Object.keys(records);
    if (attackerIds.length === 0) return;

    // Sort by damage dealt descending
    attackerIds.sort((a, b) => records[b] - records[a]);

    const topAttackerId = attackerIds[0];
    const totalXP = shape.exp;

    // 60% to top damage dealer
    const mainShare = Math.floor(totalXP * 0.6);
    
    // Distribute main share
    if (topAttackerId === 'player') {
      addXP(mainShare);
      playerRef.current.score += mainShare;
    } else {
      const bot = botsRef.current.find(b => b.id === topAttackerId);
      if (bot) bot.score += mainShare;
    }

    // Remaining 40% distributed proportionally among ALL contributors (including top one for their share of the remainder)
    // Or as per request: "rest divides 40 20 10", implying proportional distribution among remaining
    const remainingXP = totalXP - mainShare;
    
    // Calculate total damage from everyone to normalize shares
    let totalDamage = 0;
    attackerIds.forEach(id => totalDamage += records[id]);

    if (totalDamage > 0) {
       attackerIds.forEach(id => {
          const share = Math.floor((records[id] / totalDamage) * remainingXP);
          if (share > 0) {
             if (id === 'player') {
               addXP(share);
               playerRef.current.score += share;
             } else {
               const bot = botsRef.current.find(b => b.id === id);
               if (bot) bot.score += share;
             }
          }
       });
    }
  };

  const update = useCallback(() => {
    const p = playerRef.current;
    
    if (p.hp <= 0) { setGameState('GAMEOVER'); }
    else {
      cameraRef.current.x += (p.pos.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (p.pos.y - cameraRef.current.y) * 0.1;
      
      const speedMult = 1.0 + stats.moveSpeed * 0.12;
      let dx = 0, dy = 0;
      if (keys.current['w']) dy -= 1; if (keys.current['s']) dy += 1;
      if (keys.current['a']) dx -= 1; if (keys.current['d']) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        p.vel.x += (dx / mag) * 0.35 * speedMult;
        p.vel.y += (dy / mag) * 0.35 * speedMult;
      }
      p.pos.x += p.vel.x; p.pos.y += p.vel.y;
      p.vel.x *= 0.88; p.vel.y *= 0.88;
      
      p.pos.x = Math.max(0, Math.min(WORLD_SIZE, p.pos.x));
      p.pos.y = Math.max(0, Math.min(WORLD_SIZE, p.pos.y));

      if (canvasRef.current) {
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        p.angle = Math.atan2(mouse.current.y - screenCenterY, mouse.current.x - screenCenterX);
      }

      // Player shooting or summoning
      if (keys.current['mousedown'] || tankClass === TankClass.NECROMANCER || tankClass === TankClass.CHIEF_NECROMANCER) processFiring(p, 'PLAYER');
      if (p.hp < p.maxHp) p.hp += 0.02 + stats.regen * 0.04; 
    }

    const allEntities = [p, ...botsRef.current, ...minionsRef.current];

    // --- Entity vs Entity Collision (Ramming & Minion Logic) ---
    for (let i = 0; i < allEntities.length; i++) {
      let e1 = allEntities[i];
      if (e1.hp <= 0) continue;

      // Shapes Collision
      shapesRef.current.forEach(s => {
        if (s.hp <= 0) return;
        const dx = e1.pos.x - s.pos.x;
        const dy = e1.pos.y - s.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = e1.radius + s.radius;

        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          const push = 0.5;
          e1.pos.x += Math.cos(angle) * push;
          e1.pos.y += Math.sin(angle) * push;
          s.pos.x -= Math.cos(angle) * push;
          s.pos.y -= Math.sin(angle) * push;

          // Damage
          let dmg = 0;
          let attackerId = e1.id;

          if ((e1 as Minion).ownerId) {
             dmg = (e1 as Minion).damage; // Minion damage
             attackerId = (e1 as Minion).ownerId;
          } else {
             const bodyDmg = e1.id === 'player' ? stats.bodyDamage : (e1 as Bot).stats.bodyDamage;
             dmg = 1 + bodyDmg * 2; // Ram damage
          }
          
          s.hp -= dmg;
          addDamage(s, attackerId, dmg);

          e1.hp -= 0.5;

          if (s.hp <= 0) {
             handleScoreDistribution(s);
          }
        }
      });

      // Entity vs Entity
      for (let j = i + 1; j < allEntities.length; j++) {
        let e2 = allEntities[j];
        if (e2.hp <= 0) continue;
        
        const isFriendly = (e1.team && e2.team && e1.team === e2.team) || ((e1 as Minion).ownerId && (e2 as Minion).ownerId && (e1 as Minion).ownerId === (e2 as Minion).ownerId);
        
        const dx = e1.pos.x - e2.pos.x;
        const dy = e1.pos.y - e2.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = e1.radius + e2.radius;

        if (dist < minDist) {
          const isMinion1 = (e1 as any).ownerId !== undefined;
          const isMinion2 = (e2 as any).ownerId !== undefined;
          
          let shouldPush = true;

          // Lógica para atravessar aliados:
          // Se forem aliados e um deles for um Minion e o outro um tanque (não minion), desativa o empurrão físico.
          if (isFriendly) {
             if (isMinion1 !== isMinion2) {
                shouldPush = false;
             }
          }

          if (shouldPush) {
            const angle = Math.atan2(dy, dx);
            const overlap = minDist - dist;
            const push = overlap / 2;
            
            // Push apart
            e1.pos.x += Math.cos(angle) * push;
            e1.pos.y += Math.sin(angle) * push;
            e2.pos.x -= Math.cos(angle) * push;
            e2.pos.y -= Math.sin(angle) * push;
          }

          if (!isFriendly) {
            let bd1 = 0, bd2 = 0;
            
            if((e1 as Minion).ownerId) bd1 = (e1 as Minion).damage;
            else bd1 = 1 + (e1.id === 'player' ? stats.bodyDamage : (e1 as Bot).stats.bodyDamage) * 2;

            if((e2 as Minion).ownerId) bd2 = (e2 as Minion).damage;
            else bd2 = 1 + (e2.id === 'player' ? stats.bodyDamage : (e2 as Bot).stats.bodyDamage) * 2;
            
            e1.hp -= bd2;
            e2.hp -= bd1;
            
            if (e1.hp <= 0 && (e2.id === 'player' || (e2 as Minion).ownerId === 'player')) { addXP(100); playerRef.current.score += 100; }
            if (e2.hp <= 0 && (e1.id === 'player' || (e1 as Minion).ownerId === 'player')) { addXP(100); playerRef.current.score += 100; }
          }
        }
      }
    }

    // --- Minion Update Logic ---
    minionsRef.current.forEach(minion => {
      // Determine target
      let targetPos = { x: minion.pos.x, y: minion.pos.y };
      
      if (minion.ownerId === 'player') {
        if (canvasRef.current) {
          const screenCenterX = window.innerWidth / 2;
          const screenCenterY = window.innerHeight / 2;
          // Calculate world position of mouse
          targetPos.x = cameraRef.current.x + (mouse.current.x - screenCenterX);
          targetPos.y = cameraRef.current.y + (mouse.current.y - screenCenterY);
        }
      } else {
         // Bot minions follow bot or bot's target
         const owner = botsRef.current.find(b => b.id === minion.ownerId);
         if (owner) {
             targetPos = owner.pos; // Default follow owner
             if (owner.targetId) {
                // If bot has target, minions could be more aggressive, but for now they cluster
             }
         }
      }

      const dx = targetPos.x - minion.pos.x;
      const dy = targetPos.y - minion.pos.y;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      // Aiming logic
      minion.angle = angle;

      // Stop jittering if close
      if (dist > 70) {
        minion.vel.x += Math.cos(angle) * 0.5;
        minion.vel.y += Math.sin(angle) * 0.5;
      } else {
        minion.vel.x *= 0.9;
        minion.vel.y *= 0.9;
      }

      // Limit speed
      const speed = Math.sqrt(minion.vel.x**2 + minion.vel.y**2);
      if (speed > minion.speed) {
         minion.vel.x = (minion.vel.x / speed) * minion.speed;
         minion.vel.y = (minion.vel.y / speed) * minion.speed;
      }

      minion.pos.x += minion.vel.x;
      minion.pos.y += minion.vel.y;
      minion.vel.x *= 0.9;
      minion.vel.y *= 0.9;

      // Shooting logic for Chief Necromancer Minions
      if (minion.minionType === 'TANK') {
         const now = Date.now();
         const reloadTime = (850 / (1 + (minion.stats?.reload || 0) * 0.7));
         if (now - minion.lastFire > reloadTime) {
             fireBullet(minion, 'MINION');
             minion.lastFire = now;
         }
      }
    });
    // Remove dead minions
    minionsRef.current = minionsRef.current.filter(m => m.hp > 0);


    // --- Bots Logic (Slower/Less Aggressive) ---
    botsRef.current.forEach(bot => {
      const enemies = [...botsRef.current, p].filter(t => t.id !== bot.id && t.hp > 0 && t.team !== bot.team);
      let target: any = null, minDist = 1200;
      enemies.forEach(en => { const d = Math.sqrt((bot.pos.x-en.pos.x)**2 + (bot.pos.y-en.pos.y)**2); if (d < minDist) { minDist = d; target = en; } });
      
      if (!target) {
        let minShapeDist = 800;
        shapesRef.current.forEach(s => {
          const d = Math.sqrt((bot.pos.x - s.pos.x)**2 + (bot.pos.y - s.pos.y)**2);
          if (d < minShapeDist) { minShapeDist = d; target = s; }
        });
      }

      if (target) {
        bot.angle = Math.atan2(target.pos.y - bot.pos.y, target.pos.x - bot.pos.x);
        const d = Math.sqrt((bot.pos.x - target.pos.x)**2 + (bot.pos.y - target.pos.y)**2);
        
        let moveAngle = bot.angle;
        if (target.id.includes('player') || target.id.includes('bot')) {
            if (d < 300) moveAngle += Math.PI; // Kiting
        }
        
        // Slower acceleration for bots (0.35 -> 0.15)
        bot.vel.x += Math.cos(moveAngle) * 0.15; 
        bot.vel.y += Math.sin(moveAngle) * 0.15;
        processFiring(bot, 'BOT');
      } else {
        if (Math.random() < 0.02) bot.wanderAngle += (Math.random() - 0.5) * 2.0;
        // Slower wander speed (0.3 -> 0.1)
        bot.vel.x += Math.cos(bot.wanderAngle) * 0.1;
        bot.vel.y += Math.sin(bot.wanderAngle) * 0.1;
        
        if (bot.pos.x < 100) bot.wanderAngle = 0;
        if (bot.pos.x > WORLD_SIZE - 100) bot.wanderAngle = Math.PI;
        if (bot.pos.y < 100) bot.wanderAngle = Math.PI / 2;
        if (bot.pos.y > WORLD_SIZE - 100) bot.wanderAngle = -Math.PI / 2;
      }

      bot.pos.x += bot.vel.x; bot.pos.y += bot.vel.y; bot.vel.x *= 0.88; bot.vel.y *= 0.88;
      
      if (bot.score >= XP_REQUIREMENTS[bot.level-1] && bot.level < 60) {
        bot.level++;
        const evos = EVOLUTION_TREE[bot.tankClass] || []; if (bot.level % 15 === 0 && evos.length > 0) bot.tankClass = evos[0];
      }
      if (bot.hp < bot.maxHp) bot.hp += 0.03;
    });

    bulletsRef.current = bulletsRef.current.filter(b => {
      b.pos.x += b.vel.x; b.pos.y += b.vel.y; b.lifeTime--;
      shapesRef.current.forEach(s => {
        if (s.hp > 0 && (s.pos.x - b.pos.x) ** 2 + (s.pos.y - b.pos.y) ** 2 < (s.radius + b.radius) ** 2) {
          s.hp -= b.damage; b.hp -= 1;
          addDamage(s, b.ownerId, b.damage);

          if (s.hp <= 0) {
            handleScoreDistribution(s);
          }
        }
      });
      [...botsRef.current, p, ...minionsRef.current].forEach(e => {
        if (e.hp > 0 && e.id !== b.ownerId && (e.team === 0 || e.team !== b.team) && !((e as Minion).ownerId === b.ownerId)) {
          if ((e.pos.x - b.pos.x) ** 2 + (e.pos.y - b.pos.y) ** 2 < (e.radius + b.radius) ** 2) {
            e.hp -= b.damage; b.hp -= 1;
            if (e.hp <= 0) {
              const r = e.radius * 20;
              if (b.ownerId === 'player') { addXP(r); playerRef.current.score += r; }
              else { 
                const bot = botsRef.current.find(bt => bt.id === b.ownerId); 
                if(bot) bot.score += r;
              }
            }
          }
        }
      });
      return b.lifeTime > 0 && b.hp > 0;
    });

    shapesRef.current = shapesRef.current.filter(s => s.hp > 0);
    while (shapesRef.current.length < SHAPE_COUNT) shapesRef.current.push(createRandomShape(Math.random() > 0.85));
    botsRef.current = botsRef.current.filter(b => b.hp > 0);
    while (botsRef.current.length < BOT_COUNT) botsRef.current.push(createBot());
    
    setTeamScores({
      blue: Math.floor(botsRef.current.filter(b => b.team === 1).reduce((s, b) => s + b.score, 0) + (p.team === 1 ? p.score : 0)),
      red: Math.floor(botsRef.current.filter(b => b.team === 2).reduce((s, b) => s + b.score, 0) + (p.team === 2 ? p.score : 0))
    });
    
    const entries: ColoredLeaderboardEntry[] = botsRef.current.map(b => ({ name: `[Bot] ${b.name}`, score: Math.floor(b.score), isPlayer: false, teamColor: b.team === 1 ? COLORS.TEAM_BLUE : COLORS.TEAM_RED }));
    entries.push({ name: playerName, score: Math.floor(p.score), isPlayer: true, teamColor: p.team === 1 ? COLORS.TEAM_BLUE : COLORS.TEAM_RED });
    setLeaderboard(entries.sort((a, b) => b.score - a.score).slice(0, 10));
  }, [stats, tankClass, playerName, addXP, themeColor, teamScores, leaderboard, resetServer]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const p = playerRef.current;
    const { width, height } = ctx.canvas;
    const zoom = tankClass === TankClass.SNIPER || tankClass === TankClass.ASSASSIN || tankClass === TankClass.OVERSEER || tankClass === TankClass.NECROMANCER || tankClass === TankClass.CHIEF_NECROMANCER ? 0.7 : 1.0;
    const camX = cameraRef.current.x;
    const camY = cameraRef.current.y;
    
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    
    ctx.scale(zoom, zoom);
    ctx.translate(width / (2 * zoom) - camX, height / (2 * zoom) - camY);
    
    ctx.fillStyle = COLORS.VOID; 
    ctx.fillRect(camX - width / (2 * zoom), camY - height / (2 * zoom), width / zoom, height / zoom);
    
    ctx.fillStyle = COLORS.BACKGROUND; 
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    
    ctx.fillStyle = COLORS.BASE_BLUE; 
    ctx.fillRect(0, 0, BASE_SIZE, WORLD_SIZE);
    ctx.fillStyle = COLORS.BASE_RED; 
    ctx.fillRect(WORLD_SIZE - BASE_SIZE, 0, BASE_SIZE, WORLD_SIZE);
    
    ctx.strokeStyle = COLORS.GRID; ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_SIZE; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_SIZE); ctx.stroke(); }
    for (let y = 0; y <= WORLD_SIZE; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_SIZE, y); ctx.stroke(); }
    
    shapesRef.current.forEach(s => { 
      ctx.save(); 
      ctx.translate(s.pos.x, s.pos.y); 
      ctx.rotate(s.rotation); 
      ctx.fillStyle = s.color; ctx.strokeStyle = '#555'; ctx.lineWidth = 4; 
      let sides = s.type === ShapeType.TRIANGLE ? 3 : (s.type === ShapeType.HEXAGON ? 6 : (s.type.includes('PENTAGON') ? 5 : 4)); 
      ctx.beginPath(); 
      for(let i=0; i<sides; i++){ 
        const a = i*2*Math.PI/sides; 
        ctx.lineTo(Math.cos(a)*s.radius, Math.sin(a)*s.radius); 
      } 
      ctx.closePath(); ctx.fill(); ctx.stroke(); 
      ctx.restore(); 

      // Shape HP Bar
      if (s.hp < s.maxHp) {
        ctx.save();
        ctx.translate(s.pos.x, s.pos.y);
        const barWidth = s.radius * 2;
        ctx.fillStyle = '#555';
        ctx.fillRect(-barWidth/2, s.radius + 10, barWidth, 4);
        ctx.fillStyle = '#85e37d';
        ctx.fillRect(-barWidth/2, s.radius + 10, barWidth * (s.hp / s.maxHp), 4);
        ctx.restore();
      }
    });

    // Draw Minions
    minionsRef.current.forEach(m => {
       ctx.save();
       ctx.translate(m.pos.x, m.pos.y);
       
       if (m.minionType === 'TANK') {
         // Draw Mini Tank
         ctx.rotate(m.angle);
         // Barrel
         ctx.fillStyle = '#999';
         ctx.strokeStyle = '#555';
         ctx.lineWidth = 2;
         const bw = 20, bh = 10;
         ctx.fillRect(0, -bh/2, bw, bh);
         ctx.strokeRect(0, -bh/2, bw, bh);
         
         // Body
         ctx.fillStyle = m.color;
         ctx.beginPath();
         ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
         ctx.fill();
         ctx.stroke();

       } else {
         // Draw Square Minion
         ctx.rotate(Date.now() * 0.002);
         ctx.fillStyle = m.color;
         ctx.strokeStyle = '#555';
         ctx.lineWidth = 4;
         const s = m.radius;
         ctx.fillRect(-s, -s, s*2, s*2);
         ctx.strokeRect(-s, -s, s*2, s*2);
       }
       
       if (m.hp < m.maxHp) {
         ctx.rotate(m.minionType === 'TANK' ? -m.angle : -Date.now() * 0.002); // Reset rotation for bar
         ctx.fillStyle = '#555';
         ctx.fillRect(-m.radius, m.radius + 5, m.radius*2, 4);
         ctx.fillStyle = '#85e37d';
         ctx.fillRect(-m.radius, m.radius + 5, m.radius*2 * (m.hp / m.maxHp), 4);
       }
       ctx.restore();
    });
    
    bulletsRef.current.forEach(b => { 
      ctx.save(); ctx.translate(b.pos.x, b.pos.y); ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI*2); ctx.fill(); ctx.restore(); 
    });

    const rt = (ent: any, col: string, name: string, isBot: boolean) => {
      ctx.save(); 
      ctx.translate(ent.pos.x, ent.pos.y); 
      const bodyRot = ent.angle || 0;
      
      ctx.save();
      ctx.rotate(bodyRot);
      ctx.fillStyle = '#999'; ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
      const tc = ent.tankClass || (ent.id === 'player' ? tankClass : 'BASIC');
      const db = (w: number, h: number, ox = 0, oy = 0, rot = 0) => { ctx.save(); ctx.rotate(rot); ctx.fillRect(ox, -h/2 + oy, w, h); ctx.strokeRect(ox, -h/2 + oy, w, h); ctx.restore(); };
      if (tc === TankClass.TWIN) { db(40, 16, 0, -11); db(40, 16, 0, 11); } 
      else if (tc === TankClass.TRIPLET) { db(35, 14, 0, -12); db(35, 14, 0, 12); db(40, 14, 0, 0); }
      else if (tc === TankClass.SNIPER) db(55, 15); 
      else if (tc === TankClass.MACHINE_GUN) db(40, 24); 
      else if (tc === TankClass.FLANK_GUARD) { db(40, 16); db(40, 16, -40, 0, Math.PI); } 
      else if (tc === TankClass.PENTA_SHOT) { for(let i=-2; i<=2; i++) db(35, 12, 0, 0, i * 0.4); }
      else if (tc === TankClass.ARENA_CLOSER) db(45, 20);
      else if (tc === TankClass.NECROMANCER) { db(35, 35, 0, 0); }
      else if (tc === TankClass.CHIEF_NECROMANCER) { db(45, 45, 0, 0); }
      else if (tc === TankClass.OVERSEER) { db(30, 15, 0, 10, 0.4); db(30, 15, 0, -10, -0.4); }
      else db(40, 16);
      ctx.restore();

      ctx.fillStyle = col; ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, ent.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke(); 
      
      if (ent.hp < ent.maxHp) {
        const hpWidth = ent.radius * 2.5;
        const hpHeight = 5;
        ctx.fillStyle = '#555';
        ctx.fillRect(-hpWidth/2, ent.radius + 15, hpWidth, hpHeight);
        ctx.fillStyle = '#85e37d';
        ctx.fillRect(-hpWidth/2, ent.radius + 15, hpWidth * (ent.hp / ent.maxHp), hpHeight);
      }
      
      const displayName = isBot ? `[Bot] ${name}` : name;
      ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; 
      ctx.strokeText(displayName, 0, -ent.radius - 12); ctx.fillText(displayName, 0, -ent.radius - 12); ctx.restore();
    };

    botsRef.current.forEach(bot => rt(bot, bot.color, bot.name, true));
    if (p.hp > 0) rt(p, themeColor, playerName, false);
    
    ctx.restore();

    // Minimap
    const mapSize = 150;
    const margin = 20;
    const mapX = width - mapSize - margin;
    const mapY = height - mapSize - margin;
    
    ctx.save();
    ctx.translate(mapX, mapY);
    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.fillRect(0, 0, mapSize, mapSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, mapSize, mapSize);

    const scaleToMap = (val: number) => (val / WORLD_SIZE) * mapSize;

    // Draw base areas on map
    ctx.fillStyle = 'rgba(0, 178, 225, 0.2)';
    ctx.fillRect(0, 0, scaleToMap(BASE_SIZE), mapSize);
    ctx.fillStyle = 'rgba(241, 78, 84, 0.2)';
    ctx.fillRect(mapSize - scaleToMap(BASE_SIZE), 0, scaleToMap(BASE_SIZE), mapSize);

    // Draw bots on map
    botsRef.current.forEach(bot => {
      ctx.fillStyle = bot.color;
      ctx.fillRect(scaleToMap(bot.pos.x) - 1, scaleToMap(bot.pos.y) - 1, 2, 2);
    });

    // Draw player on map
    if (p.hp > 0) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(scaleToMap(p.pos.x), scaleToMap(p.pos.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

  }, [tankClass, playerName, themeColor]);

  useEffect(() => {
    const loop = () => { if (gameState === 'PLAYING') { update(); const ctx = canvasRef.current?.getContext('2d'); if (ctx) draw(ctx); } animationFrameRef.current = requestAnimationFrame(loop); };
    loop(); return () => cancelAnimationFrame(animationFrameRef.current!);
  }, [gameState, update, draw]);

  useEffect(() => {
    const handleKD = (e: KeyboardEvent) => { 
      const k = e.key.toLowerCase(); keys.current[k] = true; 
      // Toggle Evolution Tree with 'Y'
      if(k === 'y') setShowTree(prev => !prev); 
      if(k === 'o' && gameState === 'PLAYING') playerRef.current.hp = 0; 
      // Status Shortcuts
      if (gameState === 'PLAYING') {
        const keyMap: Record<string, keyof Stats> = {'1': 'regen', '2': 'maxHp', '3': 'bodyDamage', '4': 'bulletSpeed', '5': 'bulletPen', '6': 'bulletDamage', '7': 'reload', '8': 'moveSpeed'};
        if (keyMap[k]) upgradeStat(keyMap[k]);
      }
      lastActivityRef.current = Date.now(); 
    };
    const handleKU = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const handleMD = () => { keys.current['mousedown'] = true; lastActivityRef.current = Date.now(); };
    const handleMU = () => { keys.current['mousedown'] = false; };
    const handleMM = (e: MouseEvent) => { 
      mouse.current = { x: e.clientX, y: e.clientY }; 
      lastActivityRef.current = Date.now(); 
    };
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('keydown', handleKD); 
    window.addEventListener('keyup', handleKU);
    window.addEventListener('mousedown', handleMD);
    window.addEventListener('mouseup', handleMU);
    window.addEventListener('mousemove', handleMM);
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => { 
      window.removeEventListener('keydown', handleKD); 
      window.removeEventListener('keyup', handleKU); 
      window.removeEventListener('mousedown', handleMD);
      window.removeEventListener('mouseup', handleMU);
      window.removeEventListener('mousemove', handleMM);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, points]); // Added points dependency for upgrading stats via keys

  const startGame = () => {
    const startPos = selectedTeam === 1 ? { x: 300, y: Math.random() * WORLD_SIZE } : { x: WORLD_SIZE - 300, y: Math.random() * WORLD_SIZE };
    const keptXP = Math.floor(xp * 0.5);
    playerRef.current = { id: 'player', pos: startPos, vel: { x: 0, y: 0 }, angle: 0, hp: 100, maxHp: 100, radius: 20, lastFire: 0, score: keptXP, team: selectedTeam };
    cameraRef.current = { ...startPos }; 
    bulletsRef.current = []; 
    minionsRef.current = [];
    setStats(initialStats); 
    setLevel(1); setXp(0); setPoints(0); setTankClass(TankClass.BASIC); 
    if (keptXP > 0) setTimeout(() => addXP(keptXP), 0);
    setGameState('PLAYING');
    lastActivityRef.current = Date.now();
  };

  const upgradeStat = (key: keyof Stats) => { 
    // Uses the functional update to ensure we use current points
    setPoints(currPoints => {
      if (currPoints > 0 && stats[key] < 8) {
        setStats(prev => ({ ...prev, [key]: prev[key] + 1 }));
        return currPoints - 1;
      }
      return currPoints;
    });
  };
  const xpProgress = level >= 60 ? 100 : ((xp - (level > 1 ? XP_REQUIREMENTS[level - 2] : 0)) / (XP_REQUIREMENTS[level - 1] - (level > 1 ? XP_REQUIREMENTS[level - 2] : 0))) * 100;
  
  // Show upgrade buttons only if level requirement is met AND NOT showing full tree
  const currentEvos = EVOLUTION_TREE[tankClass] || [];
  const meetsLevelForEvo = (level >= 15 && tankClass === TankClass.BASIC) || (level >= 30 && currentEvos.length > 0) || (level >= 45 && currentEvos.length > 0);
  const showEvoOptions = meetsLevelForEvo;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#8a8a8a] select-none font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      {gameState === 'START' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
          <div className={`bg-white p-10 rounded-2xl shadow-2xl flex flex-col items-center space-y-6 w-[420px] border-b-8 ${themeBorder}`}>
            <h1 className={`text-7xl font-black ${themeText} italic tracking-tighter`}>DIEP.JS</h1>
            <div className="flex w-full space-x-2">
              <button onClick={() => setSelectedTeam(1)} className={`flex-1 py-3 rounded-lg font-black text-xs ${selectedTeam === 1 ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>BLUE</button>
              <button onClick={() => setSelectedTeam(2)} className={`flex-1 py-3 rounded-lg font-black text-xs ${selectedTeam === 2 ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>RED</button>
            </div>
            <input className="w-full px-4 py-4 text-xl border-4 border-gray-100 rounded-xl text-center font-black outline-none" placeholder="NICKNAME" value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={15} />
            <button onClick={startGame} className={`w-full ${themeBg} text-white font-black py-5 rounded-2xl text-4xl shadow-xl active:scale-95`}>PLAY</button>
          </div>
        </div>
      )}
      {gameState === 'PLAYING' && (
        <>
          {showTree && <EvolutionTreeOverlay onClose={() => setShowTree(false)} onSelect={(tc) => { setTankClass(tc); setShowTree(false); }} />}
          <div className="absolute top-4 right-4 w-52 bg-black/40 p-4 rounded-xl text-white backdrop-blur-sm border border-white/10 shadow-2xl">
            <h3 className="font-black text-xs border-b border-white/20 pb-1 mb-2 uppercase tracking-widest">Leaderboard</h3>
            {leaderboard.map((entry, i) => ( 
              <div key={i} className={`flex justify-between text-[11px] mb-1 ${entry.isPlayer ? 'font-black underline' : 'opacity-90'}`} style={{ color: entry.teamColor }}>
                <span className="truncate w-32">{i+1}. {entry.name}</span>
                <span>{entry.score.toLocaleString()}</span>
              </div> 
            ))}
          </div>
          {/* Only show top-left upgrade menu if NOT showing full tree */}
          {!showTree && showEvoOptions && currentEvos.length > 0 && (
            <div className="absolute top-6 left-6 grid grid-cols-2 gap-1.5 p-1.5 bg-black/20 rounded-lg border-2 border-white/10 backdrop-blur-sm shadow-xl z-40">
              {currentEvos.map((tc, idx) => (
                <button key={tc} onClick={() => setTankClass(tc)} className="relative w-28 h-28 flex flex-col items-center justify-center rounded-sm border-2 border-[#555] transition-transform hover:scale-105" style={{ backgroundColor: UPGRADE_GRID_COLORS[idx % 4] }}>
                  <TankPreview tankClass={tc} color={themeColor} />
                  <span className="absolute bottom-1 text-[8px] font-black text-black/60 uppercase">{tc}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* Stats UI - Auto hide when 0 points */}
          <div 
             className={`absolute bottom-4 left-4 flex flex-col gap-1 w-[240px] transition-all duration-300 ${points > 0 || isStatsHovered || Object.values(stats).some((v) => (v as number) > 0) ? 'translate-x-0 opacity-100' : '-translate-x-[220px] opacity-100'}`}
             onMouseEnter={() => setIsStatsHovered(true)}
             onMouseLeave={() => setIsStatsHovered(false)}
          >
             {/* Invisible hover trigger area that extends to the edge when hidden */}
             <div className="absolute -left-4 top-0 bottom-0 w-8 z-50 cursor-pointer" />

             {(Object.keys(stats) as Array<keyof Stats>).map((key, i) => (
               <div key={key} className="relative h-4 w-full bg-black/50 rounded-full flex items-center pr-0.5 select-none overflow-hidden group">
                  {/* Progress Bar Background */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 transition-all duration-200" 
                    style={{ width: `${(stats[key] / 8) * 100}%`, backgroundColor: STAT_COLORS[key] }}
                  />
                  
                  {/* Label Text */}
                  <span className="relative z-10 text-white font-black text-[9px] pl-2 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] uppercase tracking-wide">
                    {getDynamicStatLabel(key, tankClass)} <span className="text-white/70 ml-1">[{i + 1}]</span>
                  </span>

                  {/* Plus Button - Only visible if points available */}
                  {points > 0 && stats[key] < 8 && (
                    <button 
                      onClick={() => upgradeStat(key)} 
                      className="ml-auto z-10 w-3.5 h-3.5 rounded-full bg-black/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors active:scale-90"
                      style={{ backgroundColor: STAT_COLORS[key] }}
                    >
                      <i className='bx bx-plus text-[10px] font-bold'></i>
                    </button>
                  )}
               </div>
             ))}
             {points > 0 && <div className="text-white font-black text-xs text-center drop-shadow-md">x{points}</div>}
          </div>

          {/* Score & Level Bar - Bottom Center */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 w-[500px]">
            {/* Score Pill */}
            <div className="bg-[#444] px-6 py-1 rounded-full text-white font-black text-sm border-2 border-black/10 shadow-lg min-w-[150px] text-center">
               Score: {Math.floor(playerRef.current.score).toLocaleString()}
            </div>
            
            {/* Level/XP Bar */}
            <div className="w-full h-5 bg-[#444] rounded-full border-2 border-black/10 overflow-hidden relative shadow-lg">
              <div 
                className="h-full bg-[#ffe869] transition-all duration-300" 
                style={{ width: `${xpProgress}%` }} 
              />
              <div className="absolute inset-0 flex items-center justify-center text-white font-black text-[10px] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                Lvl {level} {tankClass.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </>
      )}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-2xl">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl border-t-[15px] border-red-500 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-6xl font-black text-red-500 italic mb-6 tracking-tighter">DESTROYED!</h2>
            <button onClick={startGame} className={`w-full py-6 ${themeBg} text-white font-black rounded-3xl text-3xl shadow-xl active:scale-95 mb-4`}>REDEPLOY</button>
            <button onClick={() => setGameState('START')} className="text-gray-400 uppercase font-black text-sm">Main Menu</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;