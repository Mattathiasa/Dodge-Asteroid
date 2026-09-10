import './styles.css';

import type { DifficultyMode } from './game/modes.js';
import type { Profile } from './storage/storage.js';
import type { SimEvent } from './game/events.js';
import type { Phase } from './game/phase.js';

import { CAMERA, POWERUPS, WORLD } from './config.js';
import { DIFFICULTY_SCALES, isDifficultyMode } from './game/modes.js';
import { GameLoop } from './game/loop.js';
import { Hud, formatTime } from './ui/hud.js';
import { InputManager } from './input/input.js';
import { OverlayManager } from './ui/overlay.js';
import { Renderer } from './render/renderer.js';
import { Announcer, prefersReducedMotion } from './ui/a11y.js';
import { acceptsSteering, isSimulating, reduce } from './game/phase.js';
import { addTrauma, createCamera, updateCamera } from './render/camera.js';
import { computeViewport, fitDisplaySize } from './core/viewport.js';
import { createAudioEngine } from './audio/audio.js';
import { createEventBuffer } from './game/events.js';
import { createRng, randomSeed } from './core/rng.js';
import { createWorld, resetRun } from './game/world.js';
import { updateAttract } from './game/attract.js';
import { loadProfile, recordRun, saveProfile } from './storage/storage.js';
import { renderLeaderboard } from './ui/leaderboard.js';
import { update } from './game/update.js';

const COUNTDOWN_SECONDS = 3;

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

function start(): void {
  const canvas = must<HTMLCanvasElement>('game');
  const stage = canvas.parentElement;
  if (stage === null) throw new Error('canvas has no stage parent');

  // ---- state ----
  let profile: Profile = loadProfile();
  let phase: Phase = 'menu';
  let mode: DifficultyMode = 'normal';
  let reducedMotion = profile.reducedMotion ?? prefersReducedMotion();

  const world = createWorld(randomSeed());
  const camera = createCamera();
  const shakeRng = createRng(0x51a2e);
  const events = createEventBuffer();
  const audio = createAudioEngine();
  const input = new InputManager(canvas);
  const renderer = new Renderer(canvas, 0xbeef);
  const announcer = new Announcer(must<HTMLElement>('live-region'));

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
    },
    stage,
  );

  const countdownEl = must<HTMLElement>('countdown');
  const muteButton = must<HTMLButtonElement>('mute-button');
  const muteState = must<HTMLElement>('mute-state');

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
  };

  const applyMute = (): void => {
    audio.setMuted(profile.muted);
    muteState.textContent = profile.muted ? 'off' : 'on';
    muteButton.setAttribute('aria-pressed', String(profile.muted));
    soundToggle.checked = !profile.muted;
  };

  const persist = (): void => saveProfile(profile, undefined);

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
    hud.invalidate();
    input.clearTarget();
    loop.resync();
  }

  function finishRun(): void {
    const before = profile.bestScore;
    profile = recordRun(profile, world.score.points, world.score.survivalTime);
    persist();

    must<HTMLElement>('final-score').textContent = world.score.points.toLocaleString();
    must<HTMLElement>('final-meta').textContent =
      `${formatTime(world.score.survivalTime)} survived · ${String(world.score.dodges)} dodged`;

    const isBest = world.score.points > before && world.score.points > 0;
    must<HTMLElement>('best-banner').hidden = !isBest;
    renderLeaderboard(must('gameover-leaderboard'), profile.leaderboard);
    refreshMenuStats();

    announcer.sayNow(
      `Run over. Score ${String(world.score.points)}.${isBest ? ' New personal best.' : ''}`,
    );
  }

  function onPhaseChange(previous: Phase, next: Phase): void {
    if (next === 'countdown') beginRun();
    if (next === 'menu') {
      // Hand the field back to the attract backdrop.
      resetRun(world, randomSeed());
      loop.resync();
    }
    if (next === 'playing' && previous === 'paused') loop.resync();
    if (next === 'gameOver') {
      finishRun();
      audio.play('gameOver');
    }

    const screen = OverlayManager.forPhase(next);
    if (screen === null) overlays.hide();
    else overlays.show(screen);

    countdownEl.classList.toggle('is-active', next === 'countdown');
    if (next === 'paused') announcer.sayNow('Paused.');
  }

  // ---- simulation events ----
  function handleSimEvent(event: SimEvent): void {
    switch (event.type) {
      case 'nearMiss':
        audio.play('nearMiss');
        break;
      case 'pickup':
        audio.play('pickup');
        addTrauma(camera, CAMERA.traumaOnPickup);
        announcer.say(`${labelFor(event.kind)} collected.`);
        break;
      case 'shieldBreak':
        audio.play('shieldBreak');
        addTrauma(camera, CAMERA.traumaOnShieldBreak);
        announcer.say('Shield absorbed a hit.');
        break;
      case 'lifeLost':
        audio.play('lifeLost');
        addTrauma(camera, CAMERA.traumaOnHit);
        announcer.sayNow(`Hit. ${String(event.livesLeft)} remaining.`);
        break;
      case 'destroyed':
        addTrauma(camera, CAMERA.traumaOnHit);
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

      if (!reducedMotion) renderer.updateBackground(dt);
      updateCamera(camera, dt, shakeRng);

      if (phase === 'menu') {
        // Keep meteors drifting behind the title screen.
        updateAttract(world, dt);
        return;
      }

      if (!isSimulating(phase)) return;

      if (phase === 'countdown') {
        world.countdown -= dt;
        countdownEl.textContent = world.countdown > 0 ? String(Math.ceil(world.countdown)) : 'GO';
        if (world.countdown <= -0.35) dispatch({ type: 'COUNTDOWN_ELAPSED' });
        return;
      }

      const alive = update(
        world,
        dt,
        { steer: snapshot, canSteer: acceptsSteering(phase) },
        events,
      );
      for (const event of events.drain()) handleSimEvent(event);
      if (!alive) dispatch({ type: 'DIE' });
    },

    render: (alpha) => {
      renderer.draw(world, alpha, viewport, camera, phase !== 'menu');
      hud.update(world, profile.bestScore);
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
      const wrap = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      wrap.append(dt, dd);
      stats.append(wrap);
    }
    renderLeaderboard(must('menu-leaderboard'), profile.leaderboard);
  }

  const difficultySelect = must<HTMLSelectElement>('difficulty-select');
  const reducedMotionToggle = must<HTMLInputElement>('reduced-motion-toggle');
  const soundToggle = must<HTMLInputElement>('sound-toggle');

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
  must('about-back').addEventListener('click', () => overlays.show('menu'));
  must('settings-back').addEventListener('click', () => overlays.show('menu'));

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
    }),
  };

  // ---- go ----
  reducedMotionToggle.checked = reducedMotion;
  difficultySelect.value = mode;
  applyMotionPreference();
  applyMute();
  refreshMenuStats();
  hud.update(world, profile.bestScore);
  overlays.show('menu');
  input.attach();
  loop.start();
}

function labelFor(kind: 'shield' | 'slowmo' | 'life'): string {
  if (kind === 'shield') return 'Shield';
  if (kind === 'slowmo') return `Slow-mo, ${String(POWERUPS.slowmoSeconds)} seconds`;
  return 'Extra life';
}

start();
