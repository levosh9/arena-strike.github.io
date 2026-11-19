'use strict';

(function(){
  const gunScene = new THREE.Scene();
  const gunCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.01, 10);
  gunScene.add(new THREE.HemisphereLight(0xdce8ff, 0x2b2d38, 1.1));
  const gunKey = new THREE.DirectionalLight(0xffffff, 1.0); gunKey.position.set(0.7, 1.3, 0.9); gunScene.add(gunKey);
  const gunRim = new THREE.DirectionalLight(0xffcfa0, 0.6); gunRim.position.set(-1.1, 0.4, -0.5); gunScene.add(gunRim);

  const gunRoot = new THREE.Group();
  gunRoot.position.set(0.25, -0.24, -0.6);
  gunRoot.rotation.set(0.04, 0.06, 0.01);
  gunScene.add(gunRoot);

  const gunModels = {};
  let currentGun = null;
  let muzzleFlashTimer = 0;
  const gunFx = { recoil: 0, bob: 0, swayX: 0, swayY: 0, slash: 0 };

  /* ---- Процедурные текстуры для оружия и рук ---- */
  function makeTex(size, drawFn){
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    drawFn(ctx, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const metalTex = makeTex(128, (ctx, s) => {
    ctx.fillStyle = '#3a404d';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 600; i++){
      const y = Math.random() * s;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(Math.random() * s, y, 6 + Math.random() * 18, 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeRect(2, 2, s - 4, s - 4);
  });

  const gripTex = makeTex(64, (ctx, s) => {
    ctx.fillStyle = '#1b1e24';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#282d36';
    for (let y = 0; y < s; y += 6){
      for (let x = 0; x < s; x += 6){
        ctx.fillRect(x + ((y / 6) % 2) * 3, y, 2, 2);
      }
    }
  });

  const sleeveTex = makeTex(128, (ctx, s) => {
    ctx.fillStyle = '#263b59';
    ctx.fillRect(0, 0, s, s);
    const cols = ['#1e2f47', '#314b70', '#1a273b'];
    for (let i = 0; i < 45; i++){
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(Math.random() * s, Math.random() * s, 12 + Math.random() * 20, 8 + Math.random() * 16);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < s; y += 4){
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
  });

  const c4ScreenTex = makeTex(128, (ctx, s) => {
    ctx.fillStyle = '#1a1e24';
    ctx.fillRect(0, 0, s, s);
    // Экранчик
    ctx.fillStyle = '#142b1c';
    ctx.fillRect(10, 10, s - 20, 36);
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('7355608', s / 2, 36);
    // Кнопки клавиатуры
    ctx.fillStyle = '#3c4352';
    for (let r = 0; r < 3; r++){
      for (let c = 0; c < 3; c++){
        ctx.fillRect(22 + c * 30, 56 + r * 20, 22, 14);
      }
    }
  });

  function phong(c, shin = 45, spec = 0x555555, map = null){
    return new THREE.MeshPhongMaterial({ color: c, shininess: shin, specular: spec, map });
  }

  const MAT = {
    dark:      phong(0x22262e, 55, 0x666666, metalTex),
    mid:       phong(0x464e5e, 65, 0x777777, metalTex),
    silver:    phong(0xaab3c2, 90, 0xaaaaaa, metalTex),
    grip:      phong(0x20232a, 15, 0x222222, gripTex),
    accent:    phong(0x8a929e, 75, 0x888888),
    lens:      phong(0x1f6feb, 120, 0x99ccff),
    skin:      new THREE.MeshLambertMaterial({ color: 0xc99a6e }),
    glove:     phong(0x1f2229, 20, 0x333333, gripTex),
    sleeve:    new THREE.MeshLambertMaterial({ color: 0xffffff, map: sleeveTex }),
    c4Pack:    phong(0x4d5744, 15, 0x222222),
    c4Face:    new THREE.MeshBasicMaterial({ map: c4ScreenTex }),
    c4Led:     new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    ammoBox:   phong(0x3b4d34, 25, 0x333333, metalTex),
    brass:     phong(0xd9a836, 95, 0xffe49e),
    blade:     phong(0xd8e0ec, 120, 0xffffff, metalTex),
    bladeEdge: phong(0xf5f8ff, 140, 0xffffff),
    heBody:    phong(0x3b4d34, 30, 0x444444),
    flashBody: phong(0xd8dee9, 60, 0x888888),
    smokeBody: phong(0x6b7280, 40, 0x666666),
    mollyBody: phong(0xd97706, 85, 0xffd28a),
    flameGlow: new THREE.MeshBasicMaterial({ color: 0xff7b00 }),
    bandRed:   new THREE.MeshLambertMaterial({ color: 0xe5484d }),
    bandBlue:  new THREE.MeshLambertMaterial({ color: 0x3b82f6 }),
    bandGreen: new THREE.MeshLambertMaterial({ color: 0x4caf50 })
  };

  function box(g, w, h, d, m, x, y, z){
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  }

  function cyl(g, rt, rb, len, m, x, y, z, rx = Math.PI / 2, seg = 10){
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, seg), m);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    g.add(mesh);
    return mesh;
  }

  // Тактическая рука в перчатке без пальцев
  function addHand(g, x, y, z, isLeft){
    box(g, 0.068, 0.072, 0.085, MAT.glove, x, y, z);
    box(g, 0.056, 0.025, 0.032, MAT.skin,  x, y + 0.028, z - 0.042); // открытые пальцы
    box(g, 0.060, 0.016, 0.022, MAT.dark,  x, y + 0.038, z - 0.01);  // карбоновая вставка на костяшках
    const arm = box(g, 0.078, 0.078, 0.22, MAT.sleeve,
      isLeft ? x - 0.055 : x + 0.018,
      isLeft ? y - 0.04 : y - 0.02,
      z + 0.14
    );
    if (isLeft) arm.rotation.z = 0.28;
  }

  function makeFlashTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0,    'rgba(255,255,225,1)');
    grd.addColorStop(0.35, 'rgba(255,212,110,0.9)');
    grd.addColorStop(1,    'rgba(255,140,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const flashTexture = makeFlashTexture();
  Game.flashTexture = flashTexture;

  function buildC4Model(){
    const g = new THREE.Group();
    box(g, 0.23, 0.06, 0.16, MAT.c4Pack, -0.04, -0.02, -0.08);
    box(g, 0.236, 0.065, 0.02, MAT.grip, -0.04, -0.02, -0.13);
    box(g, 0.236, 0.065, 0.02, MAT.grip, -0.04, -0.02, -0.03);
    box(g, 0.12, 0.022, 0.10, MAT.c4Face, -0.04, 0.022, -0.08);
    const led = box(g, 0.022, 0.016, 0.022, MAT.c4Led, 0.035, 0.028, -0.11);
    g.userData.c4Led = led;
    addHand(g,  0.075, -0.035, -0.05, false);
    addHand(g, -0.155, -0.035, -0.05, true);
    return g;
  }

  function buildKnifeModel(){
    const g = new THREE.Group();
    cyl(g, 0.019, 0.021, 0.13, MAT.grip, 0, -0.02, 0.02);
    box(g, 0.055, 0.068, 0.016, MAT.dark, 0, -0.015, -0.052);
    box(g, 0.010, 0.038, 0.21, MAT.blade, 0, -0.008, -0.16);
    box(g, 0.006, 0.012, 0.21, MAT.bladeEdge, 0, -0.025, -0.16);
    box(g, 0.007, 0.024, 0.065, MAT.bladeEdge, 0, -0.004, -0.285);
    addHand(g, 0.005, -0.035, 0.03, false);
    return g;
  }

  function buildGrenadeModel(type){
    const g = new THREE.Group();
    if (type === 'he'){
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 12), MAT.heBody);
      body.position.set(0, 0.015, -0.06);
      g.add(body);
      cyl(g, 0.018, 0.022, 0.04, MAT.dark, 0, 0.08, -0.06, 0);
      box(g, 0.014, 0.085, 0.016, MAT.bandRed, 0.046, 0.03, -0.06);
    } else if (type === 'flash'){
      cyl(g, 0.040, 0.040, 0.155, MAT.flashBody, 0, 0.01, -0.06, 0, 12);
      cyl(g, 0.042, 0.042, 0.030, MAT.bandBlue,  0, 0.02, -0.06, 0, 12);
      cyl(g, 0.018, 0.020, 0.035, MAT.dark,      0, 0.098, -0.06, 0);
    } else if (type === 'smoke'){
      cyl(g, 0.044, 0.044, 0.165, MAT.smokeBody, 0, 0.01, -0.06, 0, 12);
      cyl(g, 0.046, 0.046, 0.034, MAT.bandGreen, 0, 0.02, -0.06, 0, 12);
      cyl(g, 0.018, 0.020, 0.035, MAT.dark,      0, 0.102, -0.06, 0);
    } else {
      cyl(g, 0.040, 0.045, 0.135, MAT.mollyBody, 0, 0.0, -0.06, 0, 12);
      cyl(g, 0.016, 0.034, 0.065, MAT.mollyBody, 0, 0.095, -0.06, 0, 10);
      box(g, 0.030, 0.055, 0.030, MAT.flameGlow, 0, 0.15, -0.06);
    }
    addHand(g, 0.01, -0.04, -0.02, false);
    return g;
  }

  function buildGun(kind){
    if (kind === 'c4') return buildC4Model();
    if (kind === 'knife') return buildKnifeModel();
    if (kind.startsWith('grenade_')) return buildGrenadeModel(kind.slice(8));

    const g = new THREE.Group();
    let muzzlePos = new THREE.Vector3(0, 0.01, -0.32);

    if (Game.isPistol(kind)){
      const isDeagle = kind === 'pistol_deagle';
      const slideMat = isDeagle ? MAT.silver : (kind === 'pistol_mid' ? MAT.dark : MAT.mid);
      box(g, isDeagle ? 0.072 : 0.058, isDeagle ? 0.072 : 0.058, isDeagle ? 0.34 : 0.28, slideMat, 0, 0.012, -0.08);
      box(g, 0.052, 0.035, 0.24, MAT.grip, 0, -0.025, -0.05);
      box(g, 0.050, 0.115, 0.085, MAT.grip, 0, -0.09, 0.035);
      cyl(g, 0.015, 0.015, 0.10, MAT.dark, 0, 0.014, isDeagle ? -0.26 : -0.23);
      // Прицельные приспособления
      box(g, 0.012, 0.016, 0.016, MAT.accent, 0, 0.052, isDeagle ? -0.23 : -0.20);
      box(g, 0.036, 0.016, 0.014, MAT.accent, 0, 0.052, 0.04);
      muzzlePos.set(0, 0.014, isDeagle ? -0.32 : -0.29);
    } else if (kind === 'smg'){
      box(g, 0.072, 0.095, 0.42, MAT.dark, 0, 0.005, -0.06);
      box(g, 0.055, 0.020, 0.36, MAT.mid,  0, 0.060, -0.08); // планка Пикатинни
      cyl(g, 0.022, 0.022, 0.22, MAT.dark, 0, 0.015, -0.36); // глушитель/ствол
      box(g, 0.040, 0.175, 0.062, MAT.grip, 0, -0.13, -0.08); // магазин
      box(g, 0.052, 0.105, 0.085, MAT.grip, 0, -0.09,  0.09);
      box(g, 0.046, 0.080, 0.16,  MAT.mid,  0, -0.005, 0.23);
      box(g, 0.022, 0.030, 0.06,  MAT.accent, 0, 0.082, -0.10);
      muzzlePos.set(0, 0.015, -0.48);
    } else if (kind === 'negev'){
      box(g, 0.100, 0.125, 0.56, MAT.dark, 0, 0.00, -0.08);
      cyl(g, 0.036, 0.038, 0.30, MAT.mid,  0, 0.035, -0.46); // перфорированный кожух
      cyl(g, 0.018, 0.020, 0.26, MAT.silver, 0, 0.035, -0.68); // ствол
      box(g, 0.115, 0.155, 0.18, MAT.ammoBox, -0.088, -0.10, -0.12);
      box(g, 0.048, 0.075, 0.085, MAT.brass,  -0.065, -0.005, -0.12);
      box(g, 0.070, 0.105, 0.24, MAT.mid,  0, -0.01, 0.32);
      box(g, 0.056, 0.115, 0.09, MAT.grip, 0, -0.09, 0.08);
      cyl(g, 0.011, 0.011, 0.24, MAT.grip, -0.045, -0.028, -0.48);
      cyl(g, 0.011, 0.011, 0.24, MAT.grip,  0.045, -0.028, -0.48);
      muzzlePos.set(0, 0.035, -0.82);
    } else if (kind === 'shotgun'){
      box(g, 0.080, 0.095, 0.48, MAT.dark, 0, 0.00, -0.06);
      cyl(g, 0.020, 0.020, 0.58, MAT.mid,  0, 0.038, -0.34); // верхний ствол
      cyl(g, 0.018, 0.018, 0.50, MAT.dark, 0, -0.002, -0.30); // подствольный магазин
      cyl(g, 0.028, 0.028, 0.20, MAT.grip, 0, -0.004, -0.32); // цевьё-помпа
      box(g, 0.072, 0.10, 0.26, MAT.mid, 0, -0.02, 0.30);
      box(g, 0.055, 0.13, 0.085, MAT.grip, 0, -0.11, 0.08);
      muzzlePos.set(0, 0.038, -0.65);
    } else if (kind === 'sniper_light' || kind === 'sniper_heavy'){
      const isHeavy = kind === 'sniper_heavy';
      const L = isHeavy ? 1.15 : 1.0;
      box(g, 0.078, 0.105, 0.54 * L, isHeavy ? MAT.ammoBox : MAT.mid, 0, 0.00, -0.06);
      cyl(g, 0.017, 0.020, 0.48 * L, MAT.dark, 0, 0.024, -0.52 * L);
      box(g, 0.042, 0.038, 0.065, MAT.dark, 0, 0.024, -0.76 * L); // дульный тормоз
      box(g, 0.070, 0.105, 0.26, isHeavy ? MAT.ammoBox : MAT.mid, 0, -0.008, 0.34);
      box(g, 0.052, 0.13,  0.085, MAT.grip, 0, -0.11, 0.08);
      box(g, 0.048, 0.10,  0.075, MAT.dark, 0, -0.085, -0.08);
      // Оптический прицел (труба + окуляр + линза)
      cyl(g, 0.024, 0.024, 0.26, MAT.dark, 0, 0.102, -0.10, Math.PI / 2, 12);
      cyl(g, 0.032, 0.025, 0.05, MAT.dark, 0, 0.102, -0.24, Math.PI / 2, 12);
      cyl(g, 0.028, 0.028, 0.01, MAT.lens, 0, 0.102, -0.265, Math.PI / 2, 12);
      box(g, 0.020, 0.045, 0.020, MAT.accent, 0, 0.068, -0.16);
      box(g, 0.020, 0.045, 0.020, MAT.accent, 0, 0.068, -0.04);
      muzzlePos.set(0, 0.024, -0.80 * L);
    } else {
      // Штурмовая винтовка
      box(g, 0.076, 0.110, 0.54, MAT.dark, 0, 0.00, -0.08);
      box(g, 0.062, 0.024, 0.44, MAT.mid,  0, 0.062, -0.10); // верхняя планка
      cyl(g, 0.017, 0.019, 0.34, MAT.dark, 0, 0.020, -0.50);
      cyl(g, 0.023, 0.023, 0.06, MAT.accent, 0, 0.020, -0.66); // пламегаситель
      box(g, 0.050, 0.185, 0.082, MAT.grip, 0, -0.14, -0.12);
      box(g, 0.055, 0.115, 0.095, MAT.grip, 0, -0.09,  0.08);
      box(g, 0.066, 0.095, 0.22,  MAT.mid,  0, -0.008, 0.32);
      // Коллиматор
      box(g, 0.042, 0.042, 0.09, MAT.dark, 0, 0.092, -0.12);
      box(g, 0.030, 0.026, 0.01, MAT.lens, 0, 0.094, -0.16);
      muzzlePos.set(0, 0.020, -0.70);
    }

    const muzzle = new THREE.Object3D();
    muzzle.position.copy(muzzlePos);
    g.add(muzzle);
    g.userData.muzzle = muzzle;

    addHand(g, 0.005, -0.075, Game.isPistol(kind) ? 0.03 : 0.07, false);
    if (!Game.isPistol(kind)){
      addHand(g, -0.008, -0.085, kind === 'smg' ? -0.20 : -0.30, true);
    }

    const flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    }));
    flash.scale.set(0.24, 0.24, 1);
    flash.position.copy(muzzlePos);
    flash.visible = false;
    g.add(flash);
    g.userData.flash = flash;

    return g;
  }

  Game.gunScene = gunScene;
  Game.gunCam = gunCam;
  Game.gunFx = gunFx;

  Game.triggerMuzzleFlash = function(dur = 0.05){
    if (currentGun && currentGun.userData.flash){
      currentGun.userData.flash.visible = true;
      muzzleFlashTimer = dur;
    }
  };

  Game.equipGun = function(kind){
    for (const k in gunModels) gunModels[k].visible = false;
    if (!gunModels[kind]){
      gunModels[kind] = buildGun(kind);
      gunRoot.add(gunModels[kind]);
    }
    gunModels[kind].visible = true;
    currentGun = gunModels[kind];
    Game.refreshCrosshair();
  };

  Game.updateGun = function(dt){
    const p = Game.player;
    const keys = Game.keys;
    const bomb = Game.bomb;
    gunRoot.visible = (Game.state.phase !== 'menu') && !p.dead && !p.isScoped;
    if (!currentGun) return;

    const isUsingC4 = !p.dead && Game.state.phase === 'live' && bomb.actionProgress > 0 && bomb.actionActor === p;

    if (isUsingC4){
      if (currentGun !== gunModels.c4) Game.equipGun('c4');
      const led = currentGun.userData.c4Led;
      if (led) led.visible = Math.floor(performance.now() / 160) % 2 === 0;
      currentGun.position.set(-0.18, 0.04, 0.12);
      currentGun.rotation.set(0.22, -0.05, 0);
      return;
    } else if (currentGun === gunModels.c4){
      const restoreKind = (p.currentSlot === 'grenade' && p.activeGrenade)
        ? ('grenade_' + p.activeGrenade)
        : p.weapon;
      Game.equipGun(restoreKind);
    }

    if (muzzleFlashTimer > 0){
      muzzleFlashTimer -= dt;
      if (muzzleFlashTimer <= 0){
        for (const k in gunModels) if (gunModels[k].userData.flash) gunModels[k].userData.flash.visible = false;
      }
    }

    gunFx.recoil = Math.max(0, gunFx.recoil - dt * 5.5);
    gunFx.slash  = Math.max(0, gunFx.slash - dt * 4.5);

    const moving = !p.dead && p.onGround && Game.state.phase === 'live' && keys &&
      (keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD'));
    const walkSlow = (keys && keys.has('ShiftLeft')) || p.crouching;
    gunFx.bob += dt * (moving ? (walkSlow ? 5.0 : 10.5) : 1.8);
    const bobAmt = moving ? (walkSlow ? 0.004 : 0.011) : 0.0025;
    const bx = Math.sin(gunFx.bob) * bobAmt;
    const by = Math.abs(Math.cos(gunFx.bob)) * bobAmt * 0.9;

    gunFx.swayX *= Math.pow(0.0005, dt);
    gunFx.swayY *= Math.pow(0.0005, dt);

    let dip = 0;
    if (p.reloading){
      const w = Game.WEAPONS[p.weapon];
      const left = Math.max(0, p.reloadEnd - performance.now()) / 1000;
      const t = 1 - Math.min(1, left / w.reload);
      dip = Math.sin(t * Math.PI);
    }

    const slashSwing = Math.sin(gunFx.slash * Math.PI);
    const g = currentGun;
    g.position.set(
      bx - slashSwing * 0.14,
      by - dip * 0.16 - slashSwing * 0.04,
      gunFx.recoil * 0.05 - slashSwing * 0.16
    );
    g.rotation.set(
      gunFx.recoil * 0.30 + dip * 0.9 + gunFx.swayY - slashSwing * 0.55,
      gunFx.swayX * 0.6 + slashSwing * 0.85,
      Math.sin(gunFx.bob) * 0.008 + dip * 0.35 + gunFx.swayX + slashSwing * 0.65
    );
  };

  Game.equipGun('pistol');
})();