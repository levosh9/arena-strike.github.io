'use strict';
window.Game = window.Game || {};

Game.CFG = {
  ARENA: 30,
  ROUND_TIME: 90,
  BUY_TIME: 7,
  BUY_WINDOW: 15,
  BUY_ZONE_X: 25,
  BUY_ZONE_Z: 0,
  BUY_ZONE_RADIUS: 7,
  HALF_ROUNDS: 12,
  WIN_SCORE: 13,
  MONEY: { kill: 300, win: 3250, plantBonus: 300, start: 800 },
  LOSS_BONUS: [1400, 1900, 2400, 2900, 3400],
  ARMOR_PRICE: 650,
  HELMET_ARMOR_PRICE: 1000,
  HELMET_UPGRADE_PRICE: 350,
  DEFUSE_KIT_PRICE: 400,
  GRENADE_PRICE: 300,
  FLASH_PRICE: 200,
  SMOKE_PRICE: 300,
  MOLOTOV_PRICE: 400,
  GRENADE_FUSE: 2.5,
  GRENADE_RADIUS: 8,
  GRENADE_MAX_DMG: 120,
  FLASH_FUSE: 1.6,
  FLASH_RADIUS: 18,
  SMOKE_FUSE: 1.8,
  SMOKE_RADIUS: 5.5,
  SMOKE_DURATION: 14,
  MOLOTOV_FUSE: 2.0,
  MOLOTOV_RADIUS: 4.5,
  MOLOTOV_DURATION: 7.0,
  MOLOTOV_DPS: 45,
  BOMB_PLANT_TIME: 3.0,
  BOMB_DEFUSE_TIME: 5.0,
  BOMB_DEFUSE_KIT_TIME: 2.5,
  BOMB_EXPLODE_TIME: 40.0,
  BOMB_SITE_RADIUS: 3.6,
  BOMB_USE_RADIUS: 2.6,
  BOMBSITES: [
    { id: 'A', x: 0, z: -20, color: 0xffb300 },
    { id: 'B', x: 0, z:  20, color: 0xffb300 }
  ],
  SPAWN_Z: [-8, -4, 0, 4, 8]
};

Game.MAPS = {
  arena: {
    name: 'ARENA CORE',
    skyColor: 0x161a24,
    floorColor: 0x2b2f3a,
    wallColor: 0x454b5c,
    crateColor: 0x5c5344,
    defSpawn: { x: -25, z: 0 },
    atkSpawn: { x:  25, z: 0 },
    sites: [
      { id: 'A', x: 0, z: -20, color: 0xffb300 },
      { id: 'B', x: 0, z:  20, color: 0xffb300 }
    ],
    boxes: [
      [-10,-6,3,3,2.2],[10,-6,3,3,2.2],[-10,6,3,3,2.2],[10,6,3,3,2.2],
      [0,-14,6,2,2.6],[0,14,6,2,2.6],[-18,0,2,8,2.6],[18,0,2,8,2.6],
      [-6,-1,2.5,2.5,1.4],[6,1,2.5,2.5,1.4],
      [-20,-20,3,3,2.4],[20,-20,3,3,2.4],[-20,20,3,3,2.4],[20,20,3,3,2.4],
      [0,0,4,4,3.2]
    ],
    platforms: [],
    ramps: []
  },
  sandstorm: {
    name: 'SANDSTORM',
    skyColor: 0x231f1a,
    floorColor: 0x4a3f30,
    wallColor: 0x6b5b45,
    crateColor: 0x876f4d,
    defSpawn: { x: -24, z: -4 },
    atkSpawn: { x:  24, z:  4 },
    sites: [
      { id: 'A', x: -16, z: -22, color: 0xffb300 },
      { id: 'B', x: -16, z:  22, color: 0xffb300 }
    ],
    boxes: [
      [-6, -13, 14, 2.2, 4.2, 0x78654b],
      [10, -13, 10, 2.2, 4.2, 0x78654b],
      [-6,  13, 14, 2.2, 4.2, 0x78654b],
      [10,  13, 10, 2.2, 4.2, 0x78654b],
      [ 2,  -4.5, 1.8, 5.5, 3.8, 0x5c4934],
      [ 2,   4.5, 1.8, 5.5, 3.8, 0x5c4934],
      [-21, -17, 2.6, 2.6, 1.6],
      [-11, -24, 3.0, 2.2, 2.2],
      [-21,  17, 2.6, 2.6, 1.5],
      [-11,  24, 3.0, 2.2, 2.2],
      [ 16, -21, 3.0, 3.0, 2.2],
      [ 16,  21, 3.0, 3.0, 2.2],
      [ 15,   0, 2.5, 5.0, 2.4]
    ],
    platforms: [
      { minX: -12, maxX: -4, minZ: -9, maxZ: 5, h: 1.5, color: 0x6e5e49 }
    ],
    ramps: [
      { minX: -10, maxX: -6, minZ: 5, maxZ: 10.5, h0: 0, h1: 1.5, axis: 'z', dir: -1, color: 0x7d6b52 },
      { minX: -12, maxX: -8, minZ: -12.5, maxZ: -9, h0: 1.5, h1: 0, axis: 'z', dir: -1, color: 0x7d6b52 }
    ]
  }
};

