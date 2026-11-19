'use strict';

let AC = null;
let lastBombStartSnd = 0;

Game.initAudio = function(){
  if (!AC && window.AudioContext) AC = new AudioContext();
  if (AC && AC.state === 'suspended') AC.resume();
};

Game.tone = function(freq, dur, type = 'square', vol = 0.08){
  if (!AC || !Game.settings.soundOn || vol <= 0.002) return;
  vol *= Game.settings.volume;
  if (vol <= 0.002) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g).connect(AC.destination);
  o.start();
  o.stop(AC.currentTime + dur);
};

Game.snd = {
  shot:      () => { Game.tone(180, 0.07, 'sawtooth', 0.06); Game.tone(900, 0.03, 'square', 0.03); },
  shotgun:   () => { Game.tone(80, 0.15, 'sawtooth', 0.10); Game.tone(200, 0.08, 'square', 0.06); Game.tone(400, 0.04, 'sawtooth', 0.04); },
  sniper:    () => { Game.tone(120, 0.12, 'sawtooth', 0.09); Game.tone(600, 0.05, 'square', 0.05); Game.tone(200, 0.15, 'sawtooth', 0.04); },
  knifeMiss: () => Game.tone(420, 0.06, 'triangle', 0.045),
  knifeHit:  () => { Game.tone(260, 0.08, 'sawtooth', 0.08); Game.tone(1100, 0.05, 'square', 0.06); },
  hit:       () => Game.tone(1400, 0.05, 'square', 0.07),
  hitMark:   () => Game.tone(1800, 0.04, 'square', 0.05),
  head:      () => { Game.tone(2400, 0.05, 'square', 0.055); Game.tone(1200, 0.06, 'sine', 0.03); },
  death:     () => { Game.tone(220, 0.2, 'sawtooth', 0.09); Game.tone(110, 0.3, 'sawtooth', 0.07); },
  buy:       () => Game.tone(880, 0.1, 'triangle', 0.07),

  roundTick:   () => Game.tone(980, 0.045, 'sine', 0.045),
  bombPlant:   () => { Game.tone(600, 0.08, 'square', 0.06); setTimeout(() => Game.tone(900, 0.1, 'square', 0.06), 90); },
  bombDefuse:  () => { Game.tone(520, 0.09, 'triangle', 0.07); setTimeout(() => Game.tone(780, 0.14, 'triangle', 0.07), 100); },

  // Локальный звук начала закладки/разминирования (слышно в пределах 26 м, с защитой от спама)
  bombStart(pos){
    if (!AC || !Game.settings.soundOn) return;
    const now = performance.now();
    if (now - lastBombStartSnd < 300) return;
    let vol = 0.05;
    if (pos){
      const dist = Math.hypot(pos.x - Game.player.pos.x, pos.z - Game.player.pos.z);
      if (dist > 26) return;
      const k = Math.max(0, 1 - dist / 26);
      vol *= k * k;
    }
    if (vol <= 0.003) return;
    lastBombStartSnd = now;
    Game.tone(440, 0.05, 'square', vol);
    setTimeout(() => Game.tone(580, 0.05, 'square', vol), 65);
  },

  // Писк установленной бомбы C4 с затуханием по дистанции (до 50 м)
  bombBeep(pos){
    if (!AC || !Game.settings.soundOn) return;
    let vol = 0.055;
    if (pos){
      const dist = Math.hypot(pos.x - Game.player.pos.x, pos.z - Game.player.pos.z);
      if (dist > 50) return;
      const k = Math.max(0.15, 1 - dist / 50);
      vol *= k;
    }
    Game.tone(2200, 0.055, 'sine', vol);
  },

  molotovBurst(pos){
    if (!AC || !Game.settings.soundOn) return;
    const dist = Math.hypot(pos.x - Game.player.pos.x, pos.z - Game.player.pos.z);
    if (dist > 50) return;
    const k = Math.max(0, 1 - dist / 50);
    Game.tone(140, 0.35, 'sawtooth', 0.11 * k);
    Game.tone(750, 0.18, 'square',   0.06 * k);
    Game.tone(320, 0.45, 'triangle', 0.07 * k);
  },

  flashbang(pos, blinded){
    if (!AC || !Game.settings.soundOn) return;
    const dist = Math.hypot(pos.x - Game.player.pos.x, pos.z - Game.player.pos.z);
    const k = Math.max(0.15, 1 - dist / 45);
    Game.tone(1600, 0.12, 'square', 0.12 * k);
    if (blinded){
      Game.tone(3200, 1.4, 'sine', 0.06);
    }
  },

  smokePop(pos){
    if (!AC || !Game.settings.soundOn) return;
    const dist = Math.hypot(pos.x - Game.player.pos.x, pos.z - Game.player.pos.z);
    if (dist > 45) return;
    const k = Math.max(0, 1 - dist / 45);
    Game.tone(240, 0.28, 'triangle', 0.08 * k);
    Game.tone(520, 0.35, 'sine', 0.05 * k);
  },

  explosion(pos){
    if (!AC || !Game.settings.soundOn) return;
    const dist = Math.hypot(pos.x - Game.player.pos.x, pos.z - Game.player.pos.z);
    if (dist > 65) return;
    const k = Math.max(0, 1 - dist / 65);
    const vol = 0.16 * k * k;
    if (vol <= 0.005) return;
    Game.tone(60,  0.45, 'sawtooth', vol);
    Game.tone(150, 0.35, 'sawtooth', vol * 0.8);
    Game.tone(400, 0.18, 'square',   vol * 0.5);
    Game.tone(80,  0.55, 'sine',     vol * 0.6);
  },

  footstep(fromPos, volMul = 1){
    if (!AC || !Game.settings.soundOn) return;
    let vol = volMul;
    if (fromPos){
      const dist = Math.hypot(fromPos.x - Game.player.pos.x, fromPos.z - Game.player.pos.z);
      if (dist > 22) return;
      const k = Math.max(0, 1 - dist / 22);
      vol *= k * k;
    }
    if (vol <= 0.012) return;
    Game.tone(70 + Math.random() * 22, 0.06, 'sine', 0.055 * vol);
    Game.tone(150 + Math.random() * 50, 0.035, 'triangle', 0.028 * vol);
  },

  botShot(from, weapon){
    if (!AC || !Game.settings.soundOn) return;
    const dist = Math.hypot(from.x - Game.player.pos.x, from.z - Game.player.pos.z);
    if (dist > 55) return;
    const k = Math.max(0, 1 - dist / 55);
    const vol = 0.085 * k * k;
    if (vol <= 0.003) return;
    if (Game.isSniper(weapon)){
      Game.tone(120, 0.12, 'sawtooth', vol * 1.4);
      Game.tone(600, 0.05, 'square', vol * 0.7);
    } else if (weapon === 'shotgun'){
      Game.tone(80, 0.15, 'sawtooth', vol * 1.2);
      Game.tone(200, 0.08, 'square', vol * 0.7);
    } else {
      Game.tone(165 + Math.random() * 35, 0.07, 'sawtooth', vol);
      Game.tone(850 + Math.random() * 120, 0.025, 'square', vol * 0.38);
    }
  }
};