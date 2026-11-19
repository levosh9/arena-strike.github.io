'use strict';

(function(){
  const $ = Game.$;

  Game.getBuyStatus = function(){
    const p = Game.player;
    const st = Game.state;
    const CFG = Game.CFG;

    if (p.dead) return { ok: false, reason: 'Нельзя закупаться после смерти', timeLeft: 0 };
    if (st.phase !== 'buy' && st.phase !== 'live'){
      return { ok: false, reason: 'Закупка сейчас недоступна', timeLeft: 0 };
    }

    const extraAfterBuy = Math.max(0, CFG.BUY_WINDOW - CFG.BUY_TIME);
    const timeLeft = st.phase === 'buy'
      ? Math.ceil(st.phaseTimer + extraAfterBuy)
      : Math.ceil(extraAfterBuy - (CFG.ROUND_TIME - st.roundTimeLeft));

    if (timeLeft <= 0){
      return { ok: false, reason: 'Время закупки истекло (' + CFG.BUY_WINDOW + ' с)', timeLeft: 0 };
    }

    const zoneX = Game.getTeamSpawnX(p.team);
    const dist = Math.hypot(p.pos.x - zoneX, p.pos.z - CFG.BUY_ZONE_Z);
    if (dist > CFG.BUY_ZONE_RADIUS){
      return { ok: false, reason: 'Вы вышли из зоны закупки на спавне', timeLeft };
    }

    return { ok: true, reason: '', timeLeft };
  };

  function getHudSubject(){
    const p = Game.player;
    const st = Game.state;
    if (!p.dead) return p;
    if (st.camMode !== 2 && Game.spectateList){
      const list = Game.spectateList();
      if (list.length){
        const b = list[Math.min(st.specIdx, list.length - 1)];
        if (b && !b.dead) return b;
      }
    }
    return null;
  }

  function getGrenadeLabel(kind, team){
    if (kind === 'molotov'){
      return Game.isAttackTeam(team) ? 'Коктейль Молотова' : 'Зажигательная граната';
    }
    return (Game.GRENADE_META[kind] && Game.GRENADE_META[kind].name) || 'Граната';
  }

  function refreshBuyMenuUI(){
    const p = Game.player;
    const CFG = Game.CFG;
    const isDef = !Game.isAttackTeam(p.team);

    const mollyNameEl = $('mollyShopName');
    if (mollyNameEl){
      mollyNameEl.textContent = isDef ? 'Зажигательная граната [4]' : 'Коктейль Молотова [4]';
    }

    document.querySelectorAll('.buyRow[data-buy]').forEach(row => {
      const key = row.dataset.buy;
      const priceEl = row.querySelector('.price');
      let isOwned = false;
      let cost = 0;
      let disabledSide = false;

      if (key === 'pistol'){
        isOwned = true;
      } else if (key === 'armor'){
        isOwned = p.armor >= 100;
        cost = CFG.ARMOR_PRICE;
      } else if (key === 'armor_helmet'){
        isOwned = p.armor >= 100 && p.helmet;
        cost = (p.armor >= 100 && !p.helmet) ? CFG.HELMET_UPGRADE_PRICE : CFG.HELMET_ARMOR_PRICE;
        if (priceEl && !isOwned) priceEl.textContent = '$' + cost;
      } else if (key === 'defuse_kit'){
        isOwned = Boolean(p.defuseKit);
        cost = CFG.DEFUSE_KIT_PRICE;
        disabledSide = !isDef;
        if (priceEl && !isOwned){
          priceEl.textContent = isDef ? ('$' + cost) : 'только защита';
        }
      } else if (key === 'grenade'){
        isOwned = p.grenades >= 1;
        cost = CFG.GRENADE_PRICE;
      } else if (key === 'flash'){
        isOwned = p.flashes >= 1;
        cost = CFG.FLASH_PRICE;
      } else if (key === 'smoke'){
        isOwned = p.smokes >= 1;
        cost = CFG.SMOKE_PRICE;
      } else if (key === 'molotov'){
        isOwned = p.molotovs >= 1;
        cost = CFG.MOLOTOV_PRICE;
      } else if (key === 'pistol_mid' || key === 'pistol_deagle'){
        isOwned = Boolean(p.slots.secondary && p.slots.secondary.key === key);
        cost = Game.WEAPONS[key].price;
      } else if (Game.WEAPONS[key]){
        isOwned = Boolean(p.slots.primary && p.slots.primary.key === key);
        cost = Game.WEAPONS[key].price;
      }

      row.classList.toggle('owned', isOwned || disabledSide);
      row.classList.toggle('cant', !isOwned && !disabledSide && p.money < cost);
    });
  }

  Game.updHUD = function(){
    const p = Game.player;
    const st = Game.state;
    const bomb = Game.bomb;
    const subj = getHudSubject();

    if (subj){
      $('hpVal').textContent = Math.max(0, Math.ceil(subj.hp));
      $('arVal').textContent = Math.ceil(subj.armor);
      $('helmInd').textContent = (subj.helmet && subj.armor > 0) ? '+ ШЛЕМ' : '';
      $('hpBar').style.width = Math.max(0, subj.hp) + '%';
      $('hpBar').style.background = subj.hp > 50 ? '#4caf50' : (subj.hp > 25 ? '#ffb300' : '#e5484d');
      $('arBar').style.width = subj.armor + '%';

      if (subj.isPlayer && subj.currentSlot === 'grenade' && subj.activeGrenade){
        const meta = Game.GRENADE_META[subj.activeGrenade];
        $('ammoVal').textContent = subj[meta.field] || 0;
        $('reserveWrap').style.display = 'none';
        $('wName').textContent = getGrenadeLabel(subj.activeGrenade, subj.team) + ' (ЛКМ / ПКМ)';
      } else {
        const w = Game.WEAPONS[subj.weapon];
        if (w.melee){
          $('ammoVal').textContent = '∞';
          $('reserveWrap').style.display = 'none';
        } else {
          $('reserveWrap').style.display = '';
          const curAmmo = (subj.ammo !== undefined) ? subj.ammo : w.mag;
          const curRes  = (subj.reserve !== undefined) ? subj.reserve : (w.mag * 3);
          $('ammoVal').textContent = curAmmo;
          $('reserveVal').textContent = curRes;
        }
        $('wName').textContent = subj.reloading ? (w.name + ' (перезарядка)') : w.name;
      }
    } else {
      $('hpVal').textContent = 0;
      $('arVal').textContent = 0;
      $('helmInd').textContent = '';
      $('hpBar').style.width = '0%';
      $('arBar').style.width = '0%';
      $('reserveWrap').style.display = '';
      $('ammoVal').textContent = 0;
      $('reserveVal').textContent = 0;
      $('wName').textContent = 'Свободная камера';
    }

    $('moneyVal').textContent = p.money;
    $('sideRole').textContent = Game.isAttackTeam(p.team) ? '⚔ АТАКА (C4)' : '🛡 ЗАЩИТА';
    $('sideRole').style.color = Game.isAttackTeam(p.team) ? '#ffb84d' : '#7ab7ff';

    $('score0').textContent = st.scores[0];
    $('score1').textContent = st.scores[1];
    $('roundNum').textContent = st.roundNum;
    $('buyMoney').textContent = p.money;
    refreshBuyMenuUI();

    const badge = $('bombHudBadge');
    if (bomb.status === 'planted'){
      badge.style.display = 'block';
      badge.textContent = '💣 C4 НА ПЛЕНТЕ ' + bomb.site + ' (' + Math.ceil(Math.max(0, bomb.timer)) + ' с)';
    } else {
      badge.style.display = 'none';
    }

    const carryEl = $('bombCarryInd');
    const kitEl = $('kitInd');
    if (!p.dead){
      let slotHtml = '';
      if (p.slots.primary){
        const act1 = p.currentSlot === 'primary';
        slotHtml += '<span style="' + (act1 ? 'color:#ffd76e;font-weight:700' : 'color:#7a8090') + '">[1] ' +
                    Game.WEAPONS[p.slots.primary.key].name + '</span> · ';
      }
      const act2 = p.currentSlot === 'secondary';
      slotHtml += '<span style="' + (act2 ? 'color:#ffd76e;font-weight:700' : 'color:#7a8090') + '">[2] ' +
                  Game.WEAPONS[p.slots.secondary.key].name + '</span> · ';
      const act3 = p.currentSlot === 'melee';
      slotHtml += '<span style="' + (act3 ? 'color:#ffd76e;font-weight:700' : 'color:#7a8090') + '">[3] Нож</span>';

      $('slotInd').innerHTML = slotHtml;

      const act4 = p.currentSlot === 'grenade';
      const grParts = Game.GRENADE_ORDER.map(k => {
        const m = Game.GRENADE_META[k];
        const cnt = p[m.field] || 0;
        const sel = act4 && p.activeGrenade === k;
        const style = sel ? 'color:#ffd76e;font-weight:700' : (cnt > 0 ? 'color:#cfcabb' : 'color:#5c6375');
        return '<span style="' + style + '">' + m.icon + cnt + '</span>';
      });
      $('grenadeInd').innerHTML = '<span style="' + (act4 ? 'color:#ffd76e;font-weight:700' : 'color:#7a8090') + '">[4]</span> ' + grParts.join(' · ');

      kitEl.style.display = (p.defuseKit && !Game.isAttackTeam(p.team)) ? 'block' : 'none';
      carryEl.style.display = (bomb.status === 'carried' && bomb.carrier === p) ? 'block' : 'none';
    } else if (subj){
      $('slotInd').innerHTML = '<span style="color:#7ab7ff">Наблюдение: ' + subj.name + '</span>';
      $('grenadeInd').textContent = '💣' + (subj.grenades || 0) + ' · ⚡' + (subj.flashes || 0) + ' · 💨' + (subj.smokes || 0) + ' · 🔥' + (subj.molotovs || 0);
      kitEl.style.display = (subj.defuseKit && !Game.isAttackTeam(subj.team)) ? 'block' : 'none';
      carryEl.style.display = (bomb.status === 'carried' && bomb.carrier === subj) ? 'block' : 'none';
    } else {
      $('slotInd').innerHTML = '';
      $('grenadeInd').textContent = '';
      kitEl.style.display = 'none';
      carryEl.style.display = 'none';
    }

    const buySt = Game.getBuyStatus();
    if (st.menuOpen && !buySt.ok){
      Game.buyMenu(false);
      Game.showMsg(buySt.reason, 1800);
    }
    const hint = $('buyHint');
    if (hint){
      if (p.dead){
        hint.textContent = '[TAB] статистика · [V] сменить камеру · [ЛКМ] следующий игрок';
      } else if (buySt.ok){
        hint.innerHTML = '<span style="color:#8fe38f">[B] магазин (' + buySt.timeLeft + ' с)</span> · [TAB] статистика · [1-4/Колесо/Q] слоты · [C] присед';
      } else {
        hint.textContent = '[TAB] статистика · [1-4/Колесо/Q] слоты · [Shift] тихий шаг · [C] присед';
      }
    }
  };

  Game.showBanner = function(text, ms = 2600, tone = ''){
    const b = $('banner');
    b.textContent = text;
    b.className = tone;
    b.style.opacity = 1;
    clearTimeout(b._t);
    b._t = setTimeout(() => b.style.opacity = 0, ms);
  };

  Game.radioMsg = function(senderName, text){
    const box = $('radioChat');
    const row = document.createElement('div');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'rName';
    nameSpan.textContent = senderName + ' ';

    const tagSpan = document.createElement('span');
    tagSpan.className = 'rTag';
    tagSpan.textContent = '(РАДИО): ';

    const textSpan = document.createElement('span');
    textSpan.className = 'rText';
    textSpan.textContent = text;

    row.appendChild(nameSpan);
    row.appendChild(tagSpan);
    row.appendChild(textSpan);
    box.appendChild(row);

    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => {
      row.style.opacity = 0;
      setTimeout(() => { if (row.parentNode) row.remove(); }, 550);
    }, 3800);
  };

  Game.showMsg = function(text, ms = 1800){
    const m = $('sysToast');
    m.textContent = text;
    m.style.opacity = 1;
    clearTimeout(m._t);
    m._t = setTimeout(() => m.style.opacity = 0, ms);
  };

  Game.specBarShow = function(text){
    const s = $('specBar');
    s.textContent = text;
    s.style.display = 'block';
  };
  Game.specBarHide = function(){ $('specBar').style.display = 'none'; };

  Game.feed = function(killer, victim, head, weaponKey){
    const d = document.createElement('div');
    d.className = 't' + killer.team;

    let tagLabel, tagClass;
    if (weaponKey === 'grenade'){
      tagLabel = ' [Граната]';
      tagClass = 'gr';
    } else if (weaponKey === 'molotov'){
      tagLabel = ' [Огонь]';
      tagClass = 'gr';
    } else if (weaponKey === 'knife'){
      tagLabel = ' [Нож]';
      tagClass = 'wpn';
    } else {
      tagLabel = ' [' + ((weaponKey && Game.WEAPONS[weaponKey]) ? Game.WEAPONS[weaponKey].name : 'оружие') + ']';
      tagClass = 'wpn';
    }

    const kSpan = document.createElement('span'); kSpan.textContent = killer.name;
    const wSpan = document.createElement('span'); wSpan.className = tagClass; wSpan.textContent = tagLabel;
    const sep = document.createElement('span');   sep.textContent = ' ☠ ';
    const vSpan = document.createElement('span'); vSpan.textContent = victim.name;

    d.appendChild(kSpan); d.appendChild(wSpan); d.appendChild(sep); d.appendChild(vSpan);

    if (head && weaponKey !== 'knife'){
      const hs = document.createElement('span');
      hs.className = 'hs';
      hs.textContent = ' [в голову]';
      d.appendChild(hs);
    }

    $('feed').prepend(d);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, 4000);
  };

  Game.hitMark = function(){
    const c = $('crosshair');
    c.classList.add('hit');
    setTimeout(() => c.classList.remove('hit'), 120);
  };

  Game.redFlash = function(){
    const d = $('dmg');
    d.style.opacity = 0.9;
    setTimeout(() => d.style.opacity = 0, 220);
  };

  /* ---- Миникарта ---- */
  const mmCanvas = $('minimap');
  const mmCtx = mmCanvas.getContext('2d');
  const MM_SIZE = 180, MM_PAD = 8;
  let mmTimer = 0;

  function worldToMap(x, z){
    const ARENA = Game.CFG.ARENA;
    const s = MM_SIZE - MM_PAD * 2;
    return {
      x: MM_PAD + (x + ARENA) / (2 * ARENA) * s,
      y: MM_PAD + (z + ARENA) / (2 * ARENA) * s
    };
  }

  function drawMinimap(){
    const p = Game.player;
    const st = Game.state;
    const CFG = Game.CFG;
    const bomb = Game.bomb;

    mmCtx.clearRect(0, 0, MM_SIZE, MM_SIZE);
    mmCtx.fillStyle = 'rgba(10,12,18,.6)';
    mmCtx.fillRect(0, 0, MM_SIZE, MM_SIZE);
    mmCtx.strokeStyle = 'rgba(58,74,106,.9)';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect(MM_PAD, MM_PAD, MM_SIZE - 2 * MM_PAD, MM_SIZE - 2 * MM_PAD);

    mmCtx.font = 'bold 10px Arial';
    mmCtx.textAlign = 'center';
    mmCtx.textBaseline = 'middle';
    for (const site of CFG.BOMBSITES){
      const sc = worldToMap(site.x, site.z);
      const sr = (CFG.BOMB_SITE_RADIUS / (2 * CFG.ARENA)) * (MM_SIZE - 2 * MM_PAD);
      mmCtx.strokeStyle = 'rgba(255, 179, 0, 0.55)';
      mmCtx.beginPath();
      mmCtx.arc(sc.x, sc.y, sr, 0, Math.PI * 2);
      mmCtx.stroke();
      mmCtx.fillStyle = 'rgba(255, 215, 110, 0.85)';
      mmCtx.fillText(site.id, sc.x, sc.y);
    }

    const zoneX = Game.getTeamSpawnX(p.team);
    const zc = worldToMap(zoneX, CFG.BUY_ZONE_Z);
    const zr = (CFG.BUY_ZONE_RADIUS / (2 * CFG.ARENA)) * (MM_SIZE - 2 * MM_PAD);
    mmCtx.strokeStyle = 'rgba(76, 175, 80, 0.45)';
    mmCtx.beginPath();
    mmCtx.arc(zc.x, zc.y, zr, 0, Math.PI * 2);
    mmCtx.stroke();

    mmCtx.fillStyle = 'rgba(110,116,134,.55)';
    for (const c of Game.colliders){
      const a = worldToMap(c.minX, c.minZ);
      const b = worldToMap(c.maxX, c.maxZ);
      mmCtx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    if (Game.smokeClouds){
      for (const sm of Game.smokeClouds){
        const sp = worldToMap(sm.pos.x, sm.pos.z);
        const sr = (sm.radius / (2 * CFG.ARENA)) * (MM_SIZE - 2 * MM_PAD);
        mmCtx.fillStyle = 'rgba(190, 200, 215, 0.35)';
        mmCtx.beginPath();
        mmCtx.arc(sp.x, sp.y, sr, 0, Math.PI * 2);
        mmCtx.fill();
      }
    }

    if (Game.fireZones){
      for (const fz of Game.fireZones){
        const fp = worldToMap(fz.pos.x, fz.pos.z);
        const fr = (fz.radius / (2 * CFG.ARENA)) * (MM_SIZE - 2 * MM_PAD);
        mmCtx.fillStyle = 'rgba(255, 100, 20, 0.45)';
        mmCtx.beginPath();
        mmCtx.arc(fp.x, fp.y, fr, 0, Math.PI * 2);
        mmCtx.fill();
      }
    }

    for (const b of Game.bots){
      if (b.team !== p.team || b.dead) continue;
      const pt = worldToMap(b.pos.x, b.pos.z);
      mmCtx.fillStyle = '#3b82f6';
      mmCtx.beginPath(); mmCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); mmCtx.fill();
    }
    for (const b of Game.bots){
      if (b.team === p.team || b.dead) continue;
      if (Game.dist2D(b.pos, p.pos) > 45) continue;
      if (!Game.hasLOS(p, b)) continue;
      const pt = worldToMap(b.pos.x, b.pos.z);
      mmCtx.fillStyle = '#e5484d';
      mmCtx.beginPath(); mmCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); mmCtx.fill();
    }

    if (bomb.status === 'planted' || (bomb.status === 'dropped' && Game.isAttackTeam(p.team))){
      const bp = worldToMap(bomb.pos.x, bomb.pos.z);
      mmCtx.fillStyle = bomb.status === 'planted' ? '#ff3333' : '#ffd76e';
      mmCtx.fillRect(bp.x - 3, bp.y - 3, 6, 6);
    } else if (bomb.status === 'carried' && bomb.carrier && bomb.carrier.team === p.team){
      const bp = worldToMap(bomb.carrier.pos.x, bomb.carrier.pos.z);
      mmCtx.fillStyle = '#ffd76e';
      mmCtx.fillRect(bp.x - 2.5, bp.y - 2.5, 5, 5);
    }

    let arrowPos = p.pos, arrowYaw = p.yaw;
    if (p.dead){
      if (st.camMode === 2){
        arrowPos = st.freeCamPos; arrowYaw = st.freeCamYaw;
      } else if (Game.spectateList){
        const list = Game.spectateList();
        if (list.length){
          const b = list[Math.min(st.specIdx, list.length - 1)];
          arrowPos = b.pos; arrowYaw = b.yaw;
        }
      }
    }
    const pp = worldToMap(arrowPos.x, arrowPos.z);
    mmCtx.save();
    mmCtx.translate(pp.x, pp.y);
    mmCtx.rotate(-arrowYaw);
    mmCtx.beginPath();
    mmCtx.moveTo(0, -6);
    mmCtx.lineTo(-4, 5);
    mmCtx.lineTo(4, 5);
    mmCtx.closePath();
    mmCtx.fillStyle = '#7CFC00';
    mmCtx.fill();
    mmCtx.restore();
  }

  Game.updateMinimap = function(dt){
    mmTimer -= dt;
    if (mmTimer > 0) return;
    mmTimer = 0.1;
    drawMinimap();
  };

  /* ---- Настройки с динамическим прицелом и режимом приседа ---- */
  function applyCrosshairSettings(){
    const ch = $('crosshair');
    const size = parseInt(Game.settings.chSize, 10) || 4;
    const color = Game.settings.chColor || '#7CFC00';
    const shape = Game.settings.chShape || 'dot';

    ch.className = '';
    ch.style.background = '';
    ch.style.borderColor = '';
    ch.style.color = color;
    ch.style.margin = '0';

    if (shape === 'dot'){
      ch.style.width = size + 'px';
      ch.style.height = size + 'px';
      ch.style.background = color;
    } else if (shape === 'cross'){
      ch.classList.add('shape-cross');
      const cs = size * 2.5;
      ch.style.width = cs + 'px';
      ch.style.height = cs + 'px';
    } else if (shape === 'circle'){
      ch.classList.add('shape-circle');
      const cs = size * 2.5;
      ch.style.width = cs + 'px';
      ch.style.height = cs + 'px';
    }
  }

  function syncSettingsUI(){
    $('sensRange').value = Game.settings.mouseSens;
    $('sensVal').textContent = Game.settings.mouseSens.toFixed(1);
    $('volRange').value = Game.settings.volume;
    $('volVal').textContent = Math.round(Game.settings.volume * 100) + '%';
    $('soundToggle').checked = Game.settings.soundOn;
    $('volRange').disabled = !Game.settings.soundOn;
    if ($('crouchToggle')) $('crouchToggle').checked = Boolean(Game.settings.crouchToggle);

    $('chShape').value = Game.settings.chShape;
    $('chSize').value = Game.settings.chSize;
    $('chSizeVal').textContent = Game.settings.chSize;
    $('chColor').value = Game.settings.chColor;
    applyCrosshairSettings();
  }

  Game.openSettings = function(){ syncSettingsUI(); $('settings').classList.add('show'); };
  Game.closeSettings = function(){ $('settings').classList.remove('show'); };

  $('settingsBtn').addEventListener('click', Game.openSettings);
  $('settingsClose').addEventListener('click', Game.closeSettings);
  $('sensRange').addEventListener('input', e => {
    Game.settings.mouseSens = parseFloat(e.target.value);
    $('sensVal').textContent = Game.settings.mouseSens.toFixed(1);
  });
  $('volRange').addEventListener('input', e => {
    Game.settings.volume = parseFloat(e.target.value);
    $('volVal').textContent = Math.round(Game.settings.volume * 100) + '%';
  });
  $('soundToggle').addEventListener('change', e => {
    Game.settings.soundOn = e.target.checked;
    $('volRange').disabled = !Game.settings.soundOn;
  });
  if ($('crouchToggle')){
    $('crouchToggle').addEventListener('change', e => {
      Game.settings.crouchToggle = e.target.checked;
      if (!Game.settings.crouchToggle) Game.player.crouchToggled = false;
    });
  }

  $('chShape').addEventListener('change', e => {
    Game.settings.chShape = e.target.value;
    applyCrosshairSettings();
  });
  $('chSize').addEventListener('input', e => {
    Game.settings.chSize = parseInt(e.target.value, 10);
    $('chSizeVal').textContent = Game.settings.chSize;
    applyCrosshairSettings();
  });
  $('chColor').addEventListener('input', e => {
    Game.settings.chColor = e.target.value;
    applyCrosshairSettings();
  });

  syncSettingsUI();

  /* ---- Магазин ---- */
  Game.buyMenu = function(open){
    if (open){
      const status = Game.getBuyStatus();
      if (!status.ok){
        Game.showMsg(status.reason, 1800);
        return;
      }
      refreshBuyMenuUI();
    }
    Game.state.menuOpen = open;
    $('buy').style.display = open ? 'block' : 'none';
    if (open && Game.state.locked) document.exitPointerLock();
    if (!open && Game.state.phase !== 'over') Game.renderer.domElement.requestPointerLock();
  };

  function tryBuy(key){
    const status = Game.getBuyStatus();
    if (!status.ok){
      Game.buyMenu(false);
      Game.showMsg(status.reason, 1800);
      return;
    }

    const p = Game.player;
    const CFG = Game.CFG;

    if (key === 'armor'){
      if (p.armor >= 100){ Game.showMsg('Бронежилет уже целый'); return; }
      if (p.money < CFG.ARMOR_PRICE){ Game.showMsg('Не хватает денег на бронежилет'); return; }
      p.money -= CFG.ARMOR_PRICE;
      p.armor = 100;
    } else if (key === 'armor_helmet'){
      if (p.armor >= 100 && p.helmet){
        Game.showMsg('Бронежилет со шлемом уже куплены');
        return;
      }
      const cost = (p.armor >= 100 && !p.helmet) ? CFG.HELMET_UPGRADE_PRICE : CFG.HELMET_ARMOR_PRICE;
      if (p.money < cost){
        Game.showMsg('Не хватает денег ($' + cost + ')');
        return;
      }
      p.money -= cost;
      p.armor = 100;
      p.helmet = true;
    } else if (key === 'defuse_kit'){
      if (Game.isAttackTeam(p.team)){
        Game.showMsg('Набор сапёра доступен только команде защиты', 1800);
        return;
      }
      if (p.defuseKit){
        Game.showMsg('У вас уже есть набор сапёра');
        return;
      }
      if (p.money < CFG.DEFUSE_KIT_PRICE){
        Game.showMsg('Не хватает денег на набор сапёра');
        return;
      }
      p.money -= CFG.DEFUSE_KIT_PRICE;
      p.defuseKit = true;
    } else if (key === 'pistol'){
      Game.showMsg('Базовый пистолет всегда во втором слоте [2]', 1800);
      return;
    } else if (key === 'grenade'){
      if (p.grenades >= 1){ Game.showMsg('У вас уже есть осколочная граната'); return; }
      if (p.money < CFG.GRENADE_PRICE){ Game.showMsg('Не хватает денег на осколочную гранату'); return; }
      p.money -= CFG.GRENADE_PRICE; p.grenades = 1;
    } else if (key === 'flash'){
      if (p.flashes >= 1){ Game.showMsg('У вас уже есть световая граната'); return; }
      if (p.money < CFG.FLASH_PRICE){ Game.showMsg('Не хватает денег на световую гранату'); return; }
      p.money -= CFG.FLASH_PRICE; p.flashes = 1;
    } else if (key === 'smoke'){
      if (p.smokes >= 1){ Game.showMsg('У вас уже есть дымовая граната'); return; }
      if (p.money < CFG.SMOKE_PRICE){ Game.showMsg('Не хватает денег на дымовую граната'); return; }
      p.money -= CFG.SMOKE_PRICE; p.smokes = 1;
    } else if (key === 'molotov'){
      if (p.molotovs >= 1){ Game.showMsg('У вас уже есть зажигательная граната'); return; }
      if (p.money < CFG.MOLOTOV_PRICE){ Game.showMsg('Не хватает денег на зажигательную гранату'); return; }
      p.money -= CFG.MOLOTOV_PRICE; p.molotovs = 1;
    } else if (key === 'pistol_mid' || key === 'pistol_deagle'){
      const w = Game.WEAPONS[key];
      if (p.slots.secondary && p.slots.secondary.key === key){
        Game.showMsg('У вас уже есть ' + w.name); return;
      }
      if (p.money < w.price){
        Game.showMsg('Не хватает денег на ' + w.name); return;
      }
      if (p.ads) Game.exitADS();
      Game.syncAmmoToSlot();
      p.money -= w.price;
      p.slots.secondary = { key, ammo: w.mag, reserve: w.mag * 3 };
      if (p.currentSlot === 'secondary') Game.activateSlot('secondary');
    } else {
      const w = Game.WEAPONS[key];
      if (!w) return;
      if (p.slots.primary && p.slots.primary.key === key){
        Game.showMsg('У вас уже есть ' + w.name); return;
      }
      if (p.money < w.price){
        Game.showMsg('Не хватает денег на ' + w.name); return;
      }
      if (p.ads) Game.exitADS();
      Game.syncAmmoToSlot();
      p.money -= w.price;
      p.slots.primary = { key, ammo: w.mag, reserve: w.mag * 3 };
      Game.activateSlot('primary');
    }
    Game.snd.buy();
    Game.updHUD();
  }
  document.querySelectorAll('.buyRow[data-buy]').forEach(r => r.addEventListener('click', () => tryBuy(r.dataset.buy)));

  /* ---- Статистика (TAB в стиле CS) ---- */
  function buildStatsRows(list, isMyTeam){
    let html = '<tr>' +
               '<th>Игрок</th>' +
               (isMyTeam ? '<th class="num">$</th>' : '') +
               '<th class="num" title="Убийства">У</th>' +
               '<th class="num" title="Помощи в убийстве">П</th>' +
               '<th class="num" title="Смерти">С</th>' +
               '<th class="num" title="Соотношение убийств и смертей">K/D</th>' +
               '<th class="num" title="Процент убийств в голову">В гол.</th>' +
               '<th class="num" title="Нанесённый урон">Урон</th>' +
               '<th class="num" title="Очки">Очки</th>' +
               '</tr>';

    for (const e of list){
      const kills = e.kills || 0;
      const assists = e.assists || 0;
      const deaths = e.deaths || 0;
      const hsKills = e.hsKills || 0;
      const dmg = Math.round(e.damage || 0);
      const pts = e.score || (kills * 2 + assists);

      const kd = deaths > 0 ? (kills / deaths).toFixed(2) : (kills > 0 ? kills.toFixed(2) : '0.00');
      const hsPct = kills > 0 ? Math.round((hsKills / kills) * 100) + '%' : '—';
      const cls = (e.isPlayer ? 'me ' : '') + (e.dead ? 'dead' : '');

      const deadMark = e.dead ? '<span class="deadTag">☠</span>' : '';
      const bombMark = (Game.bomb.status === 'carried' && Game.bomb.carrier === e) ? ' 💣' : '';
      const kitMark = (isMyTeam && e.defuseKit && !Game.isAttackTeam(e.team)) ? ' ✂' : '';
      const name = e.name + (e.isPlayer ? ' ⭐' : '') + bombMark + kitMark + deadMark;
      const moneyCell = isMyTeam ? '<td class="num teamMoney">$' + (e.money || 0) + '</td>' : '';

      html += '<tr class="' + cls + '">' +
              '<td>' + name + '</td>' +
              moneyCell +
              '<td class="num">' + kills + '</td>' +
              '<td class="num">' + assists + '</td>' +
              '<td class="num">' + deaths + '</td>' +
              '<td class="num">' + kd + '</td>' +
              '<td class="num">' + hsPct + '</td>' +
              '<td class="num">' + dmg + '</td>' +
              '<td class="num pts">' + pts + '</td>' +
              '</tr>';
    }
    return html;
  }

  Game.renderStats = function(){
    const st = Game.state;
    const phase = st.phase === 'buy' ? 'закупка' : (st.phase === 'live' ? 'бой' : (st.phase === 'roundEnd' ? 'конец раунда' : 'матч'));
    const halfLabel = st.halftimeDone ? '2-я половина' : '1-я половина';
    $('statsScore').textContent = 'СИНИЕ ' + st.scores[0] + ' : ' + st.scores[1] + ' КРАСНЫЕ · Раунд ' + st.roundNum + ' (' + halfLabel + ') · ' + phase;
    $('statsBlueTitle').textContent = 'СИНИЕ · ' + (Game.isAttackTeam(0) ? 'АТАКА (C4)' : 'ЗАЩИТА');
    $('statsRedTitle').textContent  = 'КРАСНЫЕ · ' + (Game.isAttackTeam(1) ? 'АТАКА (C4)' : 'ЗАЩИТА');

    const all = Game.allEntities();
    const sortFn = (a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0);
    const blue = all.filter(e => e.team === 0).sort(sortFn);
    const red  = all.filter(e => e.team === 1).sort(sortFn);
    $('statsBlue').innerHTML = buildStatsRows(blue, Game.player.team === 0);
    $('statsRed').innerHTML  = buildStatsRows(red, Game.player.team === 1);
  };

  Game.showStats = function(){
    if (Game.state.phase === 'menu' || Game.state.phase === 'over') return;
    Game.state.statsShown = true;
    Game.renderStats();
    $('stats').classList.add('show');
  };

  Game.hideStats = function(){
    Game.state.statsShown = false;
    $('stats').classList.remove('show');
  };
})();