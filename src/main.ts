import './styles.css';

import type { DifficultyMode } from './game/modes.js';
import type { MusicMode } from './audio/music.js';
import type { Profile } from './storage/storage.js';
import type { Scene } from './render/renderer.js';
import type { SimEvent } from './game/events.js';
import type { Phase } from './game/phase.js';

import { CAMERA, FEEL, PALETTE, POWERUPS, WORLD } from './config.js';
import { DIFFICULTY_SCALES, isDifficultyMode } from './game/modes.js';
import { GameLoop } from './game/loop.js';
import { Hud, formatTime } from './ui/hud.js';
import { InputManager } from './input/input.js';
import { OverlayManager } from './ui/overlay.js';
import { Renderer } from './render/renderer.js';
import { Announcer, prefersReducedMotion } from './ui/a11y.js';
import { SECTOR_TABLE, sectorInfo } from './game/sectors.js';
import { acceptsSteering, isSimulating, reduce } from './game/phase.js';
import { addTrauma, createCamera, updateCamera } from './render/camera.js';
import { computeViewport, fitDisplaySize } from './core/viewport.js';
import { createAudioEngine, streakPitch } from './audio/audio.js';
import { createEventBuffer } from './game/events.js';
import { createRng, randomSeed } from './core/rng.js';
import { createWorld, resetRun } from './game/world.js';
import { intensityAt } from './game/difficulty.js';
import { loadProfile, recordRun, saveProfile } from './storage/storage.js';
import { renderLeaderboard } from './ui/leaderboard.js';
import { renderRunStats } from './ui/summary.js';
import { updateAttract } from './game/attract.js';
import { update } from './game/update.js';

const COUNTDOWN_SECONDS = 3;
const SECTOR_BANNER_MS = 2600;
/** The title screen drifts through the sector colours, a preview of the run. */
const MENU_SECTOR_SECONDS = 7;
const AMBER = '#ffd35c';
const CREAM = '#fff3dc';

/**
 * Read-only snapshot of the running game.
 *
 * Exposed on `window.__dodge` so the end-to-end tests can assert on real state
 * (did the ship actually move? did the world freeze while paused?) instead of
 * comparing screenshots. It exposes copies, so nothing here can be used to
 * drive or corrupt a run.
 */
export interface DebugSnapshot {
  phase: Phase;
  score: number;
  elapsed: number;
  lives: number;
  ship: { x: number; y: number };
  asteroids: number;
  seed: number;
  sector: number;
  shards: number;
  nearMisses: number;
}

declare global {
  interface Window {
    __dodge?: { snapshot(): DebugSnapshot };
  }
}

function must<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`missing required element #${id}`);
  return element as unknown as T;
}

/** Restarts a CSS animation on an element by toggling its class. */
function replay(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth; // forces a style flush, so re-adding restarts it
  element.classList.add(className);
}