Game.settings = {
  mouseSens: 1.0,
  volume: 1.0,
  soundOn: true,
  crouchToggle: false,
  chShape: 'dot',
  chSize: 4,
  chColor: '#7CFC00'
};

Game.BOT_NAMES = {
  0: ['Алексей', 'Дмитрий', 'Максим', 'Иван'],
  1: ['Сергей', 'Андрей', 'Никита', 'Павел', 'Артём']
};

Game.WEAPONS = {
  knife:         { name:'Нож',                dmg:55,  rate:450,  mag:0,   reload:0,   spread:0,     price:0,    speedMul:1.12, melee:true, range:2.5 },
  pistol:        { name:'Пистолет',           dmg:16,  rate:340,  mag:12,  reload:1.4, spread:0.025, price:0,    speedMul:1.0  },
  pistol_mid:    { name:'Усиленный пистолет', dmg:30,  rate:280,  mag:14,  reload:1.6, spread:0.020, price:500,  speedMul:1.0  },
  pistol_deagle: { name:'Дигл',               dmg:50,  rate:400,  mag:7,   reload:2.0, spread:0.015, price:700,  speedMul:0.98 },
  smg:           { name:'Пистолет-пулемёт',   dmg:19,  rate:95,   mag:30,  reload:2.0, spread:0.030, price:1200, speedMul:0.96 },
  negev:         { name:'Пулемёт (Negev)',    dmg:24,  rate:75,   mag:150, reload:4.2, spread:0.075, price:1700, speedMul:0.78 },
  shotgun:       { name:'Дробовик',           dmg:14,  rate:900,  mag:6,   reload:2.5, spread:0.080, price:1800, speedMul:0.90, pellets:8 },
  rifle:         { name:'Винтовка',           dmg:34,  rate:130,  mag:30,  reload:2.2, spread:0.011, price:2700, speedMul:0.92 },
  sniper_light:  { name:'Легкая снайперка',   dmg:80,  rate:1400, mag:5,   reload:3.0, spread:0.001, price:3700, speedMul:0.88 },
  sniper_heavy:  { name:'Тяжелая снайперка',  dmg:200, rate:1600, mag:5,   reload:3.5, spread:0.001, price:4700, speedMul:0.84 }
};

Game.isSniper = kind => kind === 'sniper_light' || kind === 'sniper_heavy';
Game.isPistol = kind => kind === 'pistol' || kind === 'pistol_mid' || kind === 'pistol_deagle';
Game.isLmg    = kind => kind === 'negev';
Game.isKnife  = kind => kind === 'knife';
Game.$ = id => document.getElementById(id);