'use strict';

(function(){
  const ARENA = Game.CFG.ARENA;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x161a24);
  scene.fog = new THREE.Fog(0x161a24, 45, 130);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.getElementById('game').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2a35, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2d9, 0.85);
  sun.position.set(20, 45, 10);
  scene.add(sun);

  /* ---- Генератор процедурных текстур на <canvas> ---- */
  function makeTex(size, drawFn, repX = 1, repY = 1){
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    drawFn(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    tex.anisotropy = 4;
    return tex;
  }

  function addNoise(ctx, size, amount, alpha = 0.08){
    for (let i = 0; i < amount; i++){
      const x = Math.random() * size;
      const y = Math.random() * size;
      const s = 1 + Math.random() * 2.5;
      ctx.fillStyle = Math.random() > 0.5
        ? `rgba(255,255,255,${alpha})`
        : `rgba(0,0,0,${alpha * 1.2})`;
      ctx.fillRect(x, y, s, s);
    }
  }

  const TEX = {
    // Пол: тёмные бетонные плиты (ARENA CORE)
    floorArena: makeTex(256, (ctx, s) => {
      ctx.fillStyle = '#333846';
      ctx.fillRect(0, 0, s, s);
      addNoise(ctx, s, 900, 0.06);
      ctx.strokeStyle = 'rgba(15,18,24,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, s - 3, s - 3);
      ctx.beginPath();
      ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s);
      ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2);
      ctx.stroke();
    }, 16, 16),

    // Пол: песок и вытертая брусчатка (SANDSTORM)
    floorSand: makeTex(256, (ctx, s) => {
      ctx.fillStyle = '#6f5e46';
      ctx.fillRect(0, 0, s, s);
      addNoise(ctx, s, 1400, 0.08);
      ctx.strokeStyle = 'rgba(55,42,26,0.28)';
      ctx.lineWidth = 2;
      for (let y = 0; y < s; y += 64){
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
        const off = (y / 64) % 2 ? 32 : 0;
        for (let x = off; x < s; x += 64){
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke();
        }
      }
    }, 16, 16),

    // Стены: бетонные панели (ARENA CORE)
    wallArena: makeTex(256, (ctx, s) => {
      ctx.fillStyle = '#586074';
      ctx.fillRect(0, 0, s, s);
      addNoise(ctx, s, 800, 0.07);
      // Панельные швы
      ctx.strokeStyle = 'rgba(20,24,32,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, s - 4, s - 4);
      ctx.beginPath();
      ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s);
      ctx.stroke();
      // Технологическая полоса снизу
      ctx.fillStyle = 'rgba(20,24,32,0.28)';
      ctx.fillRect(0, s - 34, s, 34);
    }, 2, 1),

    // Стены: песчаник / каменная кладка (SANDSTORM)
    wallSand: makeTex(256, (ctx, s) => {
      ctx.fillStyle = '#927c5e';
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const rh = s / rows;
      const bw = 64;
      for (let r = 0; r < rows; r++){
        const y = r * rh;
        const off = (r % 2) * (bw / 2);
        for (let x = -bw; x < s + bw; x += bw){
          const shade = (Math.random() - 0.5) * 18;
          ctx.fillStyle = `rgb(${146 + shade}, ${124 + shade}, ${94 + shade})`;
          ctx.fillRect(x + off + 2, y + 2, bw - 4, rh - 4);
        }
      }
      addNoise(ctx, s, 900, 0.06);
      ctx.strokeStyle = 'rgba(55,44,30,0.45)';
      ctx.lineWidth = 2;
      for (let r = 0; r <= rows; r++){
        ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(s, r * rh); ctx.stroke();
      }
    }, 2, 1),

    // Ящики: деревянные доски, рамка и диагональ
    crate: makeTex(256, (ctx, s) => {
      ctx.fillStyle = '#8b6d47';
      ctx.fillRect(0, 0, s, s);
      // Доски
      const planks = 6;
      const ph = s / planks;
      for (let i = 0; i < planks; i++){
        const shade = (Math.random() - 0.5) * 16;
        ctx.fillStyle = `rgb(${139 + shade}, ${109 + shade}, ${71 + shade})`;
        ctx.fillRect(0, i * ph, s, ph - 2);
        ctx.fillStyle = 'rgba(35,22,10,0.45)';
        ctx.fillRect(0, (i + 1) * ph - 2, s, 2);
      }
      addNoise(ctx, s, 600, 0.06);
      // Диагональная рейка
      ctx.strokeStyle = '#6d5232';
      ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(20, s - 20); ctx.lineTo(s - 20, 20); ctx.stroke();
      // Внешняя рамка
      ctx.strokeStyle = '#5e4528';
      ctx.lineWidth = 24;
      ctx.strokeRect(12, 12, s - 24, s - 24);
      // Гвозди по углам
      ctx.fillStyle = '#261e16';
      const pts = [26, s - 26];
      for (const px of pts) for (const py of pts){
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      }
    }, 1, 1)
  };

  const floorMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: TEX.floorArena });
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2 + 8, ARENA * 2 + 8),
    floorMat
  );
  floorMesh.rotation.x = -Math.PI / 2;
  scene.add(floorMesh);

  const grid = new THREE.GridHelper(ARENA * 2 + 8, 24, 0x3a4050, 0x31364a);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);

  const mapGroup = new THREE.Group();
  scene.add(mapGroup);

  const bombGroup = new THREE.Group();
  const bombPack = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.14, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x3b4238 })
  );
  bombPack.position.y = 0.07;
  bombGroup.add(bombPack);
  const bombLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.04, 0.10),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  bombLed.position.set(0, 0.15, 0);
  bombGroup.add(bombLed);
  bombGroup.visible = false;
  scene.add(bombGroup);
  Game.bomb.mesh = bombGroup;
  Game.bomb.ledMesh = bombLed;

  const obstacleMeshes = [];
  const colliders = [];
  const wayPoints = [];
  let activePlatforms = [];
  let activeRamps = [];

  const raycaster = new THREE.Raycaster();
  const bulletRaycaster = new THREE.Raycaster();

  Game.scene = scene;
  Game.camera = camera;
  Game.renderer = renderer;
  Game.obstacleMeshes = obstacleMeshes;
  Game.colliders = colliders;
  Game.wayPoints = wayPoints;
  Game.raycaster = raycaster;
  Game.bulletRaycaster = bulletRaycaster;
  Game.dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  Game.smokeClouds = [];

  function addFloorCircle(x, z, radius, color, fillOp = 0.08, ringOp = 0.55){
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.18, radius, 48),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: ringOp })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.025, z);
    mapGroup.add(ring);

    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fillOp })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(x, 0.02, z);
    mapGroup.add(fill);
  }

  function addBox(x, z, w, d, h, tex, tint = 0xffffff, minY = 0){
    const mat = new THREE.MeshLambertMaterial({ color: tint, map: tex });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, minY + h / 2, z);
    mapGroup.add(m);
    obstacleMeshes.push(m);
    colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      minY, maxY: minY + h
    });
  }

  function addRampMesh(r, tex){
    const w = r.maxX - r.minX;
    const d = r.maxZ - r.minZ;
    const steps = 8;
    const mat = new THREE.MeshLambertMaterial({ color: 0xd8d0c4, map: tex });
    for (let i = 0; i < steps; i++){
      const t = (i + 0.5) / steps;
      const curH = r.h0 + (r.h1 - r.h0) * t;
      if (curH <= 0.02) continue;
      if (r.axis === 'z'){
        const segD = d / steps;
        const cz = r.minZ + (r.dir < 0 ? (1 - t) * d : t * d);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, curH, segD), mat);
        m.position.set((r.minX + r.maxX) * 0.5, curH * 0.5, cz);
        mapGroup.add(m);
        obstacleMeshes.push(m);
      } else {
        const segW = w / steps;
        const cx = r.minX + (r.dir < 0 ? (1 - t) * w : t * w);
        const m = new THREE.Mesh(new THREE.BoxGeometry(segW, curH, d), mat);
        m.position.set(cx, curH * 0.5, (r.minZ + r.maxZ) * 0.5);
        mapGroup.add(m);
        obstacleMeshes.push(m);
      }
    }
  }

  Game.getGroundHeight = function(x, z){
    let h = 0;
    for (const p of activePlatforms){
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ){
        if (p.h > h) h = p.h;
      }
    }
    for (const r of activeRamps){
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ){
        let t = 0;
        if (r.axis === 'z'){
          t = r.dir < 0 ? (r.maxZ - z) / (r.maxZ - r.minZ) : (z - r.minZ) / (r.maxZ - r.minZ);
        } else {
          t = r.dir < 0 ? (r.maxX - x) / (r.maxX - r.minX) : (x - r.minX) / (r.maxX - r.minX);
        }
        t = Math.max(0, Math.min(1, t));
        const rh = r.h0 + (r.h1 - r.h0) * t;
        if (rh > h) h = rh;
      }
    }
    return h;
  };

  Game.loadMap = function(mapId){
    const map = Game.MAPS[mapId] || Game.MAPS.arena;
    const isSand = mapId === 'sandstorm';
    Game.state.mapId = mapId;

    while (mapGroup.children.length) mapGroup.remove(mapGroup.children[0]);
    obstacleMeshes.length = 0;
    colliders.length = 0;
    wayPoints.length = 0;

    scene.background = new THREE.Color(map.skyColor);
    scene.fog.color.setHex(map.skyColor);

    floorMat.map = isSand ? TEX.floorSand : TEX.floorArena;
    floorMat.color.setHex(0xffffff);
    floorMat.needsUpdate = true;
    grid.visible = !isSand;

    const wallTex = isSand ? TEX.wallSand : TEX.wallArena;
    const crateTex = TEX.crate;

    Game.CFG.BOMBSITES = map.sites.map(s => ({ ...s }));
    Game.CFG.BUY_ZONE_X = Math.abs(map.defSpawn.x);

    addFloorCircle(map.defSpawn.x, map.defSpawn.z, Game.CFG.BUY_ZONE_RADIUS, 0x4caf50);
    addFloorCircle(map.atkSpawn.x, map.atkSpawn.z, Game.CFG.BUY_ZONE_RADIUS, 0x4caf50);

    for (const site of map.sites){
      addFloorCircle(site.x, site.z, Game.CFG.BOMB_SITE_RADIUS, site.color, 0.14, 0.78);
    }

    // Внешние стены периметра
    addBox(0, -ARENA - 0.5, ARENA * 2 + 4, 1, 5, wallTex, 0xd8dce4);
    addBox(0,  ARENA + 0.5, ARENA * 2 + 4, 1, 5, wallTex, 0xd8dce4);
    addBox(-ARENA - 0.5, 0, 1, ARENA * 2 + 4, 5, wallTex, 0xd8dce4);
    addBox( ARENA + 0.5, 0, 1, ARENA * 2 + 4, 5, wallTex, 0xd8dce4);

    // Стены внутри карты и деревянные ящики
    for (const b of map.boxes){
      const [x, z, w, d, h] = b;
      const isWall = h >= 3.0 || w >= 6 || d >= 6;
      addBox(x, z, w, d, h, isWall ? wallTex : crateTex, isWall ? 0xe5e5e5 : 0xffffff);
    }

    // Возвышенности (платформы)
    activePlatforms = map.platforms || [];
    for (const p of activePlatforms){
      const w = p.maxX - p.minX;
      const d = p.maxZ - p.minZ;
      addBox((p.minX + p.maxX) * 0.5, (p.minZ + p.maxZ) * 0.5, w, d, p.h, wallTex, 0xd8d0c4);
    }

    // Пандусы
    activeRamps = map.ramps || [];
    for (const r of activeRamps){
      addRampMesh(r, wallTex);
    }

    for (let x = -24; x <= 24; x += 6){
      for (let z = -24; z <= 24; z += 6){
        const gh = Game.getGroundHeight(x, z);
        let blocked = false;
        for (const c of colliders){
          if (x > c.minX - 0.8 && x < c.maxX + 0.8 && z > c.minZ - 0.8 && z < c.maxZ + 0.8){
            if (gh < c.maxY - 0.35){ blocked = true; break; }
          }
        }
        if (!blocked) wayPoints.push(new THREE.Vector3(x, gh, z));
      }
    }
  };

  Game.isBlockedBySmoke = function(ax, az, bx, bz){
    if (!Game.smokeClouds || !Game.smokeClouds.length) return false;
    const dx = bx - ax, dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    for (const sm of Game.smokeClouds){
      const r = sm.radius;
      let t = 0;
      if (lenSq > 0.0001){
        t = Math.max(0, Math.min(1, ((sm.pos.x - ax) * dx + (sm.pos.z - az) * dz) / lenSq));
      }
      const cx = ax + t * dx;
      const cz = az + t * dz;
      if (Math.hypot(sm.pos.x - cx, sm.pos.z - cz) < r) return true;
    }
    return false;
  };

  Game.hasLOS = function(from, to){
    if (Game.isBlockedBySmoke(from.pos.x, from.pos.z, to.pos.x, to.pos.z)) return false;
    const a = new THREE.Vector3(from.pos.x, (from.pos.y || 0) + 1.5, from.pos.z);
    const b = new THREE.Vector3(to.pos.x, (to.pos.y || 0) + 1.35, to.pos.z);
    const dir = b.clone().sub(a);
    const len = dir.length();
    raycaster.set(a, dir.normalize());
    raycaster.far = len - 0.3;
    return raycaster.intersectObjects(obstacleMeshes).length === 0;
  };

  Game.grenadeLOS = function(fromPos, toEntity){
    const a = fromPos.clone();
    const b = new THREE.Vector3(toEntity.pos.x, (toEntity.pos.y || 0) + 1.2, toEntity.pos.z);
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 0.01) return true;
    raycaster.set(a, dir.normalize());
    raycaster.far = len - 0.3;
    return raycaster.intersectObjects(obstacleMeshes).length === 0;
  };

  Game.resolveCollisions = function(pos, r){
    const curY = pos.y || 0;
    for (const c of colliders){
      if (curY >= c.maxY - 0.38) continue;
      if (pos.x > c.minX - r && pos.x < c.maxX + r && pos.z > c.minZ - r && pos.z < c.maxZ + r){
        const dxl = pos.x - (c.minX - r), dxr = (c.maxX + r) - pos.x;
        const dzl = pos.z - (c.minZ - r), dzr = (c.maxZ + r) - pos.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) pos.x = c.minX - r;
        else if (m === dxr) pos.x = c.maxX + r;
        else if (m === dzl) pos.z = c.minZ - r;
        else pos.z = c.maxZ + r;
      }
    }
    pos.x = Math.max(-ARENA + 0.6, Math.min(ARENA - 0.6, pos.x));
    pos.z = Math.max(-ARENA + 0.6, Math.min(ARENA - 0.6, pos.z));
  };

  Game.loadMap('arena');
})();