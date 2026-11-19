'use strict';

(function(){
  /* ---- Процедурные текстуры формы и снаряжения ботов ---- */
  function makeCamoTex(palette){
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 65; i++){
      ctx.fillStyle = palette[1 + (i % (palette.length - 1))];
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 10 + Math.random() * 22, 8 + Math.random() * 18);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < 128; y += 6){
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const vestTex = (function(){
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#252932';
    ctx.fillRect(0, 0, 128, 128);
    // Стропы MOLLE
    ctx.fillStyle = '#181b22';
    for (let y = 14; y < 110; y += 20){
      ctx.fillRect(8, y, 112, 8);
    }
    // Подсумки снизу
    ctx.fillStyle = '#323845';
    for (let x = 14; x < 100; x += 34){
      ctx.fillRect(x, 78, 28, 38);
      ctx.strokeStyle = '#14171d';
      ctx.strokeRect(x, 78, 28, 38);
    }
    return new THREE.CanvasTexture(c);
  })();

  const TEAM_MATS = {
    0: {
      suit:   new THREE.MeshLambertMaterial({ map: makeCamoTex(['#2f62b5', '#214785', '#3d74cc', '#1b3563']) }),
      dark:   new THREE.MeshPhongMaterial({ color: 0x1d3f75, shininess: 35 }),
      helmet: new THREE.MeshPhongMaterial({ color: 0x204782, shininess: 50 }),
      visor:  new THREE.MeshPhongMaterial({ color: 0x38bdf8, shininess: 110, specular: 0xffffff })
    },
    1: {
      suit:   new THREE.MeshLambertMaterial({ map: makeCamoTex(['#b83539', '#8a2327', '#cf484c', '#5e1a1d']) }),
      dark:   new THREE.MeshPhongMaterial({ color: 0x6e1f22, shininess: 35 }),
      helmet: new THREE.MeshPhongMaterial({ color: 0x7a2226, shininess: 50 }),
      visor:  new THREE.MeshPhongMaterial({ color: 0xffa01e, shininess: 110, specular: 0xffffff })
    }
  };

  const botGunMats = {
    dark:    new THREE.MeshPhongMaterial({ color: 0x23262e, shininess: 50 }),
    mid:     new THREE.MeshPhongMaterial({ color: 0x424a59, shininess: 60 }),
    grip:    new THREE.MeshLambertMaterial({ color: 0x1a1c22 }),
    accent:  new THREE.MeshPhongMaterial({ color: 0x9aa2b0, shininess: 80 }),
    skin:    new THREE.MeshLambertMaterial({ color: 0xc99a6e }),
    ammoBox: new THREE.MeshLambertMaterial({ color: 0x3b4d34 }),
    vest:    new THREE.MeshLambertMaterial({ map: vestTex }),
    pants:   new THREE.MeshLambertMaterial({ color: 0x262a34 }),
    boot:    new THREE.MeshLambertMaterial({ color: 0x14161c }),
    mask:    new THREE.MeshLambertMaterial({ color: 0x181a20 })
  };

  const WEAPON_TIER = {
    pistol:        0,
    pistol_mid:    1,
    pistol_deagle: 2,
    smg:           3,
    negev:         4,
    shotgun:       4,
    rifle:         5,
    sniper_light:  6,
    sniper_heavy:  7
  };

  function isPathClear(ax, az, bx, bz){
    const ay = Game.getGroundHeight(ax, az) + 0.9;
    const by = Game.getGroundHeight(bx, bz) + 0.9;
    const origin = new THREE.Vector3(ax, ay, az);
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
    const len = dir.length();
    if (len < 0.2) return true;
    Game.raycaster.set(origin, dir.normalize());
    Game.raycaster.far = len;
    return Game.raycaster.intersectObjects(Game.obstacleMeshes).length === 0;
  }

  function pickNewWaypoint(bot, goalPos){
    const wp = Game.wayPoints;
    let candidates = wp.filter(w => {
      const d = Math.hypot(w.x - bot.pos.x, w.z - bot.pos.z);
      return d > 4 && d < 28 && isPathClear(bot.pos.x, bot.pos.z, w.x, w.z);
    });

    if (!candidates.length){
      candidates = wp.filter(w => Math.hypot(w.x - bot.pos.x, w.z - bot.pos.z) > 5);
    }
    const pool = candidates.length ? candidates : wp;

    if (goalPos){
      let best = pool[0];
      let bestScore = 1e9;
      for (const w of pool){
        const distToGoal = Math.hypot(w.x - goalPos.x, w.z - goalPos.z);
        const score = distToGoal + Math.random() * 4;
        if (score < bestScore){
          bestScore = score;
          best = w;
        }
      }
      return best;
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  function findNearestEnemy(bot){
    let nearest = null;
    let bestD = 1e9;
    for (const e of Game.allEntities()){
      if (e.team === bot.team || e.dead) continue;
      const d = Game.dist2D(bot.pos, e.pos);
      if (d < bestD){
        bestD = d;
        nearest = e;
      }
    }
    return nearest;
  }

  function findVisibleEnemy(bot){
    let best = null, bestD = 1e9;
    for (const e of Game.allEntities()){
      if (e.team === bot.team || e.dead) continue;
      const d = Game.dist2D(bot.pos, e.pos);
      if (d < bestD && d < 45 && Game.hasLOS(bot, e)){
        best = e;
        bestD = d;
      }
    }
    return { enemy: best, dist: bestD };
  }

  function findCoverPoint(bot, threatPos){
    const ARENA = Game.CFG.ARENA;
    let bestPt = null;
    let bestScore = 1e9;

    for (const c of Game.colliders){
      if (c.maxY < 1.2) continue;
      const w = c.maxX - c.minX;
      const d = c.maxZ - c.minZ;
      if (w > 20 || d > 20) continue;

      const cx = (c.minX + c.maxX) * 0.5;
      const cz = (c.minZ + c.maxZ) * 0.5;
      let dx = cx - threatPos.x;
      let dz = cz - threatPos.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;

      const offset = Math.max(w, d) * 0.5 + 1.15;
      const px = Math.max(-ARENA + 1.2, Math.min(ARENA - 1.2, cx + dx * offset));
      const pz = Math.max(-ARENA + 1.2, Math.min(ARENA - 1.2, cz + dz * offset));

      const distToBot = Math.hypot(px - bot.pos.x, pz - bot.pos.z);
      const distToThreat = Math.hypot(px - threatPos.x, pz - threatPos.z);
      const score = distToBot - distToThreat * 0.35 + Math.random() * 3.0;
      if (score < bestScore){
        bestScore = score;
        bestPt = new THREE.Vector3(px, 0, pz);
      }
    }
    return bestPt;
  }

  function makeBotMesh(team){
    const g = new THREE.Group();
    const tm = TEAM_MATS[team] || TEAM_MATS[0];

    // Основной хитбокс тела (торс в камуфляже)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.92, 0.42), tm.suit);
    body.position.y = 1.12;
    g.add(body);

    // Тактический бронежилет с подсумками и ремнём
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.48), botGunMats.vest);
    vest.position.set(0, 1.14, 0);
    g.add(vest);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.10, 0.46), botGunMats.boot);
    belt.position.set(0, 0.72, 0);
    g.add(belt);

    // Рюкзак на спине
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.22), botGunMats.vest);
    backpack.position.set(0, 1.16, -0.34);
    g.add(backpack);

    // Пакет C4 на поясе (виден только у носителя бомбы)
    const c4Belt = new THREE.Group();
    c4Belt.position.set(-0.36, 0.78, -0.14);
    const c4Brick = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.24, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x4f5a44 })
    );
    c4Belt.add(c4Brick);
    const c4Strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.36),
      botGunMats.boot
    );
    c4Belt.add(c4Strap);
    const c4Led = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.10),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    c4Led.position.set(-0.08, 0.05, 0);
    c4Belt.add(c4Led);
    c4Belt.visible = false;
    g.add(c4Belt);

    // Плечи и руки
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.34, 0.24), tm.suit);
    shoulderL.position.set(-0.42, 1.32, 0.04);
    shoulderL.rotation.x = -0.45;
    g.add(shoulderL);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.36), tm.suit);
    armL.position.set(-0.28, 1.08, 0.26);
    armL.rotation.y = 0.45;
    g.add(armL);

    const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.34, 0.24), tm.suit);
    shoulderR.position.set(0.42, 1.32, 0.04);
    shoulderR.rotation.x = -0.55;
    g.add(shoulderR);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.32), tm.suit);
    armR.position.set(0.32, 1.08, 0.24);
    g.add(armR);

    // Шея и голова (хитбокс хедшота)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 8), botGunMats.mask);
    neck.position.y = 1.60;
    g.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.42, 0.40), botGunMats.skin);
    head.position.y = 1.82;
    g.add(head);

    // Балаклава и тактические очки
    const balaclava = new THREE.Mesh(new THREE.BoxGeometry(0.415, 0.22, 0.415), botGunMats.mask);
    balaclava.position.set(0, 1.72, 0);
    g.add(balaclava);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.06), tm.visor);
    goggles.position.set(0, 1.86, 0.20);
    g.add(goggles);

    // Скруглённый тактический шлем (появляется при покупке брони со шлемом)
    const helmet = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), tm.helmet);
    dome.position.y = 1.88;
    helmet.add(dome);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.27, 0.06, 12), tm.dark);
    rim.position.y = 1.90;
    helmet.add(rim);
    helmet.visible = false;
    g.add(helmet);

    // Ноги с шарнирами для анимации ходьбы
    function makeLeg(xOff){
      const leg = new THREE.Group();
      leg.position.set(xOff, 0.68, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 0.28), botGunMats.pants);
      thigh.position.y = -0.28;
      leg.add(thigh);
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.06), botGunMats.boot);
      knee.position.set(0, -0.32, 0.15);
      leg.add(knee);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.40), botGunMats.boot);
      boot.position.set(0, -0.60, 0.06);
      leg.add(boot);
      return leg;
    }
    const legL = makeLeg(-0.17);
    const legR = makeLeg( 0.17);
    g.add(legL);
    g.add(legR);

    const weaponMount = new THREE.Group();
    weaponMount.position.set(0.28, 1.08, 0.40);
    g.add(weaponMount);

    Game.scene.add(g);
    return { group: g, body, head, helmet, c4Belt, c4Led, legL, legR, weaponMount };
  }

  function setBotWeapon(bot, kind){
    if (!bot.weaponMount) return;
    while (bot.weaponMount.children.length) bot.weaponMount.remove(bot.weaponMount.children[0]);

    const g = new THREE.Group();
    const add = (w, h, d, m, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    };
    const addCyl = (r, len, m, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
      mesh.position.set(x, y, z);
      mesh.rotation.x = Math.PI / 2;
      g.add(mesh);
      return mesh;
    };

    if (Game.isPistol(kind)){
      add(0.055, 0.06, 0.22, botGunMats.mid, 0, 0, 0.06);
      add(0.045, 0.10, 0.08, botGunMats.grip, 0, -0.06, -0.02);
      addCyl(0.015, 0.10, botGunMats.dark, 0, 0.01, 0.18);
    } else if (kind === 'smg'){
      add(0.07, 0.09, 0.36, botGunMats.dark, 0, 0, 0.08);
      addCyl(0.020, 0.18, botGunMats.mid, 0, 0.015, 0.30);
      add(0.045, 0.15, 0.065, botGunMats.grip, 0, -0.10, 0.02);
      add(0.045, 0.08, 0.14, botGunMats.mid, 0, -0.005, -0.20);
    } else if (kind === 'negev'){
      add(0.09, 0.11, 0.52, botGunMats.dark, 0, 0, 0.12);
      addCyl(0.022, 0.32, botGunMats.accent, 0, 0.025, 0.48);
      add(0.09, 0.12, 0.15, botGunMats.ammoBox, 0.07, -0.07, 0.14);
      add(0.06, 0.09, 0.22, botGunMats.mid, 0, -0.005, -0.25);
    } else if (kind === 'shotgun'){
      add(0.08, 0.09, 0.44, botGunMats.dark, 0, 0, 0.06);
      addCyl(0.018, 0.52, botGunMats.mid, 0, 0.035, 0.36);
      addCyl(0.024, 0.18, botGunMats.grip, 0, -0.005, 0.30);
      add(0.07, 0.09, 0.24, botGunMats.mid, 0, -0.02, -0.22);
    } else if (Game.isSniper(kind)){
      const L = kind === 'sniper_heavy' ? 1.15 : 1.0;
      add(0.075, 0.10, 0.52 * L, botGunMats.mid, 0, 0, 0.10);
      addCyl(0.018, 0.44 * L, botGunMats.dark, 0, 0.02, 0.50 * L);
      addCyl(0.024, 0.24, botGunMats.dark, 0, 0.09, 0.12);
      add(0.06, 0.09, 0.22, botGunMats.mid, 0, -0.005, -0.28);
    } else {
      add(0.075, 0.10, 0.50, botGunMats.dark, 0, 0, 0.12);
      addCyl(0.018, 0.30, botGunMats.mid, 0, 0.02, 0.46);
      add(0.05, 0.16, 0.08, botGunMats.grip, 0, -0.12, 0.05);
      add(0.06, 0.09, 0.20, botGunMats.mid, 0, -0.005, -0.26);
    }

    bot.weaponMount.add(g);
    bot.weaponMesh = g;
  }

  Game.botBuyRound = function(bot){
    const W = Game.WEAPONS;
    const CFG = Game.CFG;
    const curTier = WEAPON_TIER[bot.weapon] || 0;

    if (bot.armor < 100 || !bot.helmet){
      const upgradeCost = (bot.armor >= 100 && !bot.helmet) ? CFG.HELMET_UPGRADE_PRICE : CFG.HELMET_ARMOR_PRICE;
      if (bot.money >= upgradeCost + 1200 || (curTier >= 3 && bot.money >= upgradeCost)){
        bot.money -= upgradeCost;
        bot.armor = 100;
        bot.helmet = true;
      } else if (bot.armor < 100 && bot.money >= CFG.ARMOR_PRICE){
        bot.money -= CFG.ARMOR_PRICE;
        bot.armor = 100;
      }
    }

    if (bot.helmetMesh) bot.helmetMesh.visible = Boolean(bot.helmet && bot.armor > 0);

    if (!Game.isAttackTeam(bot.team) && !bot.defuseKit && bot.money >= CFG.DEFUSE_KIT_PRICE + 600 && Math.random() < 0.65){
      bot.money -= CFG.DEFUSE_KIT_PRICE;
      bot.defuseKit = true;
    }

    const candidates = [
      { key: 'pistol_mid',    weight: 1.0 },
      { key: 'pistol_deagle', weight: 1.4 },
      { key: 'smg',           weight: 1.8 },
      { key: 'negev',         weight: 1.7 },
      { key: 'shotgun',       weight: 1.8 },
      { key: 'rifle',         weight: 2.8 },
      { key: 'sniper_light',  weight: 2.0 },
      { key: 'sniper_heavy',  weight: 2.2 }
    ].filter(item => {
      const w = W[item.key];
      return w && WEAPON_TIER[item.key] > curTier && bot.money >= w.price;
    });

    if (candidates.length > 0){
      let pool = candidates;
      if (bot.money >= 2500){
        const primaries = candidates.filter(c => WEAPON_TIER[c.key] >= 3);
        if (primaries.length > 0) pool = primaries;
      }

      const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0);
      let roll = Math.random() * totalWeight;
      let chosen = pool[pool.length - 1].key;
      for (const c of pool){
        roll -= c.weight;
        if (roll <= 0){
          chosen = c.key;
          break;
        }
      }

      bot.money -= W[chosen].price;
      bot.weapon = chosen;
    }

    if (bot.money >= CFG.GRENADE_PRICE && (bot.grenades || 0) < 1 && Math.random() < 0.7){
      bot.money -= CFG.GRENADE_PRICE;
      bot.grenades = 1;
    }
    if (bot.money >= CFG.FLASH_PRICE && (bot.flashes || 0) < 1 && Math.random() < 0.7){
      bot.money -= CFG.FLASH_PRICE;
      bot.flashes = 1;
    }
    if (bot.money >= CFG.SMOKE_PRICE && (bot.smokes || 0) < 1 && Math.random() < 0.7){
      bot.money -= CFG.SMOKE_PRICE;
      bot.smokes = 1;
    }
    if (bot.money >= CFG.MOLOTOV_PRICE && (bot.molotovs || 0) < 1 && Math.random() < 0.65){
      bot.money -= CFG.MOLOTOV_PRICE;
      bot.molotovs = 1;
    }

    const wObj = W[bot.weapon];
    bot.ammo = wObj.mag;
    bot.reserve = wObj.mag * 3;
    bot.reloading = false;
    bot.reloadEnd = 0;

    setBotWeapon(bot, bot.weapon);
  };

  function spawnBots(){
    for (let t = 0; t < 2; t++){
      const count = t === 0 ? 4 : 5;
      const names = Game.BOT_NAMES[t] || [];
      for (let i = 0; i < count; i++){
        const parts = makeBotMesh(t);
        const bot = {
          isPlayer: false, team: t, name: names[i] || ((t === 0 ? 'Союзник ' : 'Враг ') + (i + 1)),
          pos: new THREE.Vector3(), yaw: 0,
          crouching: false, walkPhase: 0,
          hp: 100, _lastHp: 100, armor: 0, helmet: false, defuseKit: false, dead: false,
          slowUntil: 0, blindUntil: 0, plantAbortUntil: 0, evadeUntil: 0,
          money: Game.CFG.MONEY.start,
          kills: 0, assists: 0, deaths: 0, hsKills: 0, damage: 0, score: 0,
          damagedBy: {},
          stepTimer: 0, stuckTimer: 0,
          weapon: 'pistol', ammo: Game.WEAPONS.pistol.mag, reserve: Game.WEAPONS.pistol.mag * 3,
          reloading: false, reloadEnd: 0,
          shootCd: 1, think: Math.random(),
          target: null, waypoint: null, coverPoint: null, coverTimer: 0,
          chosenSite: null,
          strafeDir: 1, strafeT: 0,
          avoidDir: Math.random() < 0.5 ? -1 : 1, avoidTimer: 0,
          aimT: 0, reaction: 0.3,
          grenades: 0, flashes: 0, smokes: 0, molotovs: 0,
          mesh: parts.group, body: parts.body, head: parts.head, helmetMesh: parts.helmet,
          c4BeltMesh: parts.c4Belt, c4Led: parts.c4Led,
          legL: parts.legL, legR: parts.legR,
          weaponMount: parts.weaponMount, weaponMesh: null
        };
        bot.body.userData = { bot, head: false };
        bot.head.userData = { bot, head: true };
        setBotWeapon(bot, bot.weapon);
        Game.bots.push(bot);
      }
    }
  }
  spawnBots();

  function botShoot(bot, target){
    const w = Game.WEAPONS[bot.weapon];
    if (bot.reloading) return;
    if (bot.ammo <= 0){
      bot.reloading = true;
      bot.reloadEnd = performance.now() + w.reload * 1000;
      return;
    }
    bot.ammo--;

    const d = Game.dist2D(bot.pos, target.pos);
    const isSnip = Game.isSniper(bot.weapon);
    const isShot = bot.weapon === 'shotgun';
    const isLmg  = Game.isLmg(bot.weapon);

    let baseAcc;
    if (isSnip){
      baseAcc = Math.max(0.32, 0.58 - d * 0.003);
    } else if (isShot){
      baseAcc = Math.max(0.12, 0.72 - d * 0.025);
    } else if (isLmg){
      baseAcc = Math.max(0.20, 0.46 - d * 0.004);
    } else {
      baseAcc = Math.max(0.15, 0.42 - d * 0.0045);
    }

    const chance = baseAcc * (bot.crouching ? 1.15 : 1) * (bot.hp < 40 ? 0.85 : 1) * (target.isPlayer ? 0.95 : 1);

    const willHit = Math.random() < chance;
    const isHead  = willHit && Math.random() < (isSnip ? 0.25 : (isShot ? 0.15 : 0.33));
    const fromY = (bot.pos.y || 0) + (bot.crouching ? 1.15 : 1.6);
    const from = new THREE.Vector3(bot.pos.x, fromY, bot.pos.z);
    const targetY = (target.pos.y || 0) + (target.crouching ? (isHead ? 1.35 : 0.95) : (isHead ? 1.85 : 1.3));
    const to = new THREE.Vector3(target.pos.x, targetY, target.pos.z);
    const aim = to.clone().sub(from).normalize();

    if (!willHit){
      aim.add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.2) * 0.2, (Math.random() - 0.5) * 0.35));
      aim.normalize();
    }

    Game.raycaster.set(from, aim);
    Game.raycaster.far = 70;
    const hits = Game.raycaster.intersectObjects(Game.obstacleMeshes);
    let endPoint = from.clone().add(aim.clone().multiplyScalar(60));
    if (hits.length) endPoint = hits[0].point;
    Game.tracer(from, endPoint);
    Game.snd.botShot(from, bot.weapon);

    if (willHit){
      const dist = from.distanceTo(to);
      if (!hits.length || from.distanceTo(endPoint) > dist - 0.5){
        let dmg = w.dmg * (0.85 + Math.random() * 0.3);
        if (isShot){
          const pelletsHit = Math.max(2, Math.round(6 * Math.max(0.25, 1 - d / 24)));
          dmg *= pelletsHit;
        }
        Game.applyDamage(target, dmg, bot, isHead, to);
        if (target.isPlayer) Game.snd.hit();
      }
    }

    if (bot.ammo <= 0){
      bot.reloading = true;
      bot.reloadEnd = performance.now() + w.reload * 1000;
    }
  }

  function avoidObstacles(bot, move, dt){
    if (move.lengthSq() < 0.001) return;
    if (bot.avoidTimer > 0) bot.avoidTimer -= dt;

    const origin = new THREE.Vector3(bot.pos.x, (bot.pos.y || 0) + 0.9, bot.pos.z);
    const dir = move.clone().normalize();
    Game.raycaster.set(origin, dir);
    Game.raycaster.far = 2.4;

    if (Game.raycaster.intersectObjects(Game.obstacleMeshes).length > 0){
      if (bot.avoidTimer <= 0){
        bot.avoidDir = (bot.pos.z >= 0) ? -1 : 1;
        bot.avoidTimer = 1.6;
      }

      const d1 = bot.avoidDir;
      const d2 = -d1;
      const angles = [
        d1 * Math.PI / 6,
        d1 * Math.PI / 3,
        d1 * Math.PI / 2,
        d1 * (2 * Math.PI / 3),
        d2 * Math.PI / 3,
        d2 * Math.PI / 2,
        d2 * (2 * Math.PI / 3),
        d1 * (5 * Math.PI / 6)
      ];

      const baseX = dir.x, baseZ = dir.z;
      for (const a of angles){
        const c = Math.cos(a), s = Math.sin(a);
        const tryX = baseX * c - baseZ * s;
        const tryZ = baseX * s + baseZ * c;
        Game.raycaster.set(origin, new THREE.Vector3(tryX, 0, tryZ));
        Game.raycaster.far = 2.2;
        if (Game.raycaster.intersectObjects(Game.obstacleMeshes).length === 0){
          move.set(tryX, 0, tryZ);
          return;
        }
      }
    }
  }

  function applyBotPose(bot, dt = 0, moving = false){
    bot.pos.y = Game.getGroundHeight(bot.pos.x, bot.pos.z);
    bot.mesh.position.copy(bot.pos);
    bot.mesh.rotation.y = bot.yaw;
    bot.mesh.scale.y = bot.crouching ? 0.7 : 1.0;

    if (bot.legL && bot.legR){
      if (moving && !bot.crouching){
        bot.walkPhase = (bot.walkPhase || 0) + dt * 11;
        const swing = Math.sin(bot.walkPhase) * 0.55;
        bot.legL.rotation.x =  swing;
        bot.legR.rotation.x = -swing;
      } else {
        bot.legL.rotation.x *= 0.8;
        bot.legR.rotation.x *= 0.8;
      }
    }
  }

  Game.updateBot = function(bot, dt){
    if (bot.dead) return;
    const now = performance.now();
    const isBlinded = now < (bot.blindUntil || 0);
    const bomb = Game.bomb;
    const isAttack = Game.isAttackTeam(bot.team);

    if (bot._lastHp === undefined || bot.hp > bot._lastHp) bot._lastHp = bot.hp;
    const tookHit = bot.hp < bot._lastHp;
    if (tookHit) bot._lastHp = bot.hp;

    const carriesBomb = bomb.status === 'carried' && bomb.carrier === bot;
    if (bot.c4BeltMesh){
      bot.c4BeltMesh.visible = carriesBomb;
      if (carriesBomb && bot.c4Led){
        bot.c4Led.visible = Math.floor(now / 350) % 2 === 0;
      }
    }

    if (bot.reloading && now >= bot.reloadEnd){
      const w = Game.WEAPONS[bot.weapon];
      if (bot.reserve > 0){
        const take = Math.min(w.mag - bot.ammo, bot.reserve);
        bot.ammo += take;
        bot.reserve -= take;
      } else {
        bot.ammo = w.mag;
      }
      bot.reloading = false;
    }

    if (isBlinded){
      if (bomb.actionActor === bot && Game.cancelBombAction) Game.cancelBombAction(bot);
      bot.crouching = false;
      bot.target = null;
      bot.yaw += dt * 2.5 * bot.avoidDir;
      const blindMove = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
      avoidObstacles(bot, blindMove, dt);
      bot.pos.x += blindMove.x * 2.1 * dt;
      bot.pos.z += blindMove.z * 2.1 * dt;
      Game.resolveCollisions(bot.pos, 0.5);
      applyBotPose(bot, dt, true);
      return;
    }

    const wantsPlant = carriesBomb && Game.getSiteAt(bot.pos) && now >= (bot.plantAbortUntil || 0);
    const wantsDefuse = bomb.status === 'planted' && !isAttack && Game.dist2D(bot.pos, bomb.pos) <= Game.CFG.BOMB_USE_RADIUS && now >= (bot.plantAbortUntil || 0);

    if (wantsPlant || wantsDefuse){
      const vis = findVisibleEnemy(bot);
      if (tookHit || vis.enemy){
        if (bomb.actionActor === bot && Game.cancelBombAction) Game.cancelBombAction(bot);
        bot.plantAbortUntil = now + 4500;
        bot.evadeUntil = now + 2600;
        bot.crouching = false;
        const threat = vis.enemy || findNearestEnemy(bot);
        if (vis.enemy){
          bot.target = vis.enemy;
          bot.aimT = bot.reaction;
        }
        if (threat){
          bot.coverPoint = findCoverPoint(bot, threat.pos);
          bot.coverTimer = 2.6;
        }
      } else {
        bot.crouching = true;
        Game.advanceBombAction(bot, wantsPlant ? 'plant' : 'defuse', dt);
        applyBotPose(bot, dt, false);
        return;
      }
    } else if (bomb.actionActor === bot && Game.cancelBombAction){
      Game.cancelBombAction(bot);
    }

    const endGameRush = Game.state.roundTimeLeft <= 25;
    const evadingFire = now < (bot.evadeUntil || 0);
    const lowHp = (!endGameRush && bot.hp <= 38) || evadingFire;

    if (bot.coverTimer > 0) bot.coverTimer -= dt;

    bot.think -= dt;
    if (bot.think <= 0 || tookHit){
      bot.think = 0.25 + Math.random() * 0.2;
      const vis = findVisibleEnemy(bot);
      const best = vis.enemy;
      const bestD = vis.dist;

      if (best !== bot.target){
        bot.target = best;
        bot.aimT = tookHit ? bot.reaction : 0;
        bot.reaction = Game.isSniper(bot.weapon) ? (0.35 + Math.random() * 0.25) : (0.2 + Math.random() * 0.2);
      }

      bot.crouching = Boolean(bot.target && !evadingFire && bestD > 8 && Math.random() < 0.35);

      if (lowHp && (bot.target || tookHit)){
        const threat = bot.target || findNearestEnemy(bot);
        if (threat && (!bot.coverPoint || bot.coverTimer <= 0)){
          bot.coverPoint = findCoverPoint(bot, threat.pos);
          bot.coverTimer = 2.5 + Math.random() * 1.5;
        }
      } else if (!evadingFire){
        bot.coverPoint = null;
      }

      let objectiveGoal = null;
      if (bomb.status === 'planted'){
        objectiveGoal = bomb.pos;
      } else if (isAttack){
        if (bomb.status === 'dropped'){
          objectiveGoal = bomb.pos;
        } else if (carriesBomb){
          if (!bot.chosenSite){
            const sites = Game.CFG.BOMBSITES;
            bot.chosenSite = sites[Math.floor(Math.random() * sites.length)];
          }
          objectiveGoal = new THREE.Vector3(bot.chosenSite.x, 0, bot.chosenSite.z);
        }
      }

      if (!best && !bot.coverPoint){
        if (objectiveGoal){
          if (isPathClear(bot.pos.x, bot.pos.z, objectiveGoal.x, objectiveGoal.z)){
            bot.waypoint = objectiveGoal.clone();
          } else if (!bot.waypoint || Game.dist2D(bot.pos, bot.waypoint) < 2.2 || !isPathClear(bot.pos.x, bot.pos.z, bot.waypoint.x, bot.waypoint.z)){
            bot.waypoint = pickNewWaypoint(bot, objectiveGoal);
          }
        } else if (endGameRush){
          const enemy = findNearestEnemy(bot);
          if (enemy){
            if (isPathClear(bot.pos.x, bot.pos.z, enemy.pos.x, enemy.pos.z)){
              bot.waypoint = enemy.pos.clone();
            } else if (!bot.waypoint || Game.dist2D(bot.pos, bot.waypoint) < 2.2 || !isPathClear(bot.pos.x, bot.pos.z, bot.waypoint.x, bot.waypoint.z)){
              bot.waypoint = pickNewWaypoint(bot, enemy.pos);
            }
          } else if (!bot.waypoint || Game.dist2D(bot.pos, bot.waypoint) < 2.5){
            bot.waypoint = pickNewWaypoint(bot);
          }
        } else if (!bot.waypoint || Game.dist2D(bot.pos, bot.waypoint) < 2.5){
          bot.waypoint = pickNewWaypoint(bot);
        }
      }
    }

    const move = new THREE.Vector3();
    const isSnip = Game.isSniper(bot.weapon);
    const isShot = bot.weapon === 'shotgun';
    const isLmg  = Game.isLmg(bot.weapon);

    bot.strafeT -= dt;
    if (bot.strafeT <= 0){
      bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
      bot.strafeT = 0.8 + Math.random() * 1.4;
    }

    if (lowHp && bot.coverPoint){
      bot.crouching = false;
      const toCover = new THREE.Vector3(bot.coverPoint.x - bot.pos.x, 0, bot.coverPoint.z - bot.pos.z);
      const distToCover = toCover.length();

      if (distToCover > 1.1){
        move.copy(toCover).normalize();
        avoidObstacles(bot, move, dt);
      } else {
        bot.crouching = !evadingFire;
        const refPos = bot.target ? bot.target.pos : bot.coverPoint;
        const dir = new THREE.Vector3(refPos.x - bot.pos.x, 0, refPos.z - bot.pos.z).normalize();
        move.set(-dir.z * bot.strafeDir, 0, dir.x * bot.strafeDir);
        avoidObstacles(bot, move, dt);
      }

      if (bot.target){
        const t = bot.target;
        const dir = new THREE.Vector3(t.pos.x - bot.pos.x, 0, t.pos.z - bot.pos.z).normalize();
        bot.yaw = Math.atan2(dir.x, dir.z);
        bot.aimT += dt;
        bot.shootCd -= dt;
        if (bot.shootCd <= 0 && bot.aimT >= bot.reaction){
          bot.shootCd = (Game.WEAPONS[bot.weapon].rate / 1000) * (1.3 + Math.random() * 1.0);
          botShoot(bot, t);
        }
      } else if (move.lengthSq() > 0.01){
        bot.yaw = Math.atan2(move.x, move.z);
      }
    } else if (bot.target){
      const t = bot.target;
      const d = Game.dist2D(bot.pos, t.pos);
      const dir = new THREE.Vector3(t.pos.x - bot.pos.x, 0, t.pos.z - bot.pos.z).normalize();
      bot.yaw = Math.atan2(dir.x, dir.z);

      const minRange = isSnip ? 14 : (isShot ? 3 : 6);
      const maxRange = isSnip ? 28 : (isShot ? 9 : 16);

      if (d > maxRange) move.copy(dir);
      else if (d < minRange) move.copy(dir).multiplyScalar(-1);
      else move.set(-dir.z * bot.strafeDir, 0, dir.x * bot.strafeDir);

      avoidObstacles(bot, move, dt);

      bot.aimT += dt;
      bot.shootCd -= dt;
      if (bot.shootCd <= 0 && bot.aimT >= bot.reaction){
        const rateMul = isLmg ? (1.05 + Math.random() * 0.45) : (1.3 + Math.random() * 1.1);
        bot.shootCd = (Game.WEAPONS[bot.weapon].rate / 1000) * rateMul;
        botShoot(bot, t);
      }

      const hasActiveGr = Game.grenades.some(gr => gr.owner === bot);
      if (!hasActiveGr && d > 7 && d < 24 && Math.random() < 0.014){
        const origin = new THREE.Vector3(bot.pos.x, (bot.pos.y || 0) + 1.6, bot.pos.z);
        const tdir = new THREE.Vector3(t.pos.x - bot.pos.x, 0, t.pos.z - bot.pos.z).normalize();
        tdir.y = 0.26;
        tdir.normalize();

        if (bot.molotovs > 0 && d > 8 && d < 20){
          bot.molotovs--;
          Game.spawnGrenade(origin, tdir, bot, 'molotov');
          if (bot.team === Game.player.team) Game.radioMsg(bot.name, 'Поджигаю!');
        } else if (bot.flashes > 0 && d < 18){
          bot.flashes--;
          Game.spawnGrenade(origin, tdir, bot, 'flash');
          if (bot.team === Game.player.team) Game.radioMsg(bot.name, 'Световая пошла!');
        } else if (bot.smokes > 0 && (bot.hp < 55 || isSnip || isLmg)){
          bot.smokes--;
          Game.spawnGrenade(origin, tdir, bot, 'smoke');
          if (bot.team === Game.player.team) Game.radioMsg(bot.name, 'Ставлю дым!');
        } else if (bot.grenades > 0 && d > 8 && d < 22){
          bot.grenades--;
          Game.spawnGrenade(origin, tdir, bot, 'he');
          if (bot.team === Game.player.team) Game.radioMsg(bot.name, 'Бросаю осколочную!');
        }
      }
    } else if (bot.waypoint){
      bot.crouching = false;
      bot.aimT = 0;
      move.set(bot.waypoint.x - bot.pos.x, 0, bot.waypoint.z - bot.pos.z).normalize();
      avoidObstacles(bot, move, dt);
      bot.yaw = Math.atan2(move.x, move.z);
    }

    const wObj = Game.WEAPONS[bot.weapon];
    const botSpd = 5.4 * (wObj.speedMul || 1) * (bot.crouching ? 0.5 : 1) * (now < (bot.slowUntil || 0) ? 0.45 : 1);
    const beforeX = bot.pos.x, beforeZ = bot.pos.z;
    bot.pos.x += move.x * botSpd * dt;
    bot.pos.z += move.z * botSpd * dt;
    Game.resolveCollisions(bot.pos, 0.5);

    const movedDist = Math.hypot(bot.pos.x - beforeX, bot.pos.z - beforeZ);
    const wantedDist = Math.hypot(move.x, move.z) * botSpd * dt;

    if (wantedDist > 0.005 && movedDist < wantedDist * 0.4){
      bot.stuckTimer = (bot.stuckTimer || 0) + dt;
      const perpX = -move.z, perpZ = move.x;
      const perpLen = Math.hypot(perpX, perpZ);
      if (perpLen > 0.001){
        const step = botSpd * dt * 1.3;
        bot.pos.x += (perpX / perpLen) * step * bot.avoidDir;
        bot.pos.z += (perpZ / perpLen) * step * bot.avoidDir;
        Game.resolveCollisions(bot.pos, 0.5);
      }
      if (bot.stuckTimer > 0.7){
        bot.avoidDir *= -1;
        bot.avoidTimer = 1.6;
        if (bot.coverPoint) bot.coverPoint = null;
        if (!bot.target) bot.waypoint = pickNewWaypoint(bot);
        bot.stuckTimer = 0;
      }
    } else {
      bot.stuckTimer = 0;
    }

    const isMoving = move.lengthSq() > 0.01;
    if (isMoving && !bot.crouching){
      bot.stepTimer -= dt;
      if (bot.stepTimer <= 0){
        bot.stepTimer = 0.34;
        Game.snd.footstep(bot.pos, 1);
      }
    } else {
      bot.stepTimer = 0;
    }

    for (const o of Game.allEntities()){
      if (o === bot || o.dead) continue;
      const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 1 && dd > 0.01){ bot.pos.x += dx / dd * 0.5 * dt * 4; bot.pos.z += dz / dd * 0.5 * dt * 4; }
    }
    applyBotPose(bot, dt, isMoving);
  };
})();