/* ═══════════════════════════════════════════════
   Plot Potato – Sound Manager (Web Audio API)
═══════════════════════════════════════════════ */

const Sounds = (() => {
  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let enabled = localStorage.getItem('pp_sound') !== 'off';
  let musicRunning = false;
  let musicTimer = null;
  let nextMusicTime = 0;

  function initCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.4;
    sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Schedule a tone at an absolute AudioContext timestamp
  function toneAt(frequency, absTime, duration, type, output) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0.001, absTime);
    env.gain.linearRampToValueAtTime(1, absTime + Math.min(0.025, duration * 0.15));
    env.gain.exponentialRampToValueAtTime(0.001, absTime + duration);
    osc.connect(env);
    env.connect(output || sfxGain);
    osc.start(absTime);
    osc.stop(absTime + duration + 0.02);
  }

  // Shorthand: offset from now
  function tone(frequency, offsetSecs, duration, type, output) {
    if (!ctx) return;
    toneAt(frequency, ctx.currentTime + offsetSecs, duration, type, output);
  }

  // ── SFX ──────────────────────────────────────────────────────────

  // Played when a story block is revealed
  function pop() {
    if (!enabled) return;
    initCtx(); resume();
    tone(330, 0,    0.09, 'triangle');
    tone(440, 0.07, 0.09, 'triangle');
    tone(550, 0.14, 0.17, 'triangle');
  }

  // Played when a new story begins during reveal
  function fanfare() {
    if (!enabled) return;
    initCtx(); resume();
    [262, 330, 392, 523].forEach((f, i) => tone(f, i * 0.11, 0.22, 'triangle'));
  }

  // Played when a player submits their block
  function submit() {
    if (!enabled) return;
    initCtx(); resume();
    tone(440, 0,    0.05, 'square');
    tone(660, 0.05, 0.14, 'triangle');
  }

  // Played every second during the last 10 seconds of the timer
  function tick() {
    if (!enabled) return;
    initCtx(); resume();
    tone(880, 0, 0.04, 'square');
  }

  // Played when all stories have been revealed
  function win() {
    if (!enabled) return;
    initCtx(); resume();
    [523, 659, 784, 880, 1047].forEach((f, i) => tone(f, i * 0.13, 0.28, 'triangle'));
    tone(784, 5 * 0.13, 0.55, 'triangle');
  }

  // ── Background Music ──────────────────────────────────────────────

  const BPM = 108;
  const BEAT = 60 / BPM;
  const C4 = 261.63;
  const mf = (semi) => C4 * Math.pow(2, semi / 12);

  // Bouncy C-major pentatonic melody [semitones-from-C4, beat-count]
  const MELODY = [
    [4, 0.5], [7, 0.5], [12, 1],  [9, 0.5], [7, 0.5],
    [4, 0.5], [7, 0.5], [12, 2],
    [14, 0.5],[12, 0.5],[9,  1],   [7, 1],
    [4, 0.5], [7, 0.5], [4,  2],
  ];

  function scheduleMelody(startTime) {
    let t = startTime;
    MELODY.forEach(([semi, beats]) => {
      const dur = beats * BEAT;
      toneAt(mf(semi), t, dur * 0.78, 'triangle', musicGain);
      t += dur;
    });
    return t; // end time for loop scheduling
  }

  function musicTickLoop() {
    if (!musicRunning) return;
    const now = ctx.currentTime;
    if (nextMusicTime < now + 1.5) {
      nextMusicTime = scheduleMelody(Math.max(now + 0.05, nextMusicTime));
    }
    musicTimer = setTimeout(musicTickLoop, 500);
  }

  function startMusic() {
    if (!enabled || musicRunning) return;
    initCtx(); resume();
    musicRunning = true;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 2.5);
    nextMusicTime = ctx.currentTime + 0.1;
    musicTickLoop();
  }

  function stopMusic() {
    musicRunning = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    if (ctx && musicGain) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    }
  }

  // ── Toggle ────────────────────────────────────────────────────────

  function setEnabled(val) {
    enabled = val;
    localStorage.setItem('pp_sound', val ? 'on' : 'off');
    if (!val) stopMusic();
    updateToggleUI();
  }

  function isEnabled() { return enabled; }

  function updateToggleUI() {
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) {
      btn.textContent = enabled ? '🔊' : '🔇';
      btn.setAttribute('aria-pressed', String(enabled));
    }
  }

  return { pop, fanfare, submit, tick, win, startMusic, stopMusic, setEnabled, isEnabled, updateToggleUI };
})();