function start(): void {
  const canvas = must<HTMLCanvasElement>('game');
  const stage = canvas.parentElement;
  if (stage === null) throw new Error('canvas has no stage parent');

  // ---- state ----
  let profile: Profile = loadProfile();
  let phase: Phase = 'menu';
  let mode: DifficultyMode = 'normal';
  let reducedMotion = profile.reducedMotion ?? prefersReducedMotion();
  /** Seconds the simulation is frozen for, after an impact. */
  let hitStop = 0;
  /** Seconds the explosion has been playing. */
  let dyingFor = 0;
  let menuTime = 0;
  let lastCountdown = '';
  let bannerTimer: number | undefined;

  const world = createWorld(randomSeed());
  const camera = createCamera();
  const shakeRng = createRng(0x51a2e);
  const events = createEventBuffer();
  const audio = createAudioEngine();
  const input = new InputManager(canvas);
  const renderer = new Renderer(canvas, 0xbeef);
  const announcer = new Announcer(must<HTMLElement>('live-region'));
  const { fx } = renderer;

  const hud = new Hud({
    score: must('hud-score'),
    best: must('hud-best'),
    lives: must('hud-lives'),
    combo: must('hud-combo'),
    status: must('hud-status'),
  });

  const overlays = new OverlayManager(
    {
      menu: must('screen-menu'),
      paused: must('screen-paused'),
      gameOver: must('screen-gameover'),
      about: must('screen-about'),
      settings: must('screen-settings'),
      guide: must('screen-guide'),
    },
    stage,
  );

  const countdownEl = must<HTMLElement>('countdown');
  const muteButton = must<HTMLButtonElement>('mute-button');
  const muteState = must<HTMLElement>('mute-state');
  const sectorBanner = must<HTMLElement>('sector-banner');
  const sectorKicker = must<HTMLElement>('sector-kicker');
  const sectorName = must<HTMLElement>('sector-name');

  // ---- viewport ----
  let viewport = computeViewport(
    stage.clientWidth,
    stage.clientHeight,
    window.devicePixelRatio,
    WORLD.width,
    WORLD.height,
  );

  const wrap = stage.parentElement ?? stage;

  const resize = (): void => {
    const fit = fitDisplaySize(wrap.clientWidth, wrap.clientHeight, WORLD.width, WORLD.height);
    canvas.style.width = `${String(fit.width)}px`;
    canvas.style.height = `${String(fit.height)}px`;

    viewport = computeViewport(
      fit.width,
      fit.height,
      window.devicePixelRatio,
      WORLD.width,
      WORLD.height,
    );
    renderer.resize(viewport);
  };

  // A ResizeObserver also fires when a mobile browser's URL bar collapses,
  // which a window resize listener misses.
  new ResizeObserver(resize).observe(wrap);
  window.addEventListener('orientationchange', resize);
  resize();

  // ---- preferences ----
  const applyMotionPreference = (): void => {
    renderer.effectsEnabled = !reducedMotion;
    camera.enabled = !reducedMotion;
    document.body.dataset['motion'] = reducedMotion ? 'reduced' : 'full';
  };

  const applyMute = (): void => {
    audio.setMuted(profile.muted);
    muteState.textContent = profile.muted ? 'off' : 'on';
    muteButton.setAttribute('aria-pressed', String(profile.muted));
    soundToggle.checked = !profile.muted;
  };

  const applyMusic = (): void => {
    audio.setMusicEnabled(profile.music);
    musicToggle.checked = profile.music;
  };

  const persist = (): void => saveProfile(profile, undefined);

  // ---- scene ----
  const scene = (): Scene => {
    if (phase === 'menu') {
      return {
        showShip: false,
        intensity: 0.15,
        sector: Math.floor(menuTime / MENU_SECTOR_SECONDS) % SECTOR_TABLE.length,
      };
    }
    return {
      showShip: true,
      intensity: intensityAt(world.elapsed * world.difficultyScale),
      sector: world.sector,
    };
  };

  // ---- phase transitions ----
  const dispatch = (event: Parameters<typeof reduce>[1]): void => {
    const next = reduce(phase, event);
    if (next === phase) return;
    const previous = phase;
    phase = next;
    onPhaseChange(previous, next);
  };

  function beginRun(): void {
    resetRun(world, randomSeed());
    world.difficultyScale = DIFFICULTY_SCALES[mode];
    world.countdown = COUNTDOWN_SECONDS;
    camera.trauma = 0;
    hitStop = 0;
    dyingFor = 0;
    lastCountdown = '';
    renderer.resetScene();
    hud.invalidate();
    input.clearTarget();
    loop.resync();
  }

  function finishRun(): void {
    const before = profile.bestScore;
    const { score } = world;
    const at = Date.now();
    profile = recordRun(profile, score.points, score.survivalTime, at);
    persist();

    countUp(must<HTMLElement>('final-score'), score.points);
    must<HTMLElement>('final-meta').textContent =
      `${formatTime(score.survivalTime)} survived · ${String(score.dodges)} dodged`;

    renderRunStats(must('run-stats'), {
      nearMisses: score.nearMisses,
      bestCombo: score.bestCombo,
      shards: score.shards,
      sector: world.sector,
      sectorName: sectorInfo(world.sector).name,
    });

    const isBest = score.points > before && score.points > 0;
    const rank = profile.leaderboard.findIndex((e) => e.at === at && e.score === score.points);
    const note = must<HTMLElement>('best-banner');
    note.hidden = !isBest && rank < 0;
    note.textContent = isBest ? 'New personal best' : `#${String(rank + 1)} on your board`;
    note.classList.toggle('screen__best--rank', !isBest);

    renderLeaderboard(must('gameover-leaderboard'), profile.leaderboard, {
      limit: 5,
      highlightAt: at,
    });
    refreshMenuStats();

    announcer.sayNow(
      `Run over. Score ${String(score.points)}.${isBest ? ' New personal best.' : ''}`,
    );
  }

  /** Counts the final score up, so the number lands rather than appears. */
  function countUp(element: HTMLElement, target: number): void {
    if (reducedMotion || target <= 0) {
      element.textContent = target.toLocaleString();
      return;
    }
    const began = performance.now();
    const duration = Math.min(900, 300 + target / 4);
    const step = (now: number): void => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = Math.round(target * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function musicFor(next: Phase): MusicMode {
    switch (next) {
      case 'menu':
      case 'gameOver':
        return 'calm';
      case 'countdown':
      case 'playing':
        return 'run';
      case 'paused':
      case 'dying':
        return 'off';
    }
  }

  function onPhaseChange(previous: Phase, next: Phase): void {
    if (next === 'countdown') beginRun();
    if (next === 'menu') {
      // Hand the field back to the attract backdrop.
      resetRun(world, randomSeed());
      renderer.resetScene();
      loop.resync();
    }
    if (next === 'playing' && previous === 'paused') loop.resync();
    if (next === 'gameOver') finishRun();
    // The banner belongs to play; it must never sit over a menu or the wreck.
    if (next !== 'playing') hideSectorBanner();

    audio.setMusicMode(musicFor(next));

    const screen = OverlayManager.forPhase(next);
    if (screen === null) overlays.hide();
    else overlays.show(screen);

    countdownEl.classList.toggle('is-active', next === 'countdown');
    document.body.dataset['phase'] = next;
    if (next === 'paused') announcer.sayNow('Paused.');
  }

  // ---- sector banner ----
  function showSectorBanner(index: number): void {
    sectorKicker.textContent = `Sector ${String(index + 1)}`;
    sectorName.textContent = sectorInfo(index).name;
    replay(sectorBanner, 'is-showing');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(hideSectorBanner, SECTOR_BANNER_MS);
  }

  function hideSectorBanner(): void {
    window.clearTimeout(bannerTimer);
    sectorBanner.classList.remove('is-showing');
  }

  // ---- simulation events ----
  function handleSimEvent(event: SimEvent): void {
    const { ship } = world;
    switch (event.type) {
      case 'nearMiss': {
        audio.play('nearMiss', streakPitch(event.combo));
        const label =
          event.combo > 1
            ? `+${String(event.points)} ×${String(event.combo)}`
            : `+${String(event.points)}`;
        fx.floater(event.x, event.y - 12, label, AMBER, 13 + Math.min(event.combo, 8));
        fx.ring(ship.x, ship.y, ship.r + 4, ship.r + 30, AMBER, 0.32, 2.5);
        break;
      }
      case 'shard':
        audio.play('shard', streakPitch(event.chain));
        fx.floater(event.x, event.y - 10, `+${String(event.points)}`, PALETTE.shard, 12);
        fx.ring(event.x, event.y, 3, 20, PALETTE.shard, 0.28, 2);
        break;
      case 'cometWarning':
        audio.play('comet');
        break;
      case 'sector':
        audio.play('sector');
        showSectorBanner(event.index);
        announcer.say(`Sector ${String(event.index + 1)}, ${sectorInfo(event.index).name}.`);
        break;
      case 'pickup':
        audio.play('pickup');
        addTrauma(camera, CAMERA.traumaOnPickup);
        fx.floater(event.x, event.y - 14, pickupLabel(event.kind), pickupColor(event.kind), 14);
        fx.ring(event.x, event.y, 6, 44, pickupColor(event.kind), 0.42, 3);
        announcer.say(`${labelFor(event.kind)} collected.`);
        break;
      case 'shieldBreak':
        audio.play('shieldBreak');
        addTrauma(camera, CAMERA.traumaOnShieldBreak);
        fx.debris(event.x, event.y, event.r, event.skin, 8);
        fx.ring(event.x, event.y, event.r, event.r + 46, PALETTE.shield, 0.4, 3);
        fx.flash(PALETTE.shield, 0.12);
        announcer.say('Shield absorbed a hit.');
        break;
      case 'lifeLost':
        audio.play('lifeLost');
        addTrauma(camera, CAMERA.traumaOnHit);
        hitStop = FEEL.hitStopOnLifeLost;
        fx.debris(event.x, event.y, event.r, event.skin, 10);
        fx.ring(event.x, event.y, event.r, event.r + 70, PALETTE.danger, 0.5, 4);
        fx.flash(PALETTE.danger, 0.18);
        announcer.sayNow(`Hit. ${String(event.livesLeft)} remaining.`);
        break;
      case 'destroyed':
        audio.play('gameOver');
        addTrauma(camera, CAMERA.traumaOnHit);
        hitStop = FEEL.hitStopOnDestroyed;
        fx.debris(event.x, event.y, Math.max(event.r, 18), event.skin, 14);
        fx.ring(event.x, event.y, 8, 120, CREAM, 0.7, 5);
        fx.ring(event.x, event.y, 4, 70, PALETTE.ship, 0.5, 3);
        fx.flash(CREAM, 0.22);
        break;
      case 'milestone':
        announcer.say(`${String(event.points)} points.`);
        break;
      case 'dodge':
        break;
    }
  }

  // ---- loop ----
  const loop = new GameLoop({
    update: (dt) => {
      const snapshot = input.snapshot();

      for (const action of snapshot.justPressed) {
        if (action === 'pause') dispatch({ type: 'TOGGLE_PAUSE' });
        if (action === 'restart' && phase !== 'menu') dispatch({ type: 'RESTART' });
        if (action === 'mute') toggleMute();
        if (action === 'confirm') {
          audio.unlock();
          if (phase === 'menu' || phase === 'gameOver') dispatch({ type: 'START' });
          else if (phase === 'paused') dispatch({ type: 'RESUME' });
        }
      }
      input.endFrame();

      updateCamera(camera, dt, shakeRng);
      if (phase === 'paused') return;

      // An impact holds the frame for a beat. The camera keeps shaking, which
      // is most of what makes the hold read as weight rather than as lag.
      if (hitStop > 0) {
        hitStop -= dt;
        return;
      }

      const current = scene();
      renderer.update(dt, current, world.ship.slowmoTime > 0);
      audio.setMusicIntensity(current.intensity);

      if (phase === 'menu') {
        menuTime += dt;
        // Keep meteors drifting behind the title screen.
        updateAttract(world, dt);
        return;
      }

      if (!isSimulating(phase)) return;

      if (phase === 'countdown') {
        world.countdown -= dt;
        const text = world.countdown > 0 ? String(Math.ceil(world.countdown)) : 'GO';
        if (text !== lastCountdown) {
          lastCountdown = text;
          countdownEl.textContent = text;
          replay(countdownEl, 'is-pop');
          audio.play('uiSelect', text === 'GO' ? 2 : 1);
        }
        if (world.countdown <= -0.35) dispatch({ type: 'COUNTDOWN_ELAPSED' });
        return;
      }

      // The explosion plays out in slow motion before the run-over screen.
      const scale = phase === 'dying' ? FEEL.deathTimeScale : 1;
      const alive = update(
        world,
        dt * scale,
        { steer: snapshot, canSteer: acceptsSteering(phase) },
        events,
      );
      for (const event of events.drain()) handleSimEvent(event);

      if (phase === 'playing' && !alive) {
        dyingFor = 0;
        dispatch({ type: 'DIE' });
      } else if (phase === 'dying') {
        dyingFor += dt;
        if (dyingFor >= FEEL.deathSeconds) dispatch({ type: 'DEATH_ELAPSED' });
      }
    },

    render: (alpha) => {
      renderer.draw(world, alpha, viewport, camera, scene());
      hud.update(world, profile.bestScore);
      audio.tick();
    },
  });

  // ---- controls ----
  function toggleMute(): void {
    profile = { ...profile, muted: !profile.muted };
    applyMute();
    persist();
  }

  function refreshMenuStats(): void {
    const stats = must<HTMLElement>('menu-stats');
    stats.textContent = '';
    const rows: ReadonlyArray<[string, string]> = [
      ['Best', profile.bestScore.toLocaleString()],
      ['Longest', formatTime(profile.bestTimeSeconds)],
      ['Runs', String(profile.runs)],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      row.append(dt, dd);
      stats.append(row);
    }
    renderLeaderboard(must('menu-leaderboard'), profile.leaderboard, { limit: 3 });
  }

  const difficultySelect = must<HTMLSelectElement>('difficulty-select');
  const reducedMotionToggle = must<HTMLInputElement>('reduced-motion-toggle');
  const soundToggle = must<HTMLInputElement>('sound-toggle');
  const musicToggle = must<HTMLInputElement>('music-toggle');

  const onPlay = (): void => {
    audio.unlock();
    audio.play('start');
    dispatch({ type: 'START' });
  };

  must('play-button').addEventListener('click', onPlay);
  must('again-button').addEventListener('click', onPlay);
  must('resume-button').addEventListener('click', () => dispatch({ type: 'RESUME' }));
  must('restart-button').addEventListener('click', () => dispatch({ type: 'RESTART' }));
  must('quit-button').addEventListener('click', () => dispatch({ type: 'TO_MENU' }));
  must('menu-button').addEventListener('click', () => dispatch({ type: 'TO_MENU' }));
  muteButton.addEventListener('click', toggleMute);

  must('about-button').addEventListener('click', () => overlays.show('about'));
  must('settings-button').addEventListener('click', () => overlays.show('settings'));
  must('guide-button').addEventListener('click', () => overlays.show('guide'));
  must('about-back').addEventListener('click', () => overlays.show('menu'));
  must('settings-back').addEventListener('click', () => overlays.show('menu'));
  must('guide-back').addEventListener('click', () => overlays.show('menu'));

  difficultySelect.addEventListener('change', () => {
    if (isDifficultyMode(difficultySelect.value)) mode = difficultySelect.value;
  });

  reducedMotionToggle.addEventListener('change', () => {
    reducedMotion = reducedMotionToggle.checked;
    profile = { ...profile, reducedMotion };
    applyMotionPreference();
    persist();
  });

  soundToggle.addEventListener('change', () => {
    profile = { ...profile, muted: !soundToggle.checked };
    applyMute();
    persist();
  });

  musicToggle.addEventListener('change', () => {
    profile = { ...profile, music: musicToggle.checked };
    applyMusic();
    persist();
  });

  // Pause when the tab is hidden. Without this the loop tries to catch up on
  // every second the player was away and kills them the moment they return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) dispatch({ type: 'PAUSE' });
    else loop.resync();
  });
  window.addEventListener('blur', () => dispatch({ type: 'PAUSE' }));

  // Any first gesture unlocks audio, which browsers keep suspended until then.
  const unlockOnce = (): void => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce, { once: true });

  window.__dodge = {
    snapshot: (): DebugSnapshot => ({
      phase,
      score: world.score.points,
      elapsed: world.elapsed,
      lives: world.ship.lives,
      ship: { x: world.ship.x, y: world.ship.y },
      asteroids: world.asteroids.active,
      seed: world.seed,
      sector: world.sector,
      shards: world.score.shards,
      nearMisses: world.score.nearMisses,
    }),
  };

  // ---- go ----
  reducedMotionToggle.checked = reducedMotion;
  difficultySelect.value = mode;
  applyMotionPreference();
  applyMute();
  applyMusic();
  audio.setMusicMode('calm');
  refreshMenuStats();
  hud.update(world, profile.bestScore);
  document.body.dataset['phase'] = phase;
  overlays.show('menu');
  input.attach();
  loop.start();
}

function labelFor(kind: 'shield' | 'slowmo' | 'life'): string {
  if (kind === 'shield') return 'Shield';
  if (kind === 'slowmo') return `Slow-mo, ${String(POWERUPS.slowmoSeconds)} seconds`;
  return 'Extra life';
}

function pickupLabel(kind: 'shield' | 'slowmo' | 'life'): string {
  if (kind === 'shield') return 'SHIELD';
  if (kind === 'slowmo') return 'SLOW-MO';
  return '+1 LIFE';
}

function pickupColor(kind: 'shield' | 'slowmo' | 'life'): string {
  if (kind === 'shield') return PALETTE.powerShield;
  if (kind === 'slowmo') return PALETTE.powerSlowmo;
  return PALETTE.powerLife;
}

start();
