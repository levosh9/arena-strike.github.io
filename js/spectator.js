'use strict';

(function(){
  Game.spectateList = function(){
    let list = Game.bots.filter(b => !b.dead && b.team === Game.player.team);
    if (!list.length) list = Game.bots.filter(b => !b.dead);
    return list;
  };

  Game.cycleCamMode = function(){
    const st = Game.state;
    st.camMode = (st.camMode + 1) % 3;
    st.specYawOffset = 0;
    st.specPitchOffset = 0;
    if (st.camMode === 2){
      st.freeCamPos.copy(Game.camera.position);
      const dir = new THREE.Vector3();
      Game.camera.getWorldDirection(dir);
      st.freeCamPitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      st.freeCamYaw = Math.atan2(-dir.x, -dir.z);
    }
  };

  function updateThirdPersonCam(dt){
    const st = Game.state;
    const list = Game.spectateList();
    if (!list.length) return;
    if (st.specIdx >= list.length) st.specIdx = 0;
    const b = list[st.specIdx];
    if (!b || b.dead) return;

    const totalYaw = b.yaw + st.specYawOffset;
    const pitch = Math.max(-0.7, Math.min(1.0, st.specPitchOffset));
    const dist = 3.5;
    const horiz = Math.cos(pitch) * dist;
    const vert  = Math.sin(pitch) * dist;
    const camX = b.pos.x - Math.sin(totalYaw) * horiz;
    const camY = b.pos.y + 1.4 + vert;
    const camZ = b.pos.z - Math.cos(totalYaw) * horiz;

    const from = new THREE.Vector3(b.pos.x, b.pos.y + 1.4, b.pos.z);
    const to = new THREE.Vector3(camX, camY, camZ);
    const dir = to.clone().sub(from);
    const len = dir.length();
    let finalX = camX, finalY = camY, finalZ = camZ;

    if (len > 0.001){
      Game.raycaster.set(from, dir.clone().normalize());
      Game.raycaster.far = len;
      const hits = Game.raycaster.intersectObjects(Game.obstacleMeshes);
      if (hits.length > 0){
        const hp = hits[0].point;
        const d = Math.max(0.5, hp.distanceTo(from) - 0.3);
        const nd = dir.clone().normalize().multiplyScalar(d);
        finalX = from.x + nd.x;
        finalY = from.y + nd.y;
        finalZ = from.z + nd.z;
      }
    }

    Game.camera.position.lerp(new THREE.Vector3(finalX, finalY, finalZ), Math.min(1, dt * 8));
    Game.camera.lookAt(b.pos.x, b.pos.y + 1.4, b.pos.z);

    Game.specBarShow('👁 3-е лицо: ' + b.name + ' · V — режим · ЛКМ — след. игрок');
  }

  function updateFPVCam(){
    const st = Game.state;
    const list = Game.spectateList();
    if (!list.length) return;
    if (st.specIdx >= list.length) st.specIdx = 0;
    const b = list[st.specIdx];
    if (!b || b.dead){ st.specIdx = (st.specIdx + 1) % Math.max(1, list.length); return; }

    const totalYaw = b.yaw + st.specYawOffset;
    const pitch = Math.max(-1.4, Math.min(1.4, st.specPitchOffset));
    const lookDist = 6;
    const lookX = b.pos.x + Math.sin(totalYaw) * Math.cos(pitch) * lookDist;
    const lookY = b.pos.y + 1.6 + Math.sin(pitch) * lookDist;
    const lookZ = b.pos.z + Math.cos(totalYaw) * Math.cos(pitch) * lookDist;

    Game.camera.position.set(b.pos.x, b.pos.y + 1.6, b.pos.z);
    Game.camera.lookAt(lookX, lookY, lookZ);

    Game.specBarShow('👁 1-е лицо: ' + b.name + ' · V — режим · ЛКМ — след. игрок');
  }

  function updateFreeCam(dt){
    const st = Game.state;
    const keys = Game.keys;
    const ARENA = Game.CFG.ARENA;
    const speed = keys.has('ShiftLeft') ? 15 : 8;
    const f = new THREE.Vector3(-Math.sin(st.freeCamYaw), 0, -Math.cos(st.freeCamYaw));
    const r = new THREE.Vector3( Math.cos(st.freeCamYaw), 0, -Math.sin(st.freeCamYaw));
    const move = new THREE.Vector3();
    if (keys.has('KeyW')) move.add(f);
    if (keys.has('KeyS')) move.sub(f);
    if (keys.has('KeyD')) move.add(r);
    if (keys.has('KeyA')) move.sub(r);
    if (keys.has('Space')) move.y += 1;
    if (keys.has('KeyC')) move.y -= 1;
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
    st.freeCamPos.add(move);
    st.freeCamPos.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, st.freeCamPos.x));
    st.freeCamPos.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, st.freeCamPos.z));
    st.freeCamPos.y = Math.max(0.5, Math.min(25, st.freeCamPos.y));

    Game.camera.position.copy(st.freeCamPos);
    Game.camera.rotation.y = st.freeCamYaw;
    Game.camera.rotation.x = st.freeCamPitch;

    Game.specBarShow('👁 Свободная камера · WASD+Space/C — полёт · V — режим');
  }

  Game.updateSpectator = function(dt){
    const st = Game.state;
    for (const b of Game.bots){
      if (!b.dead) b.mesh.visible = true;
    }

    if (st.camMode === 2){ updateFreeCam(dt); return; }
    if (st.camMode === 1){
      const list = Game.spectateList();
      if (!list.length){ updateFreeCam(dt); return; }
      if (st.specIdx >= list.length) st.specIdx = 0;
      const b = list[st.specIdx];
      if (!b){ updateFreeCam(dt); return; }
      b.mesh.visible = false;
      updateFPVCam();
      return;
    }
    updateThirdPersonCam(dt);
  };
})();