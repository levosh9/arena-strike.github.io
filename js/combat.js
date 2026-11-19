'use strict';

(function(){
  const hitEffects = [];
  const tracers = [];
  const grenades = [];
  const explosions = [];
  const fireZones = [];
  let playerBlindAlpha = 0;
  let burstCount = 0;
  let lastShotTime = 0;

  Game.grenades = grenades;
  Game.fireZones = fireZones;

  function spawnHitEffect(point, color){
    const mat = new THREE.SpriteMaterial({
      map: Game.flashTexture, color, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.95
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(0.25, 0.25, 1);
    s.position.copy(point);
    Game.scene.add(s);
    hitEffects.push({ s, life: 0.22, max: 0.22 });
  }

  Game.updateHitEffects = function(dt){
    for (let i = hitEffects.length - 1; i >= 0; i--){
      const e = hitEffects[i];
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      e.s.material.opacity = k;
      const sc = 0.25 + (1 - k) * 0.55;
      e.s.scale.set(sc, sc, 1);
      if (e.life <= 0){
        Game.scene.remove(e.s);
        e.s.material.dispose();
        hitEffects.splice(i, 1);
      }
    }
  };

  Game.tracer = function(a, b){
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    Game.scene.add(line);
    tracers.push({ line, life: 0.07 });
  };

  Game.updateTracers = function(dt){
    for (let i = tracers.length - 1; i >= 0; i--){
      tracers[i].life -= dt;
      tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.07);
      if (tracers[i].life <= 0){
        Game.scene.remove(tracers[i].line);
        tracers.splice(i, 1);
      }
    }
  };

  function recordDamageStats(victim, attacker, actualDmg){
    if (!attacker || attacker === victim || actualDmg <= 0) return;
    if (attacker.team === victim.team) return;
    attacker.damage = (attacker.damage || 0) + actualDmg;
    if (!victim.damagedBy) victim.damagedBy = {};
    victim.damagedBy[attacker.name] = (victim.damagedBy[attacker.name] || 0) + actualDmg;
  }

  /* ---- Урон и смерти ---- */
  function killEntity(victim, attacker, head, weaponOverride){
    const st = Game.state;
    victim.dead = true;
    victim.hp = 0;
    victim.deaths = (victim.deaths || 0) + 1;
    if (!victim.isPlayer){
      victim.mesh.visible = false;
      if (victim.c4BeltMesh) victim.c4BeltMesh.visible = false;
    }

    if (Game.bomb.status === 'carried' && Game.bomb.carrier === victim){
      Game.dropBomb(victim.pos);
    }

    if (victim.slots && victim.slots.primary){
      Game.dropWeapon(victim.pos, victim.slots.primary.key, victim.slots.primary.ammo, victim.slots.primary.reserve, victim.yaw);
    }

    if (attacker && attacker !== victim){
      const wkey = weaponOverride || attacker.weapon;
      Game.feed(attacker, victim, head, wkey);
      attacker.kills = (attacker.kills || 0) + 1;
      if (head) attacker.hsKills = (attacker.hsKills || 0) + 1;
      attacker.score = (attacker.score || 0) + 2;
      attacker.money = Math.min(16000, (attacker.money || 0) + Game.CFG.MONEY.kill);

      if (victim.damagedBy){
        for (const e of Game.allEntities()){
          if (e !== attacker && e.team === attacker.team && (victim.damagedBy[e.name] || 0) >= 40){
            e.assists = (e.assists || 0) + 1;
            e.score = (e.score || 0) + 1;
          }
        }
      }
    }

    if (victim.isPlayer){
      victim.slots.primary = null;
      victim.slots.secondary = { key: 'pistol', ammo: Game.WEAPONS.pistol.mag, reserve: Game.WEAPONS.pistol.mag * 3 };
      victim.currentSlot = 'secondary';
      victim.prevSlot = 'secondary';
      victim.lastSlot = { slot: 'melee', grenade: null };
      victim.activeGrenade = null;
      victim.weapon = 'pistol';
      victim.ammo = Game.WEAPONS.pistol.mag;
      victim.reserve = Game.WEAPONS.pistol.mag * 3;
      victim.armor = 0;
      victim.helmet = false;
      victim.defuseKit = false;
      victim.crouching = false;
      victim.crouchToggled = false;
      victim.eyeHeight = 1.7;
      victim.reloading = false;
      victim.grenades = 0;
      victim.flashes = 0;
      victim.smokes = 0;
      victim.molotovs = 0;
      burstCount = 0;
      playerBlindAlpha = 0;
      Game.$('flashOverlay').style.opacity = 0;
      if (victim.ads) Game.exitADS();
      Game.equipGun('pistol');
      Game.updHUD();
      st.camMode = 0;
      st.specYawOffset = 0;
      st.specPitchOffset = 0;
      st.specIdx = 0;
      Game.showBanner('ВЫ ПОГИБЛИ', 2400, 'loss');
    } else {
      victim.weapon = 'pistol';
      victim.armor = 0;
      victim.helmet = false;
      victim.defuseKit = false;
      victim.crouching = false;
      if (victim.helmetMesh) victim.helmetMesh.visible = false;
      victim.grenades = 0;
      victim.flashes = 0;
      victim.smokes = 0;
      victim.molotovs = 0;
    }
    Game.snd.death();
    if (Game.checkRoundEnd) Game.checkRoundEnd();
  }

  Game.applyDamage = function(victim, dmg, attacker, head, hitPoint, weaponOverride){
    const ph = Game.state.phase;
    if (victim.dead || ph === 'roundEnd' || ph === 'over' || ph === 'buy') return;
    if (head) dmg *= 4;

    if (victim.armor > 0 && weaponOverride !== 'molotov'){
      const absorbRate = head ? (victim.helmet ? 0.3 : 0) : 0.5;
      if (absorbRate > 0){
        const absorbed = Math.min(victim.armor, dmg * absorbRate);
        victim.armor -= absorbed;
        dmg -= absorbed;
      }
      if (victim.armor <= 0){
        victim.armor = 0;
        victim.helmet = false;
        if (!victim.isPlayer && victim.helmetMesh) victim.helmetMesh.visible = false;
      }
    }

    const realDmg = Math.min(victim.hp, Math.max(0, dmg));
    recordDamageStats(victim, attacker, realDmg);

    victim.hp -= dmg;
    if (weaponOverride !== 'molotov'){
      victim.slowUntil = performance.now() + 320;
    }
    if (hitPoint) spawnHitEffect(hitPoint, head ? 0xffd25e : 0xff5533);
    if (victim.isPlayer && weaponOverride !== 'molotov'){ Game.redFlash(); Game.updHUD(); }
    if (attacker && attacker.isPlayer && !victim.isPlayer && weaponOverride !== 'molotov'){
      Game.hitMark();
      if (head) Game.snd.head(); else Game.snd.hitMark();
    }
    if (victim.hp <= 0) killEntity(victim, attacker, head, weaponOverride);
  };

  function applyShotgunDamage(victim, headDmg, bodyDmg, hitPoint){
    const ph = Game.state.phase;
    if (victim.dead || ph === 'roundEnd' || ph === 'over' || ph === 'buy') return;

    let headAfter = headDmg * 4;
    let bodyAfter = bodyDmg;

    if (victim.armor > 0){
      if (victim.helmet && headAfter > 0){
        const headAbsorb = Math.min(victim.armor, headAfter * 0.3);
        victim.armor -= headAbsorb;
        headAfter -= headAbsorb;
      }

      if (bodyAfter > 0){
        const bodyAbsorb = Math.min(victim.armor, bodyAfter * 0.5);
        victim.armor -= bodyAbsorb;
        bodyAfter -= bodyAbsorb;
      }

      if (victim.armor <= 0){
        victim.armor = 0;
        victim.helmet = false;
        if (!victim.isPlayer && victim.helmetMesh) victim.helmetMesh.visible = false;
      }
    }

    const total = headAfter + bodyAfter;
    const realDmg = Math.min(victim.hp, Math.max(0, total));
    recordDamageStats(victim, Game.player, realDmg);

    victim.hp -= total;
    victim.slowUntil = performance.now() + 320;

    if (hitPoint) spawnHitEffect(hitPoint, headDmg > 0 ? 0xffd25e : 0xff5533);
    if (victim.isPlayer){ Game.redFlash(); Game.updHUD(); }
    if (!victim.isPlayer){
      Game.hitMark();
      if (headDmg > 0) Game.snd.head(); else Game.snd.hitMark();
    }
    if (victim.hp <= 0) killEntity(victim, Game.player, headDmg > 0, 'shotgun');
  }

  /* ---- Гранаты: осколочная, световая, дымовая и Молотов ---- */
  Game.spawnGrenade = function(origin, dir, owner, kind = 'he', isShort = false){
    const mesh = new THREE.Group();
    const bodyCol = kind === 'flash' ? 0xd8dee9 : (kind === 'smoke' ? 0x6b7280 : (kind === 'molotov' ? 0xd97706 : 0x3a4a2a));
    const body = new THREE.Mesh(
      kind === 'he' ? new THREE.SphereGeometry(0.11, 8, 8) : new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8),
      new THREE.MeshLambertMaterial({ color: bodyCol })
    );
    mesh.add(body);
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6),
      new THREE.MeshLambertMaterial({ color: kind === 'smoke' ? 0x4caf50 : (kind === 'flash' ? 0x3b82f6 : (kind === 'molotov' ? 0xff6b00 : 0xff5252)) })
    );
    pin.position.y = 0.13;
    mesh.add(pin);
    mesh.position.copy(origin);
    Game.scene.add(mesh);

    const speed = isShort ? 6.5 : 17;
    const vel = dir.clone().normalize().multiplyScalar(speed);
    vel.y += isShort ? 1.2 : 2.5;

    const fuse = kind === 'flash' ? Game.CFG.FLASH_FUSE :
                 (kind === 'smoke' ? Game.CFG.SMOKE_FUSE :
                 (kind === 'molotov' ? Game.CFG.MOLOTOV_FUSE : Game.CFG.GRENADE_FUSE));

    grenades.push({
      kind,
      mesh,
      pos: origin.clone(),
      vel,
      fuse,
      owner,
      spinX: (Math.random() - 0.5) * 12,
      spinZ: (Math.random() - 0.5) * 12
    });
  };

  function spawnExplosion(pos, color = 0xff8822, scale = 12){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: Game.flashTexture, color, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 1
    }));
    s.position.copy(pos);
    s.scale.set(1, 1, 1);
    Game.scene.add(s);
    explosions.push({ s, life: 0.45, max: 0.45, maxScale: scale });
  }

  function spawnSmokeCloud(pos){
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    const r = Game.CFG.SMOKE_RADIUS;
    const mat = new THREE.MeshLambertMaterial({ color: 0xbac2cf, transparent: true, opacity: 0.86 });

    const puffs = [
      [0, 1.5, 0, r * 0.62],
      [-r * 0.35, 1.2, -r * 0.25, r * 0.48],
      [ r * 0.35, 1.2,  r * 0.25, r * 0.48],
      [-r * 0.25, 1.3,  r * 0.35, r * 0.46],
      [ r * 0.25, 1.3, -r * 0.35, r * 0.46],
      [0, 2.3, 0, r * 0.45]
    ];
    for (const [px, py, pz, pr] of puffs){
      const m = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), mat);
      m.position.set(px, py, pz);
      group.add(m);
    }

    Game.scene.add(group);
    Game.smokeClouds.push({
      pos: new THREE.Vector3(pos.x, 0, pos.z),
      radius: r,
      life: Game.CFG.SMOKE_DURATION,
      max: Game.CFG.SMOKE_DURATION,
      group,
      mat
    });
  }

  function spawnFireZone(pos, owner){
    if (Game.smokeClouds){
      for (const sm of Game.smokeClouds){
        if (Math.hypot(sm.pos.x - pos.x, sm.pos.z - pos.z) <= sm.radius + 1.5){
          Game.snd.smokePop(pos);
          return;
        }
      }
    }

    const group = new THREE.Group();
    const gy = Game.getGroundHeight(pos.x, pos.z);
    group.position.set(pos.x, gy + 0.03, pos.z);
    const r = Game.CFG.MOLOTOV_RADIUS;

    const baseMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.55 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28), baseMat);
    disc.rotation.x = -Math.PI / 2;
    group.add(disc);

    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa01e, transparent: true, opacity: 0.78 });
    const flames = [];
    for (let i = 0; i < 10; i++){
      const ang = (i / 10) * Math.PI * 2;
      const dist = (i === 0) ? 0 : (0.3 + Math.random() * 0.65) * r;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 6), flameMat);
      cone.position.set(Math.cos(ang) * dist, 0.5, Math.sin(ang) * dist);
      group.add(cone);
      flames.push(cone);
    }

    Game.scene.add(group);
    fireZones.push({
      pos: new THREE.Vector3(pos.x, gy, pos.z),
      radius: r,
      life: Game.CFG.MOLOTOV_DURATION,
      max: Game.CFG.MOLOTOV_DURATION,
      owner,
      group,
      baseMat,
      flameMat,
      flames,
      tickTimer: 0.25
    });
  }

  function explodeFlash(g){
    spawnExplosion(g.pos, 0xffffff, 8);
    let playerBlinded = false;

    for (const e of Game.allEntities()){
      if (e.dead) continue;
      const d = Game.dist2D(e.pos, g.pos);
      if (d > Game.CFG.FLASH_RADIUS) continue;
      if (!Game.grenadeLOS(g.pos, e)) continue;

      const distFactor = 1 - d / Game.CFG.FLASH_RADIUS;
      const toFlash = new THREE.Vector2(g.pos.x - e.pos.x, g.pos.z - e.pos.z).normalize();
      const lookDir = e.isPlayer
        ? new THREE.Vector2(-Math.sin(e.yaw), -Math.cos(e.yaw))
        : new THREE.Vector2(Math.sin(e.yaw), Math.cos(e.yaw));
      const dot = toFlash.dot(lookDir);

      const facingMul = dot > 0.2 ? 1.0 : (dot > -0.3 ? 0.55 : 0.25);
      const blindSec = (1.2 + 2.8 * distFactor) * facingMul;

      e.blindUntil = Math.max(e.blindUntil || 0, performance.now() + blindSec * 1000);
      if (!e.isPlayer){
        e.target = null;
        e.slowUntil = Math.max(e.slowUntil || 0, performance.now() + blindSec * 600);
      } else {
        playerBlindAlpha = Math.min(1, Math.max(playerBlindAlpha, (0.55 + 0.45 * distFactor) * facingMul));
        playerBlinded = true;
      }
    }

    Game.snd.flashbang(g.pos, playerBlinded);
  }

  function explodeGrenade(g){
    if (g.kind === 'flash'){
      explodeFlash(g);
      return;
    }
    if (g.kind === 'smoke'){
      Game.snd.smokePop(g.pos);
      spawnSmokeCloud(g.pos);
      return;
    }
    if (g.kind === 'molotov'){
      Game.snd.molotovBurst(g.pos);
      spawnExplosion(g.pos, 0xff5500, 7);
      spawnFireZone(g.pos, g.owner);
      return;
    }

    spawnExplosion(g.pos, 0xff8822, 12);
    Game.snd.explosion(g.pos);

    for (const e of Game.allEntities()){
      if (e.dead) continue;
      const d = Game.dist2D(e.pos, g.pos);
      if (d > Game.CFG.GRENADE_RADIUS) continue;
      if (!Game.grenadeLOS(g.pos, e)) continue;
      const dmg = Game.CFG.GRENADE_MAX_DMG * (1 - d / Game.CFG.GRENADE_RADIUS);
      if (dmg < 2) continue;
      const ph = Game.state.phase;
      if (ph === 'live' || ph === 'roundEnd'){
        Game.applyDamage(e, dmg, g.owner, false, null, 'grenade');
      }
    }
  }

  Game.updateExplosions = function(dt){
    for (let i = explosions.length - 1; i >= 0; i--){
      const e = explosions[i];
      e.life -= dt;
      const k = 1 - e.life / e.max;
      e.s.material.opacity = Math.max(0, 1 - k);
      const sc = 1 + k * (e.maxScale || 12);
      e.s.scale.set(sc, sc, 1);
      if (e.life <= 0){
        Game.scene.remove(e.s);
        e.s.material.dispose();
        explosions.splice(i, 1);
      }
    }

    for (let i = Game.smokeClouds.length - 1; i >= 0; i--){
      const sm = Game.smokeClouds[i];
      sm.life -= dt;
      sm.group.rotation.y += dt * 0.25;
      if (sm.life < 2.5){
        sm.mat.opacity = Math.max(0, (sm.life / 2.5) * 0.86);
      }
      if (sm.life <= 0){
        Game.scene.remove(sm.group);
        sm.mat.dispose();
        Game.smokeClouds.splice(i, 1);
      }
    }

    for (let i = fireZones.length - 1; i >= 0; i--){
      const fz = fireZones[i];
      fz.life -= dt;
      fz.tickTimer -= dt;

      for (let j = 0; j < fz.flames.length; j++){
        fz.flames[j].scale.y = 0.7 + Math.sin(performance.now() * 0.015 + j) * 0.35;
      }

      if (fz.life < 1.5){
        const fade = Math.max(0, fz.life / 1.5);
        fz.baseMat.opacity = fade * 0.55;
        fz.flameMat.opacity = fade * 0.78;
      }

      if (fz.tickTimer <= 0){
        fz.tickTimer = 0.25;
        const tickDmg = Game.CFG.MOLOTOV_DPS * 0.25;
        for (const e of Game.allEntities()){
          if (e.dead) continue;
          const dist = Game.dist2D(e.pos, fz.pos);
          const dy = Math.abs(e.pos.y - fz.pos.y);
          if (dist <= fz.radius && dy < 1.2){
            Game.applyDamage(e, tickDmg, fz.owner, false, null, 'molotov');
          }
        }
      }

      if (fz.life <= 0){
        Game.scene.remove(fz.group);
        fz.baseMat.dispose();
        fz.flameMat.dispose();
        fireZones.splice(i, 1);
      }
    }

    if (playerBlindAlpha > 0){
      const now = performance.now();
      if (now > (Game.player.blindUntil || 0)){
        playerBlindAlpha = Math.max(0, playerBlindAlpha - dt * 0.9);
      }
      Game.$('flashOverlay').style.opacity = playerBlindAlpha.toFixed(3);
    }
  };

  Game.updateGrenades = function(dt){
    for (let i = grenades.length - 1; i >= 0; i--){
      const g = grenades[i];
      g.fuse -= dt;

      g.vel.y -= 18 * dt;
      g.pos.x += g.vel.x * dt;
      g.pos.y += g.vel.y * dt;
      g.pos.z += g.vel.z * dt;

      const gy = Game.getGroundHeight(g.pos.x, g.pos.z) + 0.12;
      if (g.pos.y < gy){
        g.pos.y = gy;
        if (g.kind === 'molotov'){
          g.fuse = 0;
        } else {
          if (g.vel.y < 0) g.vel.y *= -0.35;
          g.vel.x *= 0.7;
          g.vel.z *= 0.7;
        }
      }

      for (const c of Game.colliders){
        const r = 0.12;
        if (g.pos.x > c.minX - r && g.pos.x < c.maxX + r && g.pos.z > c.minZ - r && g.pos.z < c.maxZ + r){
          if (g.pos.y < c.maxY){
            const dxl = g.pos.x - (c.minX - r), dxr = (c.maxX + r) - g.pos.x;
            const dzl = g.pos.z - (c.minZ - r), dzr = (c.maxZ + r) - g.pos.z;
            const m = Math.min(dxl, dxr, dzl, dzr);
            if (m === dxl){ g.pos.x = c.minX - r; g.vel.x = -Math.abs(g.vel.x) * 0.55; }
            else if (m === dxr){ g.pos.x = c.maxX + r; g.vel.x = Math.abs(g.vel.x) * 0.55; }
            else if (m === dzl){ g.pos.z = c.minZ - r; g.vel.z = -Math.abs(g.vel.z) * 0.55; }
            else { g.pos.z = c.maxZ + r; g.vel.z = Math.abs(g.vel.z) * 0.55; }
          }
        }
      }

      g.mesh.rotation.x += g.spinX * dt;
      g.mesh.rotation.z += g.spinZ * dt;
      g.mesh.position.copy(g.pos);

      if (g.fuse <= 0){
        explodeGrenade(g);
        Game.scene.remove(g.mesh);
        grenades.splice(i, 1);
      }
    }
  };

  Game.clearGrenades = function(){
    for (const g of grenades) Game.scene.remove(g.mesh);
    grenades.length = 0;

    for (const sm of Game.smokeClouds){
      Game.scene.remove(sm.group);
      sm.mat.dispose();
    }
    Game.smokeClouds.length = 0;

    for (const fz of fireZones){
      Game.scene.remove(fz.group);
      fz.baseMat.dispose();
      fz.flameMat.dispose();
    }
    fireZones.length = 0;

    playerBlindAlpha = 0;
    Game.$('flashOverlay').style.opacity = 0;
  };

  Game.throwPlayerUtility = function(kind, isShort = false){
    const p = Game.player;
    if (p.dead || Game.state.phase !== 'live' || p.throwCd > 0) return;

    if (kind === 'he'){
      if (p.grenades <= 0){ Game.showMsg('Нет осколочной гранаты — купите в магазине [B]', 1400); return; }
      p.grenades--;
      Game.radioMsg('Вы', 'Бросаю осколочную!');
    } else if (kind === 'flash'){
      if (p.flashes <= 0){ Game.showMsg('Нет световой гранаты — купите в магазине [B]', 1400); return; }
      p.flashes--;
      Game.radioMsg('Вы', 'Световая пошла!');
    } else if (kind === 'smoke'){
      if (p.smokes <= 0){ Game.showMsg('Нет дымовой гранаты — купите в магазине [B]', 1400); return; }
      p.smokes--;
      Game.radioMsg('Вы', 'Ставлю дым!');
    } else if (kind === 'molotov'){
      if (p.molotovs <= 0){ Game.showMsg('Нет зажигательной гранаты — купите в магазине [B]', 1400); return; }
      p.molotovs--;
      Game.radioMsg('Вы', 'Поджигаю!');
    } else {
      return;
    }

    if (p.ads) Game.exitADS();
    p.throwCd = 0.5;
    Game.input.shooting = false;

    const dir = new THREE.Vector3();
    Game.camera.getWorldDirection(dir);
    dir.y += isShort ? 0.08 : 0.15;
    dir.normalize();
    Game.spawnGrenade(Game.camera.position.clone(), dir, p, kind, isShort);

    const backSlot = (p.prevSlot && p.slots[p.prevSlot]) ? p.prevSlot : (p.slots.primary ? 'primary' : 'secondary');
    const rem = Game.getOwnedGrenades(p);
    p.activeGrenade = rem.length ? rem[0] : null;
    Game.activateSlot(backSlot);
    Game.updHUD();
  };

  /* ---- Стрельба, нож и перезарядка игрока ---- */
  function fireKnifeSlash(w){
    const p = Game.player;
    const rc = Game.bulletRaycaster;
    rc.setFromCamera(new THREE.Vector2(0, 0), Game.camera);
    rc.far = w.range || 2.5;

    const shootables = [...Game.obstacleMeshes];
    for (const b of Game.bots) if (!b.dead && b.team !== 0) shootables.push(b.body, b.head);
    const hits = rc.intersectObjects(shootables);

    if (hits.length && hits[0].object.userData && hits[0].object.userData.bot){
      const h = hits[0];
      const bot = h.object.userData.bot;
      Game.snd.knifeHit();
      const pFwd = new THREE.Vector2(-Math.sin(p.yaw), -Math.cos(p.yaw));
      const bFwd = new THREE.Vector2(Math.sin(bot.yaw), Math.cos(bot.yaw));
      const isBackstab = pFwd.dot(bFwd) > 0.5;
      const dmg = (isBackstab || h.object.userData.head) ? 130 : w.dmg;
      Game.applyDamage(bot, dmg, p, h.object.userData.head, h.point, 'knife');
    } else {
      Game.snd.knifeMiss();
    }
  }

  function fireSingleBullet(w){
    const p = Game.player;
    const rc = Game.bulletRaycaster;
    let spread = w.spread * (p.onGround ? 1 : 2.2);

    if (Game.isLmg(p.weapon)){
      const stab = Math.min(1, Math.max(0, (burstCount - 2) / 11));
      spread = (0.075 * (1 - stab) + 0.004 * stab) * (p.onGround ? 1 : 2.0);
    }

    if (p.crouching) spread *= 0.65;
    if (p.ads) spread *= 0.6;

    rc.setFromCamera(new THREE.Vector2(
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * spread * 2
    ), Game.camera);
    rc.far = 200;

    const shootables = [...Game.obstacleMeshes];
    for (const b of Game.bots) if (!b.dead && b.team !== 0) shootables.push(b.body, b.head);
    const hits = rc.intersectObjects(shootables);
    const from = Game.camera.position.clone();

    if (hits.length){
      const h = hits[0];
      Game.tracer(from, h.point);
      const ud = h.object.userData;
      if (ud && ud.bot){
        const d = from.distanceTo(h.point);
        const falloff = 1 - Math.min(0.25, d / 160);
        Game.applyDamage(ud.bot, w.dmg * falloff, p, ud.head, h.point);
      }
    } else {
      Game.tracer(from, from.clone().add(rc.ray.direction.clone().multiplyScalar(60)));
    }
  }

  function fireShotgunPellets(w){
    const rc = Game.bulletRaycaster;
    const PELLETS = w.pellets || 8;
    const hitsByBot = new Map();
    const from = Game.camera.position.clone();

    for (let i = 0; i < PELLETS; i++){
      const spread = w.spread * (Game.player.crouching ? 0.75 : 1);
      rc.setFromCamera(new THREE.Vector2(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2
      ), Game.camera);
      rc.far = 60;
      const shootables = [...Game.obstacleMeshes];
      for (const b of Game.bots) if (!b.dead && b.team !== 0) shootables.push(b.body, b.head);
      const hits = rc.intersectObjects(shootables);
      if (hits.length){
        const h = hits[0];
        Game.tracer(from, h.point);
        const ud = h.object.userData;
        if (ud && ud.bot){
          const dist = from.distanceTo(h.point);
          const falloff = Math.max(0.3, 1 - dist / 25);
          const perDmg = w.dmg * falloff;
          const info = hitsByBot.get(ud.bot) || { headDmg: 0, bodyDmg: 0, point: h.point.clone() };
          if (ud.head) info.headDmg += perDmg;
          else info.bodyDmg += perDmg;
          if (!info.point) info.point = h.point.clone();
          hitsByBot.set(ud.bot, info);
        }
      } else {
        Game.tracer(from, from.clone().add(rc.ray.direction.clone().multiplyScalar(30)));
      }
    }

    for (const [victim, info] of hitsByBot){
      applyShotgunDamage(victim, info.headDmg, info.bodyDmg, info.point);
    }
  }

  Game.startReload = function(){
    const p = Game.player;
    if (p.currentSlot === 'grenade') return;
    const w = Game.WEAPONS[p.weapon];
    if (w.melee || p.reloading || p.ammo === w.mag || p.reserve <= 0) return;
    if (p.ads) Game.exitADS();
    burstCount = 0;
    p.reloading = true;
    p.reloadEnd = performance.now() + w.reload * 1000;
    Game.showMsg('Перезарядка...', w.reload * 1000);
  };

  Game.finishReload = function(){
    const p = Game.player;
    const w = Game.WEAPONS[p.weapon];
    const need = w.mag - p.ammo;
    const take = Math.min(need, p.reserve);
    p.ammo += take;
    p.reserve -= take;
    p.reloading = false;
    Game.syncAmmoToSlot();
    Game.updHUD();
  };

  Game.playerShoot = function(){
    const p = Game.player;
    if (p.dead || p.reloading || p.shootCd > 0) return;

    if (p.currentSlot === 'grenade'){
      if (p.activeGrenade) Game.throwPlayerUtility(p.activeGrenade, false);
      return;
    }

    const w = Game.WEAPONS[p.weapon];

    if (w.melee){
      p.shootCd = w.rate / 1000;
      Game.gunFx.slash = 1.0;
      fireKnifeSlash(w);
      return;
    }

    if (p.ammo <= 0){ Game.startReload(); return; }

    const now = performance.now();
    if (now - lastShotTime > 260) burstCount = 0;
    burstCount++;
    lastShotTime = now;

    p.ammo--;
    p.shootCd = w.rate / 1000;

    if (w.pellets){
      Game.snd.shotgun();
      Game.triggerMuzzleFlash(0.06);
      Game.gunFx.recoil = Math.min(1.0, Game.gunFx.recoil + 1.2);
      fireShotgunPellets(w);
    } else {
      if (Game.isSniper(p.weapon)) Game.snd.sniper(); else Game.snd.shot();
      Game.triggerMuzzleFlash(0.05);
      Game.gunFx.recoil = Math.min(0.9, Game.gunFx.recoil + (Game.isSniper(p.weapon) ? 1.0 : 0.55));
      fireSingleBullet(w);
    }

    let kick = 0.006;
    if (Game.isSniper(p.weapon)) kick = 0.02;
    else if (w.pellets) kick = 0.03;
    else if (Game.isLmg(p.weapon)) kick = burstCount > 10 ? 0.0015 : 0.009;
    if (p.crouching) kick *= 0.7;

    p.pitch += kick + Math.random() * 0.003;
    p.yaw += (Math.random() - 0.5) * (Game.isLmg(p.weapon) && burstCount > 10 ? 0.001 : 0.004);
    Game.syncAmmoToSlot();
    Game.updHUD();
  };
})();