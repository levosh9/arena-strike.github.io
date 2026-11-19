'use strict';

(function(){
  const $ = Game.$;
  const CFG = Game.CFG;
  let lastRoundTickSec = -1;

  document.querySelectorAll('.mapCard[data-map]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mapCard').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      Game.state.mapId = card.dataset.map;
      Game.loadMap(Game.state.mapId);
    });
  });

  function aliveCount(team){
    let n = 0;
    for (const e of Game.allEntities()) if (e.team === team && !e.dead) n++;
    return n;
  }

  // --- Логика выпадения и подбора оружия ---
  Game.droppedWeapons = [];

  Game.dropWeapon = function(pos, wkey, ammo, reserve, yaw){
    if (Game.isPistol(wkey) || Game.isKnife(wkey)) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.65),
      new THREE.MeshLambertMaterial({ color: 0x3c4250 })
    );
    const gy = Game.getGroundHeight(pos.x, pos.z);
    mesh.position.set(pos.x, gy + 0.06, pos.z);
    mesh.rotation.y = yaw || Math.random() * Math.PI * 2;
    mesh.rotation.x = Math.PI / 2;
    Game.scene.add(mesh);

    Game.droppedWeapons.push({
      key: wkey,
      ammo,
      reserve,
      mesh,
      pos: new THREE.Vector3(pos.x, gy + 0.06, pos.z)
    });
  };

  Game.pickupWeapon = function(actor){
    if (actor.dead || Game.state.phase !== 'live') return;

    const origin = new THREE.Vector3(actor.pos.x, actor.pos.y + actor.eyeHeight, actor.pos.z);
    const dir = new THREE.Vector3(-Math.sin(actor.yaw), -Math.sin(actor.pitch), -Math.cos(actor.yaw)).normalize();

    let bestWp = null;
    let bestDist = 3.5;
    let bestIdx = -1;

    for (let i = 0; i < Game.droppedWeapons.length; i++){
      const dw = Game.droppedWeapons[i];
      const dist = origin.distanceTo(dw.pos);
      if (dist < bestDist){
        const toWp = dw.pos.clone().sub(origin).normalize();
        if (dir.dot(toWp) > 0.8){
          bestDist = dist;
          bestWp = dw;
          bestIdx = i;
        }
      }
    }

    if (bestWp){
      if (actor.ads) Game.exitADS();
      if (actor.slots.primary){
        Game.dropWeapon(actor.pos, actor.slots.primary.key, actor.slots.primary.ammo, actor.slots.primary.reserve, actor.yaw);
      }

      actor.slots.primary = { key: bestWp.key, ammo: bestWp.ammo, reserve: bestWp.reserve };
      Game.activateSlot('primary');
      Game.snd.buy();

      Game.scene.remove(bestWp.mesh);
      bestWp.mesh.geometry.dispose();
      bestWp.mesh.material.dispose();
      Game.droppedWeapons.splice(bestIdx, 1);

      if (actor.isPlayer) Game.updHUD();
    }
  };
  // -----------------------------------------

  Game.getSiteAt = function(pos){
    for (const site of CFG.BOMBSITES){
      if (Math.hypot(pos.x - site.x, pos.z - site.z) <= CFG.BOMB_SITE_RADIUS){
        return site;
      }
    }
    return null;
  };

  Game.cancelBombAction = function(actor){
    const bomb = Game.bomb;
    if (bomb.actionActor && bomb.actionActor !== actor) return;
    bomb.actionActor = null;
    bomb.actionType = null;
    bomb.actionProgress = 0;
    if (actor && actor.isPlayer) $('bombActionBox').style.display = 'none';
  };

  Game.dropBomb = function(pos){
    const bomb = Game.bomb;
    bomb.status = 'dropped';
    bomb.carrier = null;
    bomb.actionActor = null;
    bomb.actionProgress = 0;
    bomb.actionType = null;
    const gy = Game.getGroundHeight(pos.x, pos.z);
    bomb.pos.set(pos.x, gy, pos.z);
    if (bomb.mesh){
      bomb.mesh.position.copy(bomb.pos);
      bomb.mesh.visible = true;
    }
  };

  Game.advanceBombAction = function(actor, type, dt){
    const bomb = Game.bomb;
    if (Game.state.phase !== 'live') return;

    if (bomb.actionActor && bomb.actionActor !== actor && !bomb.actionActor.dead){
      return;
    }

    if (bomb.actionActor !== actor || bomb.actionType !== type){
      bomb.actionActor = actor;
      bomb.actionType = type;
      bomb.actionProgress = 0;
      Game.snd.bombStart(actor.pos);
    }
    bomb.actionProgress += dt;

    const req = type === 'plant' ? CFG.BOMB_PLANT_TIME : Game.getDefuseTime(actor);
    if (actor.isPlayer){
      $('bombActionBox').style.display = 'block';
      $('bombActionText').textContent = type === 'plant'
        ? 'Закладка бомбы C4...'
        : (actor.defuseKit ? 'Разминирование C4 (набор сапёра)...' : 'Разминирование бомбы C4...');
      $('bombProgress').style.width = Math.min(100, (bomb.actionProgress / req) * 100) + '%';
    }

    if (bomb.actionProgress >= req){
      bomb.actionActor = null;
      bomb.actionProgress = 0;
      bomb.actionType = null;
      if (actor.isPlayer) $('bombActionBox').style.display = 'none';

      if (type === 'plant'){
        const site = Game.getSiteAt(actor.pos);
        if (!site) return;
        bomb.status = 'planted';
        bomb.carrier = null;
        bomb.site = site.id;
        bomb.timer = CFG.BOMB_EXPLODE_TIME;
        bomb.beepTimer = 0.8;
        bomb.wasPlantedThisRound = true;
        const gy = Game.getGroundHeight(actor.pos.x, actor.pos.z);
        bomb.pos.set(actor.pos.x, gy, actor.pos.z);
        if (bomb.mesh){
          bomb.mesh.position.copy(bomb.pos);
          bomb.mesh.visible = true;
        }
        actor.score = (actor.score || 0) + 2;
        Game.snd.bombPlant();
        Game.showBanner('💣 БОМБА УСТАНОВЛЕНА НА ПЛЕНТЕ ' + site.id + '!', 2800, 'loss');
        Game.updHUD();
      } else if (type === 'defuse'){
        bomb.status = 'defused';
        if (bomb.mesh) bomb.mesh.visible = false;
        actor.score = (actor.score || 0) + 2;
        Game.snd.bombDefuse();
        const defTeam = 1 - Game.state.attackTeam;
        endRound(defTeam, 'бомба C4 разминирована');
      }
    }
  };

  function updateBomb(dt){
    const bomb = Game.bomb;
    const st = Game.state;
    if (st.phase !== 'live') return;

    if (bomb.actionActor && bomb.actionActor.dead){
      Game.cancelBombAction(bomb.actionActor);
    }

    if (bomb.status === 'dropped'){
      for (const e of Game.allEntities()){
        if (!e.dead && Game.isAttackTeam(e.team) && Game.dist2D(e.pos, bomb.pos) <= 1.3){
          bomb.status = 'carried';
          bomb.carrier = e;
          if (bomb.mesh) bomb.mesh.visible = false;
          if (e.isPlayer) Game.showMsg('Вы подобрали бомбу C4!', 1600);
          else if (e.team === Game.player.team) Game.radioMsg(e.name, 'Я подобрал бомбу!');
          Game.updHUD();
          break;
        }
      }
    }

    if (bomb.status === 'planted'){
      bomb.timer -= dt;
      bomb.beepTimer -= dt;
      if (bomb.beepTimer <= 0){
        Game.snd.bombBeep(bomb.pos);
        if (bomb.ledMesh) bomb.ledMesh.visible = !bomb.ledMesh.visible;
        bomb.beepTimer = Math.max(0.14, (bomb.timer / CFG.BOMB_EXPLODE_TIME) * 0.95);
      }
      if (bomb.timer <= 0){
        bomb.status = 'exploded';
        if (bomb.mesh) bomb.mesh.visible = false;
        Game.snd.explosion(bomb.pos);
        endRound(st.attackTeam, 'цель уничтожена взрывом C4');
      }
    }
  }

  Game.checkRoundEnd = function(){
    const st = Game.state;
    if (st.phase !== 'live') return;
    const atk = st.attackTeam;
    const def = 1 - atk;
    const aAtk = aliveCount(atk);
    const aDef = aliveCount(def);

    if (aDef === 0){
      endRound(atk, 'защита уничтожена');
    } else if (aAtk === 0 && Game.bomb.status !== 'planted'){
      endRound(def, 'атака уничтожена');
    }
  };

  function resetStarterLoadout(e){
    e.armor = 0;
    e.helmet = false;
    e.defuseKit = false;
    e.grenades = 0;
    e.flashes = 0;
    e.smokes = 0;
    e.molotovs = 0;
    if (e.isPlayer){
      e.slots.primary = null;
      e.slots.secondary = { key: 'pistol', ammo: Game.WEAPONS.pistol.mag, reserve: Game.WEAPONS.pistol.mag * 3 };
      e.slots.melee = { key: 'knife', ammo: 0, reserve: 0 };
      e.currentSlot = 'secondary';
      e.prevSlot = 'secondary';
      e.lastSlot = { slot: 'melee', grenade: null };
      e.activeGrenade = null;
      e.weapon = 'pistol';
      e.ammo = Game.WEAPONS.pistol.mag;
      e.reserve = Game.WEAPONS.pistol.mag * 3;
      Game.equipGun('pistol');
    } else {
      e.weapon = 'pistol';
      if (e.helmetMesh) e.helmetMesh.visible = false;
      if (e.c4BeltMesh) e.c4BeltMesh.visible = false;
    }
  }

  function resetEntities(){
    const st = Game.state;
    let i0 = 0, i1 = 0;
    st.specIdx = 0;
    st.camMode = 0;
    st.specYawOffset = 0;
    st.specPitchOffset = 0;
    lastRoundTickSec = -1;
    Game.specBarHide();
    $('bombActionBox').style.display = 'none';

    Game.clearGrenades();

    for (const dw of Game.droppedWeapons){
      Game.scene.remove(dw.mesh);
      dw.mesh.geometry.dispose();
      dw.mesh.material.dispose();
    }
    Game.droppedWeapons.length = 0;

    const attackers = [];

    for (const e of Game.allEntities()){
      e.dead = false; e.hp = 100; e._lastHp = 100; e.target = null; e.slowUntil = 0; e.blindUntil = 0; e.stepTimer = 0;
      e.crouching = false;
      e.damagedBy = {};
      if (!e.isPlayer){
        e.stuckTimer = 0;
        e.chosenSite = null;
        e.plantAbortUntil = 0;
        e.evadeUntil = 0;
        e.coverPoint = null;
        if (e.c4BeltMesh) e.c4BeltMesh.visible = false;
        if (e.mesh) e.mesh.scale.y = 1.0;
      }

      const sp = Game.getTeamSpawnPoint(e.team);
      const sz = sp.z + CFG.SPAWN_Z[e.isPlayer ? 2 : (e.team === 0 ? i0++ : i1++)];
      e.pos.set(sp.x, Game.getGroundHeight(sp.x, sz), sz);

      if (Game.isAttackTeam(e.team)) attackers.push(e);

      if (e.isPlayer){
        e.yaw = Game.isAttackTeam(e.team) ? Math.PI / 2 : -Math.PI / 2;
        e.pitch = 0; e.vy = 0; e.eyeHeight = 1.7;
        e.crouchToggled = false;
        e.throwCd = 0;
        e.activeGrenade = null;
        if (e.ads) Game.exitADS();
        for (const slotKey of ['primary', 'secondary']){
          const s = e.slots[slotKey];
          if (s){
            const w = Game.WEAPONS[s.key];
            s.ammo = w.mag;
            s.reserve = w.mag * 3;
          }
        }
        e.currentSlot = e.slots.primary ? 'primary' : 'secondary';
        e.prevSlot = e.currentSlot;
        e.lastSlot = { slot: e.slots.primary ? 'secondary' : 'melee', grenade: null };
        const cur = e.slots[e.currentSlot];
        e.weapon = cur.key;
        e.ammo = cur.ammo;
        e.reserve = cur.reserve;
        e.reloading = false;
        Game.equipGun(e.weapon);
      } else {
        Game.botBuyRound(e);
        e.shootCd = 1 + Math.random();
        e.aimT = 0;
        e.reaction = 0.2 + Math.random() * 0.2;
        e.mesh.visible = true;
        e.mesh.position.copy(e.pos);
      }
    }

    const bomb = Game.bomb;
    bomb.status = 'carried';
    bomb.carrier = attackers.length ? attackers[Math.floor(Math.random() * attackers.length)] : null;
    if (bomb.carrier && !bomb.carrier.isPlayer && bomb.carrier.c4BeltMesh){
      bomb.carrier.c4BeltMesh.visible = true;
    }
    bomb.site = null;
    bomb.timer = 0;
    bomb.actionActor = null;
    bomb.actionProgress = 0;
    bomb.actionType = null;
    bomb.wasPlantedThisRound = false;
    if (bomb.mesh) bomb.mesh.visible = false;
  }

  function startRound(){
    const st = Game.state;
    st.roundNum++;

    let halftimeMsg = '';
    if (st.roundNum === CFG.HALF_ROUNDS + 1 && !st.halftimeDone){
      st.halftimeDone = true;
      st.attackTeam = 1 - st.attackTeam;
      st.lossStreak = [0, 0];
      for (const e of Game.allEntities()){
        e.money = CFG.MONEY.start;
        resetStarterLoadout(e);
      }
      halftimeMsg = '🔄 СМЕНА СТОРОН! Теперь вы: ' + (Game.isAttackTeam(Game.player.team) ? 'АТАКА (C4)' : 'ЗАЩИТА') + ' · ';
    }

    st.roundTimeLeft = CFG.ROUND_TIME;
    resetEntities();
    st.phase = 'buy';
    st.phaseTimer = CFG.BUY_TIME;
    const mapTitle = (Game.MAPS[st.mapId] || Game.MAPS.arena).name;
    Game.showBanner(halftimeMsg + mapTitle + ' · РАУНД ' + st.roundNum + ' · ЗАКУПКА [B]', halftimeMsg ? 3800 : 2600);
    Game.updHUD();
    try { Game.renderer.domElement.requestPointerLock(); } catch(e){}
  }

  function endRound(winnerTeam, reason){
    const st = Game.state;
    const p = Game.player;
    st.phase = 'roundEnd';
    st.phaseTimer = 3.5;
    st.scores[winnerTeam]++;
    Game.bomb.actionActor = null;
    Game.bomb.actionType = null;
    Game.bomb.actionProgress = 0;
    $('bombActionBox').style.display = 'none';
    const win = winnerTeam === 0;

    const payouts = [0, 0];
    for (let t = 0; t < 2; t++){
      if (t === winnerTeam){
        payouts[t] = CFG.MONEY.win;
        st.lossStreak[t] = 0;
      } else {
        const idx = Math.min(st.lossStreak[t], CFG.LOSS_BONUS.length - 1);
        payouts[t] = CFG.LOSS_BONUS[idx];
        if (Game.isAttackTeam(t) && Game.bomb.wasPlantedThisRound){
          payouts[t] += CFG.MONEY.plantBonus;
        }
        st.lossStreak[t]++;
      }
    }

    p.money = Math.min(16000, p.money + payouts[p.team]);
    for (const b of Game.bots){
      b.money = Math.min(16000, (b.money || 0) + payouts[b.team]);
    }

    const playerPayout = payouts[p.team];
    const bonusMsg = (p.team === winnerTeam)
      ? '+$' + playerPayout + ' за победу'
      : '+$' + playerPayout + ' бонус за поражение';
    Game.showBanner(
      (win ? 'ПОБЕДА В РАУНДЕ' : 'РАУНД ПРОИГРАН') + ' (' + reason + ') · ' + bonusMsg,
      3300,
      win ? 'win' : 'loss'
    );
    Game.updHUD();

    if (st.scores[winnerTeam] >= CFG.WIN_SCORE){
      st.phase = 'over';
      Game.hideStats();
      if (p.ads) Game.exitADS();
      document.exitPointerLock();
      Game.buyMenu(false);
      Game.specBarHide();
      $('overlay').style.display = 'flex';
      $('overlay').querySelector('p').innerHTML =
        win ? '<b style="color:#7ab7ff">ПОБЕДА!</b> Ваша команда выиграла матч со счётом '
            + st.scores[0] + ':' + st.scores[1] + '.<br>Фрагов: ' + p.kills + '.<br>Нажмите «В БОЙ», чтобы сыграть снова.'
            : '<b style="color:#ff7a7a">ПОРАЖЕНИЕ.</b> Счёт ' + st.scores[0] + ':' + st.scores[1] + '.<br>Фрагов: ' + p.kills + '.<br>Нажмите «В БОЙ», чтобы взять реванш.';
      $('overlay').querySelector('h1').innerHTML = 'ARENA <span>STRIKE</span>';
      return;
    }
    setTimeout(() => { if (Game.state.phase === 'roundEnd') startRound(); }, 3500);
  }

  $('playBtn').addEventListener('click', () => {
    const st = Game.state;
    const p = Game.player;
    Game.initAudio();
    $('overlay').style.display = 'none';
    $('hud').style.display = 'block';
    if (st.phase === 'over'){ location.reload(); return; }
    if (st.phase === 'menu'){
      Game.loadMap(st.mapId);
      st.scores = [0, 0];
      st.roundNum = 0;
      st.attackTeam = 1;
      st.halftimeDone = false;
      st.lossStreak = [0, 0];
      p.money = CFG.MONEY.start;
      p.kills = 0;
      p.assists = 0;
      p.deaths = 0;
      p.hsKills = 0;
      p.damage = 0;
      p.score = 0;
      p.damagedBy = {};
      resetStarterLoadout(p);
      startRound();
    } else {
      Game.renderer.domElement.requestPointerLock();
    }
  });

  function updatePlayer(dt){
    const p = Game.player;
    const st = Game.state;
    const keys = Game.keys;
    const bomb = Game.bomb;
    if (p.dead){ Game.updateSpectator(dt); return; }

    const isGrenadeSlot = p.currentSlot === 'grenade';
    const w = isGrenadeSlot ? { rate: 500, speedMul: 1.05 } : Game.WEAPONS[p.weapon];
    if (p.reloading && performance.now() >= p.reloadEnd) Game.finishReload();
    p.shootCd -= dt;
    if (p.throwCd > 0) p.throwCd -= dt;

    // Приседание на [C]: удержание (по умолчанию) или Toggle (включается в настройках)
    const wantCrouch = !st.menuOpen && (Game.settings.crouchToggle ? p.crouchToggled : keys.has('KeyC'));
    p.crouching = wantCrouch;
    const targetEye = p.crouching ? 1.15 : 1.7;
    p.eyeHeight += (targetEye - p.eyeHeight) * Math.min(1, dt * 14);

    let doingBombAction = false;
    let lookAtWeapon = false;

    if (st.phase === 'live' && !st.menuOpen){
      const canPlant = bomb.status === 'carried' && bomb.carrier === p && Game.getSiteAt(p.pos);
      const canDefuse = bomb.status === 'planted' && !Game.isAttackTeam(p.team) && Game.dist2D(p.pos, bomb.pos) <= CFG.BOMB_USE_RADIUS;

      const origin = new THREE.Vector3(p.pos.x, p.pos.y + p.eyeHeight, p.pos.z);
      const dir = new THREE.Vector3(-Math.sin(p.yaw), -Math.sin(p.pitch), -Math.cos(p.yaw)).normalize();

      for (const dw of Game.droppedWeapons){
        if (origin.distanceTo(dw.pos) < 3.5 && dir.dot(dw.pos.clone().sub(origin).normalize()) > 0.8){
          lookAtWeapon = true;
          break;
        }
      }

      if (keys.has('KeyE') && (canPlant || canDefuse)){
        doingBombAction = true;
        p.crouching = true;
        if (p.ads) Game.exitADS();
        Game.advanceBombAction(p, canPlant ? 'plant' : 'defuse', dt);
      } else {
        if (bomb.actionActor === p){
          Game.cancelBombAction(p);
        }
        if (canPlant){
          $('bombActionBox').style.display = 'block';
          $('bombActionText').textContent = 'Нажмите и удерживайте [E] для закладки C4 (3.0 с)';
          $('bombProgress').style.width = '0%';
        } else if (canDefuse){
          const sec = Game.getDefuseTime(p).toFixed(1);
          $('bombActionBox').style.display = 'block';
          $('bombActionText').textContent = 'Нажмите и удерживайте [E] для разминирования C4 (' + sec + ' с)';
          $('bombProgress').style.width = '0%';
        } else if (lookAtWeapon){
          $('bombActionBox').style.display = 'block';
          $('bombActionText').textContent = 'Нажмите [E] чтобы подобрать оружие';
          $('bombProgress').style.width = '0%';
        } else {
          $('bombActionBox').style.display = 'none';
        }
      }
    } else {
      if (bomb.actionActor === p) Game.cancelBombAction(p);
      $('bombActionBox').style.display = 'none';
    }

    if (Game.input.shooting && !doingBombAction && (w.rate > 200 ? !Game.input.firedOnce : true) && !st.menuOpen){
      if (st.phase === 'live') Game.playerShoot();
      Game.input.firedOnce = true;
    }
    if (!Game.input.shooting) Game.input.firedOnce = false;

    if (st.phase === 'live' && !doingBombAction){
      const isSilentWalk = keys.has('ShiftLeft');
      let baseSpd = 6.4;
      if (p.crouching) baseSpd = 2.4;
      else if (isSilentWalk) baseSpd = 3.2;

      let speed = baseSpd * (w.speedMul || 1);
      if (p.ads) speed *= p.isScoped ? 0.45 : 0.72;
      if (performance.now() < (p.slowUntil || 0)) speed *= 0.55;

      const f = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
      const r = new THREE.Vector3( Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      const move = new THREE.Vector3();
      if (keys.has('KeyW')) move.add(f);
      if (keys.has('KeyS')) move.sub(f);
      if (keys.has('KeyD')) move.add(r);
      if (keys.has('KeyA')) move.sub(r);
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
      p.pos.x += move.x;
      p.pos.z += move.z;
      Game.resolveCollisions(p.pos, 0.45);

      if (keys.has('Space') && p.onGround){ p.vy = 5.4; p.onGround = false; }

      if (move.lengthSq() > 1e-6 && p.onGround && !isSilentWalk && !p.crouching){
        p.stepTimer -= dt;
        if (p.stepTimer <= 0){
          p.stepTimer = 0.34;
          Game.snd.footstep(null, 1);
        }
      } else {
        p.stepTimer = 0;
      }
    }

    const groundY = Game.getGroundHeight(p.pos.x, p.pos.z);
    p.vy -= 14 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= groundY){
      p.pos.y = groundY;
      p.vy = 0;
      p.onGround = true;
    }

    Game.camera.position.set(p.pos.x, p.pos.y + p.eyeHeight, p.pos.z);
    Game.camera.rotation.y = p.yaw;
    Game.camera.rotation.x = p.pitch;
  }

  let hudSyncTimer = 0;

  function updateTimers(dt){
    const st = Game.state;
    const bomb = Game.bomb;

    if (st.phase === 'buy'){
      st.phaseTimer -= dt;
      $('timer').textContent = 'закупка ' + Math.ceil(st.phaseTimer) + ' с';
      if (st.phaseTimer <= 0){
        st.phase = 'live';
        Game.showBanner('РАУНД НАЧАЛСЯ · В БОЙ!', 1800);
      }
    } else if (st.phase === 'live'){
      if (bomb.status === 'planted'){
        $('timer').textContent = 'C4: ' + Math.ceil(Math.max(0, bomb.timer)) + ' с';
      } else {
        st.roundTimeLeft -= dt;
        const secLeft = Math.ceil(Math.max(0, st.roundTimeLeft));
        $('timer').textContent = secLeft + ' с';

        if (secLeft <= 10 && secLeft > 0 && secLeft !== lastRoundTickSec){
          lastRoundTickSec = secLeft;
          Game.snd.roundTick();
        }

        if (st.roundTimeLeft <= 0){
          endRound(1 - st.attackTeam, 'время вышло — цель удержана');
        }
      }
    }

    hudSyncTimer -= dt;
    if (hudSyncTimer <= 0){
      hudSyncTimer = 0.2;
      Game.updHUD();
    }

    if (st.statsShown) Game.renderStats();
  }

  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const ph = Game.state.phase;

    if (ph === 'live' || ph === 'buy'){
      updatePlayer(dt);
      if (ph === 'live'){
        for (const b of Game.bots) Game.updateBot(b, dt);
        updateBomb(dt);
      }
    } else if (ph === 'roundEnd' && Game.player.dead){
      Game.updateSpectator(dt);
    }

    updateTimers(dt);
    Game.updateGun(dt);
    Game.updateHitEffects(dt);
    Game.updateExplosions(dt);
    Game.updateGrenades(dt);
    Game.updateMinimap(dt);
    Game.updateTracers(dt);

    for (const dw of Game.droppedWeapons) dw.mesh.rotation.z += dt * 1.5;

    Game.renderer.render(Game.scene, Game.camera);
    Game.renderer.autoClear = false;
    Game.renderer.clearDepth();
    Game.renderer.render(Game.gunScene, Game.gunCam);
    Game.renderer.autoClear = true;
  }

  Game.camera.position.set(-25, 1.7, 0);
  Game.camera.rotation.y = -Math.PI / 2;
  animate();

  addEventListener('resize', () => {
    Game.camera.aspect = innerWidth / innerHeight;
    Game.camera.updateProjectionMatrix();
    Game.gunCam.aspect = innerWidth / innerHeight;
    Game.gunCam.updateProjectionMatrix();
    Game.renderer.setSize(innerWidth, innerHeight);
  });
})();