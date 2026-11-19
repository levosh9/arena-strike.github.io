'use strict';

Game.state = {
  phase: 'menu', // 'menu' | 'buy' | 'live' | 'roundEnd' | 'over'
  mapId: 'arena',
  phaseTimer: 0,
  roundTimeLeft: Game.CFG.ROUND_TIME,
  scores: [0, 0],
  roundNum: 0,
  attackTeam: 1,
  halftimeDone: false,
  locked: false,
  menuOpen: false,
  statsShown: false,
  lossStreak: [0, 0],
  camMode: 0,
  specIdx: 0,
  specYawOffset: 0,
  specPitchOffset: 0,
  freeCamPos: new THREE.Vector3(0, 18, 0),
  freeCamYaw: 0,
  freeCamPitch: -1.0
};

Game.bomb = {
  status: 'carried',   // 'carried' | 'dropped' | 'planted' | 'exploded' | 'defused'
  carrier: null,
  pos: new THREE.Vector3(),
  site: null,
  timer: 0,
  actionActor: null,
  actionProgress: 0,
  actionType: null,    // 'plant' | 'defuse'
  beepTimer: 0,
  wasPlantedThisRound: false,
  mesh: null
};

Game.GRENADE_ORDER = ['he', 'flash', 'smoke', 'molotov'];
Game.GRENADE_META = {
  he:      { name: 'Осколочная граната',      field: 'grenades', icon: '💣' },
  flash:   { name: 'Световая граната',        field: 'flashes',  icon: '⚡' },
  smoke:   { name: 'Дымовая граната',         field: 'smokes',   icon: '💨' },
  molotov: { name: 'Зажигательная / Молотов', field: 'molotovs', icon: '🔥' }
};

Game.player = {
  isPlayer: true, team: 0, name: 'Вы',
  pos: new THREE.Vector3(-25, 0, 0), vy: 0, onGround: true,
  crouching: false, crouchToggled: false, eyeHeight: 1.7,
  yaw: 0, pitch: 0, hp: 100, armor: 0, helmet: false, defuseKit: false, dead: false,
  slowUntil: 0, blindUntil: 0,
  money: Game.CFG.MONEY.start,
  kills: 0, assists: 0, deaths: 0, hsKills: 0, damage: 0, score: 0,
  damagedBy: {},
  weapon: 'pistol', ammo: Game.WEAPONS.pistol.mag, reserve: 90,
  slots: {
    primary: null,
    secondary: { key: 'pistol', ammo: Game.WEAPONS.pistol.mag, reserve: Game.WEAPONS.pistol.mag * 3 },
    melee: { key: 'knife', ammo: 0, reserve: 0 }
  },
  currentSlot: 'secondary',
  prevSlot: 'secondary',
  lastSlot: { slot: 'melee', grenade: null },
  activeGrenade: null,
  reloading: false, reloadEnd: 0, shootCd: 0, stepTimer: 0,
  ads: false, isScoped: false,
  grenades: 0, flashes: 0, smokes: 0, molotovs: 0, throwCd: 0
};

Game.bots = [];
Game.allEntities = () => [Game.player, ...Game.bots];

Game.isAttackTeam = team => team === Game.state.attackTeam;

Game.getDefuseTime = function(actor){
  return (actor && actor.defuseKit) ? Game.CFG.BOMB_DEFUSE_KIT_TIME : Game.CFG.BOMB_DEFUSE_TIME;
};

Game.getTeamSpawnPoint = function(team){
  const map = Game.MAPS[Game.state.mapId] || Game.MAPS.arena;
  return Game.isAttackTeam(team) ? map.atkSpawn : map.defSpawn;
};

Game.getTeamSpawnX = function(team){
  return Game.getTeamSpawnPoint(team).x;
};

Game.getOwnedGrenades = function(actor){
  return Game.GRENADE_ORDER.filter(k => (actor[Game.GRENADE_META[k].field] || 0) > 0);
};

Game.syncAmmoToSlot = function(){
  const p = Game.player;
  const s = p.slots[p.currentSlot];
  if (s){ s.ammo = p.ammo; s.reserve = p.reserve; }
};

function recordLastSlot(){
  const p = Game.player;
  p.lastSlot = {
    slot: p.currentSlot,
    grenade: p.currentSlot === 'grenade' ? p.activeGrenade : null
  };
}

Game.activateSlot = function(slotKey){
  const p = Game.player;
  const s = p.slots[slotKey];
  if (!s) return;
  p.currentSlot = slotKey;
  p.prevSlot = slotKey;
  p.weapon = s.key;
  p.ammo = s.ammo;
  p.reserve = s.reserve;
  p.reloading = false;
  if (Game.equipGun) Game.equipGun(s.key);
};

