'use strict';

(function(){
  const $ = Game.$;
  const keys = new Set();
  Game.keys = keys;

  Game.input = { shooting: false, firedOnce: false };
  let lastWheelTime = 0;

  document.addEventListener('keydown', e => {
    const st = Game.state;
    const p = Game.player;
    keys.add(e.code);
    if (e.code === 'KeyR' && !p.dead) Game.startReload();
    if (e.code === 'KeyB' && (st.phase === 'buy' || st.phase === 'live')) Game.buyMenu(!st.menuOpen);
    if (e.code === 'Escape' && st.menuOpen) Game.buyMenu(false);
    if (e.code === 'Escape' && $('settings').classList.contains('show')) Game.closeSettings();
    if (e.code === 'KeyV' && p.dead) Game.cycleCamMode();
    if (e.code === 'Digit1' && !p.dead) Game.switchSlot('primary');
    if (e.code === 'Digit2' && !p.dead) Game.switchSlot('secondary');
    if (e.code === 'Digit3' && !p.dead) Game.switchSlot('melee');
    if (e.code === 'Digit4' && !p.dead) Game.cycleGrenadeSlot();
    if (e.code === 'KeyQ' && !p.dead && !st.menuOpen) Game.quickSwitch();

    // Присед по нажатию (Toggle), если включён в настройках
    if (e.code === 'KeyC' && !e.repeat && Game.settings.crouchToggle && !p.dead && !st.menuOpen && (st.phase === 'live' || st.phase === 'buy')){
      p.crouchToggled = !p.crouchToggled;
    }

    // Подбор оружия с земли на [E]
    if (e.code === 'KeyE' && !p.dead && st.phase === 'live' && Game.pickupWeapon){
      Game.pickupWeapon(p);
    }

    if (e.code === 'Tab'){
      e.preventDefault();
      if (!st.statsShown) Game.showStats();
    }
  });

  document.addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'Tab') Game.hideStats();
  });

  window.addEventListener('blur', () => {
    keys.clear();
    Game.hideStats();
    if (Game.player.ads) Game.exitADS();
  });

  // Переключение слотов колёсиком мыши
  document.addEventListener('wheel', e => {
    const st = Game.state;
    const p = Game.player;
    if (!st.locked || p.dead || st.menuOpen) return;
    if (st.phase !== 'live' && st.phase !== 'buy') return;
    const now = performance.now();
    if (now - lastWheelTime < 75) return;
    lastWheelTime = now;
    if (e.deltaY !== 0) Game.wheelSwitchSlot(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('mousedown', e => {
    const st = Game.state;
    const p = Game.player;
    if (e.button === 2){
      if (st.locked && !p.dead && st.phase === 'live' && !st.menuOpen){
        if (p.currentSlot === 'grenade'){
          if (p.activeGrenade) Game.throwPlayerUtility(p.activeGrenade, true);
        } else {
          Game.enterADS();
        }
      }
      return;
    }
    if (e.button !== 0) return;
    Game.initAudio();

    if (p.dead && (st.phase === 'live' || st.phase === 'roundEnd')){
      const list = Game.spectateList();
      if (list.length){
        st.specIdx = (st.specIdx + 1) % list.length;
        st.specYawOffset = 0;
        st.specPitchOffset = 0;
        Game.showMsg('Спектатор: ' + list[st.specIdx].name, 1200);
      }
      return;
    }

    if (!st.locked){
      if (st.phase !== 'menu' && st.phase !== 'over' && !st.menuOpen){
        Game.renderer.domElement.requestPointerLock();
      }
      return;
    }
    Game.input.shooting = true;
    Game.input.firedOnce = false;
  });

  document.addEventListener('mouseup', e => {
    if (e.button === 2){
      if (Game.player.ads) Game.exitADS();
      return;
    }
    if (e.button === 0) Game.input.shooting = false;
  });

  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('mousemove', e => {
    const st = Game.state;
    const p = Game.player;
    if (!st.locked) return;
    let sens = 0.0021 * Game.settings.mouseSens;
    if (p.isScoped) sens *= 0.35;
    else if (p.ads) sens *= 0.7;

    if (p.dead){
      if (st.camMode === 2){
        st.freeCamYaw   -= e.movementX * sens;
        st.freeCamPitch -= e.movementY * sens;
        st.freeCamPitch = Math.max(-1.4, Math.min(1.4, st.freeCamPitch));
      } else {
        st.specYawOffset   -= e.movementX * sens;
        st.specPitchOffset -= e.movementY * sens;
        st.specPitchOffset = Math.max(-0.8, Math.min(1.0, st.specPitchOffset));
      }
      return;
    }

    p.yaw   -= e.movementX * sens;
    p.pitch -= e.movementY * sens;
    p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
    Game.gunFx.swayX = Math.max(-0.06, Math.min(0.06, Game.gunFx.swayX - e.movementX * 0.00025));
    Game.gunFx.swayY = Math.max(-0.06, Math.min(0.06, Game.gunFx.swayY - e.movementY * 0.00025));
  });

  document.addEventListener('pointerlockchange', () => {
    Game.state.locked = document.pointerLockElement === Game.renderer.domElement;
    if (!Game.state.locked && Game.player.ads) Game.exitADS();
  });
})();