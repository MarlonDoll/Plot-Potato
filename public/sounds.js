/* ═══════════════════════════════════════════════
   Plot Potato – Sound Manager (Web Audio API)
═══════════════════════════════════════════════ */

const Sounds = (() => {
  let ctx = null;
  let sfxGain = null;
  let enabled = localStorage.getItem('pp_sound') !== 'off';

  function initCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.18;
    sfxGain.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(frequency, offsetSecs, duration, type) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = frequency;
    const s = ctx.currentTime + offsetSecs;
    env.gain.setValueAtTime(0.001, s);
    env.gain.linearRampToValueAtTime(1, s + Math.min(0.025, duration * 0.15));
    env.gain.exponentialRampToValueAtTime(0.001, s + duration);
    osc.connect(env);
    env.connect(sfxGain);
    osc.start(s);
    osc.stop(s + duration + 0.02);
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

  // ── Toggle ────────────────────────────────────────────────────────

  function setEnabled(val) {
    enabled = val;
    localStorage.setItem('pp_sound', val ? 'on' : 'off');
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

  return { pop, fanfare, submit, tick, win, setEnabled, isEnabled, updateToggleUI };
})();