Game.switchSlot = function(slotKey){
  const p = Game.player;
  if (slotKey === p.currentSlot || !p.slots[slotKey]) return;
  if (p.ads) Game.exitADS();
  Game.syncAmmoToSlot();
  recordLastSlot();
  Game.activateSlot(slotKey);
  if (Game.updHUD) Game.updHUD();
};

function equipGrenadeItem(grenadeKey){
  const p = Game.player;
  if (p.ads) Game.exitADS();
  if (p.currentSlot !== 'grenade'){
    Game.syncAmmoToSlot();
    p.prevSlot = p.currentSlot;
  }
  recordLastSlot();
  p.currentSlot = 'grenade';
  p.reloading = false;
  p.activeGrenade = grenadeKey;
  if (Game.equipGun) Game.equipGun('grenade_' + grenadeKey);
  if (Game.updHUD) Game.updHUD();
}

// Переключение и циклический выбор гранат на клавишу [4]
Game.cycleGrenadeSlot = function(){
  const p = Game.player;
  const owned = Game.getOwnedGrenades(p);
  if (!owned.length){
    if (Game.showMsg) Game.showMsg('Нет гранат — купите в магазине [B]', 1400);
    return;
  }

  let nextGr;
  if (p.currentSlot !== 'grenade'){
    nextGr = owned.includes(p.activeGrenade) ? p.activeGrenade : owned[0];
  } else {
    const idx = owned.indexOf(p.activeGrenade);
    nextGr = owned[(idx + 1) % owned.length];
    if (nextGr === p.activeGrenade) return;
  }
  equipGrenadeItem(nextGr);
};

// Быстрое переключение на предыдущее оружие/гранату на клавишу [Q]
Game.quickSwitch = function(){
  const p = Game.player;
  const last = p.lastSlot;
  if (last){
    if (last.slot === 'grenade'){
      const owned = Game.getOwnedGrenades(p);
      if (last.grenade && owned.includes(last.grenade)){
        if (p.currentSlot !== 'grenade' || p.activeGrenade !== last.grenade){
          equipGrenadeItem(last.grenade);
          return;
        }
      }
    } else if (last.slot && p.slots[last.slot] && last.slot !== p.currentSlot){
      Game.switchSlot(last.slot);
      return;
    }
  }

  // Запасной вариант, если прошлый предмет уже недоступен (например, граната брошена)
  const fallbackOrder = ['primary', 'secondary', 'melee'];
  for (const sk of fallbackOrder){
    if (sk !== p.currentSlot && p.slots[sk]){
      Game.switchSlot(sk);
      return;
    }
  }
};

// Переключение слотов и гранат колёсиком мыши
Game.wheelSwitchSlot = function(dir){
  const p = Game.player;
  const list = [];
  if (p.slots.primary)   list.push({ slot: 'primary',   grenade: null });
  if (p.slots.secondary) list.push({ slot: 'secondary', grenade: null });
  if (p.slots.melee)     list.push({ slot: 'melee',     grenade: null });
  for (const g of Game.getOwnedGrenades(p)){
    list.push({ slot: 'grenade', grenade: g });
  }
  if (list.length < 2) return;

  let curIdx = list.findIndex(item =>
    item.slot === p.currentSlot && (item.slot !== 'grenade' || item.grenade === p.activeGrenade)
  );
  if (curIdx < 0) curIdx = 0;

  const next = list[(curIdx + (dir > 0 ? 1 : -1) + list.length) % list.length];
  if (next.slot === 'grenade'){
    equipGrenadeItem(next.grenade);
  } else {
    Game.switchSlot(next.slot);
  }
};

Game.refreshCrosshair = function(){
  const ch = Game.$('crosshair');
  const p = Game.player;
  if (p.dead || p.isScoped || (p.currentSlot !== 'grenade' && Game.isSniper(p.weapon))){
    ch.style.display = 'none';
  } else {
    ch.style.display = '';
  }
};

Game.enterADS = function(){
  const p = Game.player;
  if (p.dead || p.reloading || Game.state.phase !== 'live' || p.currentSlot === 'grenade' || Game.isKnife(p.weapon)) return;
  const scoped = Game.isSniper(p.weapon);
  p.ads = true;
  p.isScoped = scoped;
  if (scoped){
    Game.camera.fov = 30;
    Game.$('scope').classList.add('active');
  } else {
    Game.camera.fov = 60;
  }
  Game.camera.updateProjectionMatrix();
  Game.refreshCrosshair();
};

Game.exitADS = function(){
  const p = Game.player;
  if (!p.ads) return;
  p.ads = false;
  p.isScoped = false;
  Game.camera.fov = 75;
  Game.camera.updateProjectionMatrix();
  Game.$('scope').classList.remove('active');
  Game.refreshCrosshair();
};