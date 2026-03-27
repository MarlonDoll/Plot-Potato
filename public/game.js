/* ═══════════════════════════════════════════════
   Plot Potato – Game Client
═══════════════════════════════════════════════ */

const socket = io();

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  playerId: null,
  isHost: false,
  roomCode: null,
  room: null,
  charLimit: 200,
  timerInterval: null,
  timerSecondsLeft: 0,
  revealedBlocks: [],          // for tracking full reveal
  typewriting: false,          // true while a block is being typewritten
};

// ─── Quick Fill Presets ───────────────────────────────────────────────────────
const SETTING_PRESETS = [
  'A haunted grocery store', 'The surface of Mars', 'A fancy restaurant at 3am',
  'Inside a broken elevator', 'A submarine deep in the Pacific', 'A medieval DMV office',
  'A space station cafeteria', 'An enchanted forest at rush hour',
  'A retirement home for superheroes', 'The world\'s smallest country',
  'A pirate ship stuck in a traffic jam', 'An underground cheese museum',
  'A theme park for ghosts', 'A library that only stocks one book',
  'The back room of a magic shop', 'A ski lodge in the desert',
  'A courtroom on the moon', 'Inside a giant\'s coat pocket',
  'A five-star hotel for monsters', 'A petting zoo for mythical creatures',
  'A train that only goes backwards', 'The waiting room at the end of the universe',
  'A jazz club run by penguins', 'A cloud that got lost',
  'An extremely polite volcano', 'A vending machine that grants wishes',
  'A mall after closing time', 'The bottom of a very empty swimming pool',
  'A surprisingly cozy dungeon', 'A bus stop between dimensions',
  'A bowling alley inside a volcano', 'An igloo on a tropical island',
  'A farm where nothing grows correctly', 'The world\'s longest escalator',
  'A city built entirely on trampolines', 'A submarine full of retired clowns',
];

const SUBJECT_PRESETS = [
  'A dog named Bucky', 'A nervous robot', 'The office printer', 'Two rival grandmothers',
  'A wizard who lost their glasses', 'A sentient houseplant', 'An overly confident hamster',
  'A time-traveling barista', 'A dragon with a pollen allergy',
  'Three raccoons in a trench coat', 'A vampire who hates the night',
  'A retired tooth fairy', 'An extremely ambitious snail',
  'A ghost who is terrible at haunting', 'A mermaid who is afraid of fish',
  'A knight who moonlights as an accountant', 'A talking sandwich',
  'A bear who runs a small accounting firm', 'A witch whose spells always work slightly wrong',
  'A very polite kraken', 'A genie with only bad ideas',
  'A cat running for mayor', 'A cloud with self-esteem issues',
  'A skeleton who volunteers at a hospital', 'An alien trying to return a library book',
  'A superhero whose only power is being punctual', 'A pirate who is scared of water',
  'A yeti with a great podcast', 'A gargoyle going through a midlife crisis',
  'An elf who hates Christmas', 'A robot learning to paint',
  'A mummy who just wants to sleep', 'A very dramatic seagull',
  'Four mice sharing one very long scarf', 'A time traveler who only visits Tuesdays',
  'A detective who solves mysteries by accident',
];

// ─── Screen Management ────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) el.textContent = msg;
}

function clearError(elId) {
  const el = document.getElementById(elId);
  if (el) el.textContent = '';
}

// ─── Landing ──────────────────────────────────────────────────────────────────
document.getElementById('btn-host').addEventListener('click', () => showScreen('screen-host-setup'));
document.getElementById('btn-join').addEventListener('click', () => showScreen('screen-join-setup'));
document.getElementById('btn-back-host').addEventListener('click', () => showScreen('screen-landing'));
document.getElementById('btn-back-join').addEventListener('click', () => showScreen('screen-landing'));

// Quick-join shortcut
const landingCodeInput = document.getElementById('landing-code');
landingCodeInput.addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
});
document.getElementById('btn-quick-join').addEventListener('click', () => {
  const code = landingCodeInput.value.trim().toUpperCase();
  if (code.length < 4) { landingCodeInput.focus(); return; }
  document.getElementById('join-code').value = code;
  showScreen('screen-join-setup');
});
landingCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-quick-join').click();
});

// How to Play modal
document.getElementById('btn-how-to-play').addEventListener('click', () => {
  document.getElementById('how-to-play-modal').classList.remove('hidden');
});
document.getElementById('btn-close-htp').addEventListener('click', () => {
  document.getElementById('how-to-play-modal').classList.add('hidden');
});

// Sound toggle
document.getElementById('btn-sound-toggle').addEventListener('click', () => {
  Sounds.setEnabled(!Sounds.isEnabled());
});
Sounds.updateToggleUI();

// ─── Name persistence ─────────────────────────────────────────────────────────
const savedName = localStorage.getItem('pp_name') || '';
document.getElementById('host-name').value = savedName;
document.getElementById('join-name').value = savedName;

function saveName(name) {
  localStorage.setItem('pp_name', name);
}

// ─── Host Setup ───────────────────────────────────────────────────────────────
document.getElementById('btn-create-room').addEventListener('click', () => {
  const name = document.getElementById('host-name').value.trim();
  if (!name) return showError('host-error', 'Please enter your name.');
  clearError('host-error');
  saveName(name);
  socket.emit('host:create', { name });
});

document.getElementById('host-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-create-room').click();
});

// ─── Join Setup ───────────────────────────────────────────────────────────────
document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-name').value.trim();
  if (!code || code.length < 4) return showError('join-error', 'Enter a 4-character room code.');
  if (!name) return showError('join-error', 'Please enter your name.');
  clearError('join-error');
  saveName(name);
  socket.emit('player:join', { code, name });
});

document.getElementById('join-code').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
});

document.getElementById('join-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join-room').click();
});

// ─── Lobby ────────────────────────────────────────────────────────────────────
document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1500);
  });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
  socket.emit('host:start', { code: state.roomCode });
});

// Settings
const settingCharLimit = document.getElementById('setting-charlimit');
const settingCharLimitVal = document.getElementById('setting-charlimit-val');
settingCharLimit.addEventListener('input', () => {
  settingCharLimitVal.textContent = settingCharLimit.value;
  pushSettings();
});

document.getElementById('setting-rounds').addEventListener('change', pushSettings);

const settingTimerEnabled = document.getElementById('setting-timer-enabled');
settingTimerEnabled.addEventListener('change', () => {
  const wrap = document.getElementById('timer-seconds-wrap');
  wrap.classList.toggle('hidden', !settingTimerEnabled.checked);
  pushSettings();
});
document.getElementById('setting-timer-seconds').addEventListener('change', pushSettings);

function pushSettings() {
  socket.emit('host:settings', {
    code: state.roomCode,
    settings: {
      charLimit: parseInt(settingCharLimit.value, 10),
      roundsPerPlayer: document.getElementById('setting-rounds').value,
      timerEnabled: settingTimerEnabled.checked,
      timerSeconds: parseInt(document.getElementById('setting-timer-seconds').value, 10),
    },
  });
}

function renderLobby(room) {
  state.room = room;
  state.roomCode = room.code;

  document.getElementById('lobby-code').textContent = room.code;
  document.getElementById('player-count').textContent = room.players.length;

  const list = document.getElementById('player-list');
  list.innerHTML = '';
  room.players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="player-name">${escHtml(p.name)}</span>
      <span class="host-badge" style="${p.isHost ? '' : 'display:none'}">Host</span>
      ${state.isHost && !p.isHost ? `<button class="btn-kick" data-id="${p.id}" title="Kick">✕</button>` : ''}
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.btn-kick').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('host:kick', { code: state.roomCode, playerId: btn.dataset.id });
    });
  });

  const hostSettings = document.getElementById('host-settings');
  const playerWaiting = document.getElementById('player-waiting');
  if (state.isHost) {
    hostSettings.classList.remove('hidden');
    playerWaiting.classList.add('hidden');
  } else {
    hostSettings.classList.add('hidden');
    playerWaiting.classList.remove('hidden');
  }

  showScreen('screen-lobby');
}

// ─── Story Creation ───────────────────────────────────────────────────────────
function submitAnchorsAuto() {
  const settingEl  = document.getElementById('anchor-setting');
  const subjectsEl = document.getElementById('anchor-subjects');
  if (!settingEl.value.trim()) {
    settingEl.value = SETTING_PRESETS[Math.floor(Math.random() * SETTING_PRESETS.length)];
  }
  if (!subjectsEl.value.trim()) {
    subjectsEl.value = SUBJECT_PRESETS[Math.floor(Math.random() * SUBJECT_PRESETS.length)];
  }
  // Timer forced both to presets — bypass the "don't be lazy" check
  settingEl.dataset.presetFilled  = '';
  subjectsEl.dataset.presetFilled = '';
  document.getElementById('btn-submit-anchors').click();
}

function initStoryCreation() {
  renderPresets('setting-presets', SETTING_PRESETS, 'anchor-setting');
  renderPresets('subject-presets', SUBJECT_PRESETS, 'anchor-subjects');

  const settingEl  = document.getElementById('anchor-setting');
  const subjectsEl = document.getElementById('anchor-subjects');
  settingEl.value  = '';
  subjectsEl.value = '';
  settingEl.dataset.presetFilled  = '';
  subjectsEl.dataset.presetFilled = '';
  document.getElementById('btn-submit-anchors').disabled = false;
  document.getElementById('creation-waiting').classList.add('hidden');
  document.getElementById('creation-waiting').textContent = '';

  clearTimer();
  const settings = state.room && state.room.settings;
  if (settings && settings.timerEnabled) {
    startTimer(settings.timerSeconds, 'creation-timer-bar-wrap', 'creation-timer-bar', 'creation-timer-label', submitAnchorsAuto);
  } else {
    document.getElementById('creation-timer-bar-wrap').classList.add('hidden');
  }

  showScreen('screen-story-creation');
}

function renderPresets(containerId, presets, targetInputId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const subset = shuffleArray([...presets]).slice(0, 5);
  subset.forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = text;
    btn.addEventListener('click', () => {
      const input = document.getElementById(targetInputId);
      input.value = text;
      input.dataset.presetFilled = '1';
    });
    container.appendChild(btn);
  });
}

// Clear the preset flag whenever the player types manually
document.getElementById('anchor-setting').addEventListener('input', function () {
  this.dataset.presetFilled = '';
});
document.getElementById('anchor-subjects').addEventListener('input', function () {
  this.dataset.presetFilled = '';
});

document.getElementById('btn-submit-anchors').addEventListener('click', () => {
  const settingEl  = document.getElementById('anchor-setting');
  const subjectsEl = document.getElementById('anchor-subjects');
  const setting  = settingEl.value.trim();
  const subjects = subjectsEl.value.trim();
  if (!setting)  return alert('Please enter a setting.');
  if (!subjects) return alert('Please enter subject(s).');

  // Block if both fields were filled from presets — at least one should be original
  if (settingEl.dataset.presetFilled && subjectsEl.dataset.presetFilled) {
    return alert("Don't be lazy — write at least one of these yourself! 🥔");
  }

  clearTimer();
  document.getElementById('btn-submit-anchors').disabled = true;
  document.getElementById('creation-waiting').classList.remove('hidden');
  document.getElementById('creation-waiting').textContent = 'Waiting for others…';

  socket.emit('player:submitAnchors', { code: state.roomCode, setting, subjects });
});

// ─── Writing Phase ────────────────────────────────────────────────────────────
function initWriting(data) {
  const { room, assignment } = data;
  state.charLimit = room.settings.charLimit;
  document.getElementById('char-limit-display').textContent = state.charLimit;
  document.getElementById('writing-round-badge').textContent = `Round ${room.currentRound + 1} of ${room.totalRounds}`;
  document.getElementById('writing-setting').textContent = assignment.anchors.setting;
  document.getElementById('writing-subjects').textContent = assignment.anchors.subjects;

  const prevBlock = document.getElementById('writing-previous');
  const firstHint = document.getElementById('writing-first-hint');

  if (assignment.isFirstBlock) {
    prevBlock.classList.add('hidden');
    firstHint.classList.remove('hidden');
  } else {
    firstHint.classList.add('hidden');
    prevBlock.classList.remove('hidden');
    document.getElementById('writing-prev-author').textContent = '';
    document.getElementById('writing-prev-text').textContent = assignment.previousBlock.text;
  }

  const textarea = document.getElementById('writing-textarea');
  textarea.value = '';
  textarea.maxLength = state.charLimit;
  textarea.disabled = false;
  textarea.placeholder = assignment.isFirstBlock ? 'Begin the story…' : 'Continue the story…';

  updateCharCount();
  document.getElementById('btn-submit-block').disabled = false;
  document.getElementById('writing-progress-label').textContent = '';
  document.getElementById('writing-submitted').classList.add('hidden');

  // Timer
  clearTimer();
  if (room.settings.timerEnabled) {
    startTimer(room.settings.timerSeconds, 'timer-bar-wrap', 'timer-bar', 'timer-label', () => {
      if (!writingTextarea.value.trim()) writingTextarea.value = '…';
      submitBlock();
    });
  } else {
    document.getElementById('timer-bar-wrap').classList.add('hidden');
  }

  showScreen('screen-writing');
}

const writingTextarea = document.getElementById('writing-textarea');
writingTextarea.addEventListener('input', updateCharCount);

function updateCharCount() {
  const val = writingTextarea.value.length;
  const el = document.getElementById('char-count');
  el.textContent = val;
  el.classList.toggle('over', val >= state.charLimit);
}

document.getElementById('btn-submit-block').addEventListener('click', submitBlock);

writingTextarea.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') submitBlock();
});

function submitBlock() {
  const text = writingTextarea.value.trim();
  if (!text) return alert('Write something first!');
  Sounds.submit();
  document.getElementById('btn-submit-block').disabled = true;
  writingTextarea.disabled = true;
  clearTimer();

  document.getElementById('writing-submitted').classList.remove('hidden');
  document.getElementById('writing-submitted-count').textContent = '';
  socket.emit('player:submitBlock', { code: state.roomCode, text });
}

function startTimer(seconds, wrapId, barId, labelId, onTimeout) {
  const barWrap = document.getElementById(wrapId);
  const bar = document.getElementById(barId);
  const label = document.getElementById(labelId);
  barWrap.classList.remove('hidden');
  state.timerSecondsLeft = seconds;

  function tick() {
    const pct = (state.timerSecondsLeft / seconds) * 100;
    bar.style.setProperty('--progress', pct + '%');
    const m = Math.floor(state.timerSecondsLeft / 60);
    const s = state.timerSecondsLeft % 60;
    label.textContent = `${m}:${String(s).padStart(2, '0')}`;
    barWrap.classList.toggle('low', state.timerSecondsLeft <= 10 && state.timerSecondsLeft > 0);
    if (state.timerSecondsLeft <= 0) {
      barWrap.classList.remove('low');
      clearTimer();
      onTimeout();
      return;
    }
    if (state.timerSecondsLeft <= 10) Sounds.tick();
    state.timerSecondsLeft--;
  }
  tick();
  state.timerInterval = setInterval(tick, 1000);
}

function clearTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
}

// ─── Reveal Phase ─────────────────────────────────────────────────────────────
function resetRevealAnchors() {
  document.getElementById('reveal-setting').textContent = '—';
  document.getElementById('reveal-subjects').textContent = '—';
  document.getElementById('reveal-anchor-setting').classList.remove('anchor-visible');
  document.getElementById('reveal-anchor-subjects').classList.remove('anchor-visible');
}

function initReveal(data) {
  state.revealedBlocks = [];
  document.getElementById('reveal-story-blocks').innerHTML = '';
  document.getElementById('reveal-end').classList.add('hidden');
  document.getElementById('awards-section').classList.add('hidden');
  document.getElementById('full-read-modal').classList.add('hidden');

  // Show reaction bar
  document.getElementById('reaction-bar').classList.remove('hidden');

  document.getElementById('reveal-story-counter').textContent = `Story 1 of ${data.totalStories}`;

  if (data.firstStory) {
    document.getElementById('reveal-story-title').textContent = `${data.firstStory.authorName}'s Story`;
  } else {
    document.getElementById('reveal-story-title').textContent = 'Story Time!';
  }

  // Both anchor items start hidden — revealed one click at a time
  resetRevealAnchors();

  updateRevealControls();
  showScreen('screen-reveal');
  Sounds.fanfare();
}

function onRevealNewStory(data) {
  const { storyIndex, totalStories, authorName } = data;
  document.getElementById('reveal-story-counter').textContent = `Story ${storyIndex + 1} of ${totalStories}`;
  document.getElementById('reveal-story-title').textContent = `${authorName}'s Story`;

  // Reset anchor items — Setting and Subjects will appear one click at a time
  resetRevealAnchors();

  document.getElementById('reveal-story-blocks').innerHTML = '';
  Sounds.fanfare();
}

function onRevealBlock(data) {
  Sounds.pop();
  const { block, blockIndex, totalBlocks } = data;
  const container = document.getElementById('reveal-story-blocks');
  const el = document.createElement('div');
  el.className = `story-block${blockIndex === 0 ? ' first-block' : ''}`;
  el.innerHTML = `
    <div class="block-header">
      <span class="block-prompt-number">Prompt ${blockIndex + 1}/${totalBlocks}</span>
      <span class="block-author"></span>
    </div>
    <div class="block-text"></div>
  `;
  container.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Disable host's Next button while typing
  const nextBtn = document.getElementById('btn-reveal-next');
  if (state.isHost) nextBtn.disabled = true;

  typewriteBlock(
    el.querySelector('.block-text'),
    el.querySelector('.block-author'),
    block.text,
    block.authorName,
    () => { if (state.isHost) nextBtn.disabled = false; }
  );
}

function onRevealEnd(data) {
  Sounds.win();
  launchConfetti();

  // Hide reaction bar
  document.getElementById('reaction-bar').classList.add('hidden');

  document.getElementById('reveal-end').classList.remove('hidden');
  document.getElementById('btn-reveal-next').style.display = 'none';
  document.getElementById('reveal-waiting-msg').style.display = 'none';
  if (state.isHost) {
    document.getElementById('btn-play-again').classList.remove('hidden');
  }

  // Populate full read modal
  const fullContent = document.getElementById('full-read-content');
  fullContent.innerHTML = '';
  data.stories.forEach((story, i) => {
    const div = document.createElement('div');
    div.className = 'full-story';
    div.innerHTML = `
      <h3>Story ${i + 1}: ${escHtml(story.authorName)}'s</h3>
      <div class="full-story-anchors">
        📍 ${escHtml(story.anchors.setting)} &nbsp;|&nbsp; ⭐ ${escHtml(story.anchors.subjects)}
      </div>
      ${story.blocks.map((b, bi) => `
        <div class="full-block">
          <div class="full-block-author">${escHtml(b.authorName)}</div>
          <div class="full-block-text">${escHtml(b.text)}</div>
        </div>
      `).join('')}
    `;
    fullContent.appendChild(div);
  });

  // Show awards with a short delay (let confetti play first)
  const awardData = computeAwards(
    data.stories,
    data.reactionCounts || {},
    data.players || []
  );
  setTimeout(() => renderAwards(awardData), 1200);
}

function updateRevealControls() {
  const nextBtn = document.getElementById('btn-reveal-next');
  const waitingMsg = document.getElementById('reveal-waiting-msg');
  if (state.isHost) {
    nextBtn.style.display = '';
    waitingMsg.style.display = 'none';
  } else {
    nextBtn.style.display = 'none';
    waitingMsg.style.display = '';
  }
}

document.getElementById('btn-reveal-next').addEventListener('click', () => {
  socket.emit('host:revealNext', { code: state.roomCode });
});

document.getElementById('btn-play-again').addEventListener('click', () => {
  socket.emit('host:restart', { code: state.roomCode });
});

document.getElementById('btn-full-read').addEventListener('click', () => {
  document.getElementById('full-read-modal').classList.remove('hidden');
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
  document.getElementById('full-read-modal').classList.add('hidden');
});

// ─── Potato Pass Overlay ──────────────────────────────────────────────────────
function showPotatoPass(callback) {
  const overlay = document.getElementById('potato-pass-overlay');
  const potato  = document.getElementById('pass-potato-emoji');

  overlay.classList.add('active');

  // Force-restart the CSS animation each time
  potato.style.animation = 'none';
  potato.getBoundingClientRect(); // reflow
  potato.style.animation = 'potatoFly 1.3s ease-in-out forwards';

  setTimeout(() => {
    overlay.classList.remove('active');
    setTimeout(callback, 260); // wait for fade-out before showing writing screen
  }, 1500);
}

// ─── Typewriter Effect ────────────────────────────────────────────────────────
// ~100 chars/sec — fast talker pace
const TYPEWRITER_MS = 10;

function typewriteBlock(textEl, authorEl, text, authorName, onDone) {
  let i = 0;
  state.typewriting = true;

  function next() {
    if (i < text.length) {
      textEl.textContent = text.slice(0, ++i);
      setTimeout(next, TYPEWRITER_MS);
    } else {
      // Reveal author with a little fade
      authorEl.textContent = authorName;
      authorEl.classList.add('block-author-reveal');
      state.typewriting = false;
      if (onDone) onDone();
    }
  }
  next();
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'block';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#FF2D78', '#FFD600', '#9333EA', '#FF6FA8', '#ffffff', '#FF6B6B', '#4ADE80'];
  const particles = Array.from({ length: 170 }, () => ({
    x: Math.random() * canvas.width,
    y: -(Math.random() * canvas.height * 0.6 + 20),
    r: Math.random() * 6 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 9,
    wobble: Math.random() * Math.PI * 2,
    shape: Math.random() > 0.4 ? 'rect' : 'circle',
  }));

  const DURATION = 4200;
  const startTime = performance.now();
  let raf;

  function draw(now) {
    const elapsed = now - startTime;
    // Fade out during last 30 %
    const alpha = Math.min(1, Math.max(0, 1 - (elapsed - DURATION * 0.7) / (DURATION * 0.3)));
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx + Math.sin(p.wobble) * 0.6;
      p.y += p.vy;
      p.vy += 0.06;          // gravity
      p.angle += p.spin;
      p.wobble += 0.05;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle * Math.PI / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < DURATION) {
      raf = requestAnimationFrame(draw);
    } else {
      canvas.style.display = 'none';
      cancelAnimationFrame(raf);
    }
  }

  raf = requestAnimationFrame(draw);
}

// ─── Emoji Reactions ──────────────────────────────────────────────────────────
document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    socket.emit('player:react', { code: state.roomCode, emoji: btn.dataset.emoji });
    // Brief visual pulse on the button
    btn.style.transform = 'scale(1.6)';
    setTimeout(() => { btn.style.transform = ''; }, 180);
  });
});

function spawnFloatingReaction(emoji) {
  const el = document.createElement('span');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  // Random position in the lower 40% of the screen
  el.style.left = Math.round(8 + Math.random() * 84) + 'vw';
  el.style.top  = Math.round(50 + Math.random() * 35) + 'vh';
  document.getElementById('floating-reactions').appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ─── Awards ───────────────────────────────────────────────────────────────────
function computeAwards(stories, reactionCounts, players) {
  const stats = {};

  // Seed from players array first
  for (const p of players) {
    stats[p.id] = { name: p.name, wordCount: 0 };
  }

  // Fill word counts from blocks (also catches players who left)
  for (const story of stories) {
    for (const block of story.blocks) {
      if (!stats[block.authorId]) {
        stats[block.authorId] = { name: block.authorName, wordCount: 0 };
      }
      stats[block.authorId].wordCount += block.text.trim().split(/\s+/).filter(Boolean).length;
    }
  }

  const playerIds = Object.keys(stats);
  if (playerIds.length === 0) return [];
  const awards = {};

  // Word count awards (only meaningful with 2+ players)
  if (playerIds.length > 1) {
    const wordCounts = playerIds.map(id => stats[id].wordCount);
    const maxWords = Math.max(...wordCounts);
    const minWords = Math.min(...wordCounts);

    const novelists = playerIds.filter(id => stats[id].wordCount === maxWords);
    if (novelists.length === 1) {
      awards[novelists[0]] = { emoji: '📚', title: 'The Novelist', desc: 'Most words written' };
    }

    const minimalists = playerIds.filter(id => stats[id].wordCount === minWords);
    if (minimalists.length === 1 && !awards[minimalists[0]]) {
      awards[minimalists[0]] = { emoji: '🤏', title: 'The Minimalist', desc: 'Fewest words written' };
    }
  }

  // Per-emoji awards
  const emojiAwards = [
    { emoji: '😂', title: 'The Comedian',   desc: 'Most laughs earned'    },
    { emoji: '🔥', title: 'On Fire',         desc: 'Most 🔥 reactions'     },
    { emoji: '😱', title: 'Plot Twister',    desc: 'Most shocking moments' },
    { emoji: '❤️', title: 'Most Loved',      desc: 'Most ❤️ reactions'     },
    { emoji: '💀', title: 'The Villain',     desc: 'Most 💀 reactions'     },
    { emoji: '😢', title: 'The Tearjerker',  desc: 'Most tears shed'       },
    { emoji: '🙈', title: 'Too Much!',       desc: 'Most 🙈 reactions'     },
  ];

  for (const { emoji, title, desc } of emojiAwards) {
    const counts = playerIds.map(id => ({
      id, count: (reactionCounts[id] && reactionCounts[id][emoji]) || 0,
    }));
    const maxCount = Math.max(...counts.map(c => c.count));
    if (maxCount > 0) {
      const winners = counts.filter(c => c.count === maxCount);
      if (winners.length === 1 && !awards[winners[0].id]) {
        awards[winners[0].id] = { emoji, title, desc };
      }
    }
  }

  // Overall reaction crown (if not already awarded)
  const totals = playerIds.map(id => ({
    id,
    total: Object.values(reactionCounts[id] || {}).reduce((a, b) => a + b, 0),
  }));
  const maxTotal = Math.max(...totals.map(t => t.total));
  if (maxTotal > 0) {
    const crowdPleasers = totals.filter(t => t.total === maxTotal);
    if (crowdPleasers.length === 1 && !awards[crowdPleasers[0].id]) {
      awards[crowdPleasers[0].id] = { emoji: '🏆', title: 'MVP', desc: 'Most reactions overall' };
    }
  }

  // Consolation awards for anyone without one
  const consolations = [
    { emoji: '✍️', title: 'Showed Up',      desc: 'Participated in the madness' },
    { emoji: '🥔', title: 'Just a Potato',  desc: 'Came, wrote, survived'       },
    { emoji: '🎲', title: 'Wild Card',       desc: 'Unpredictable as always'     },
    { emoji: '👀', title: 'Silent Witness',  desc: 'Watched the chaos unfold'    },
  ];
  let ci = 0;
  for (const id of playerIds) {
    if (!awards[id]) awards[id] = consolations[ci++ % consolations.length];
  }

  return playerIds.map(id => ({ id, name: stats[id].name, award: awards[id] }));
}

function renderAwards(awardData) {
  if (!awardData || awardData.length === 0) return;

  const section = document.getElementById('awards-section');
  const grid    = document.getElementById('awards-grid');
  grid.innerHTML = '';

  awardData.forEach(({ name, award }) => {
    const card = document.createElement('div');
    card.className = 'award-card';
    card.innerHTML = `
      <span class="award-emoji">${award.emoji}</span>
      <span class="award-title">${escHtml(award.title)}</span>
      <span class="award-player">${escHtml(name)}</span>
    `;
    grid.appendChild(card);
  });

  section.classList.remove('hidden');

  // Stagger the cards in
  const cards = grid.querySelectorAll('.award-card');
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('visible'), i * 140);
  });
}

// ─── Socket Events ────────────────────────────────────────────────────────────
socket.on('room:joined', ({ room, playerId, isHost }) => {
  state.playerId = playerId;
  state.isHost = isHost;
  renderLobby(room);
});

socket.on('room:updated', (room) => {
  state.room = room;
  if (room.phase === 'lobby') {
    renderLobby(room);
  }
});

socket.on('phase:lobby', (room) => {
  renderLobby(room);
});

socket.on('error', (msg) => {
  // Show error on whichever setup screen is visible
  if (document.getElementById('screen-host-setup').classList.contains('active')) {
    showError('host-error', msg);
  } else if (document.getElementById('screen-join-setup').classList.contains('active')) {
    showError('join-error', msg);
  } else {
    alert(msg);
  }
});

socket.on('kicked', () => {
  alert('You were removed from the room.');
  showScreen('screen-landing');
  state.roomCode = null;
  state.room = null;
});

socket.on('promoted:host', () => {
  state.isHost = true;
  alert('You are now the host!');
  // Only update the UI for the screen we're currently on — never redirect mid-game
  const activeId = (document.querySelector('.screen.active') || {}).id;
  if (activeId === 'screen-lobby') {
    if (state.room) renderLobby(state.room);
  } else if (activeId === 'screen-reveal') {
    updateRevealControls();
  }
  // During writing phase the host has no special controls, so no action needed
});

socket.on('phase:story-creation', ({ room }) => {
  state.room = room;
  state.roomCode = room.code;
  state.charLimit = room.settings.charLimit;
  initStoryCreation();
});

socket.on('creation:progress', ({ submitted, total }) => {
  const label = document.getElementById('creation-waiting');
  if (!label.classList.contains('hidden')) {
    label.textContent = `Waiting for others… ${submitted}/${total} ready`;
  }
});

socket.on('phase:writing', (data) => {
  state.room = data.room;
  if (data.room.currentRound > 0) {
    showPotatoPass(() => initWriting(data));
  } else {
    initWriting(data);
  }
});

socket.on('writing:progress', ({ submitted, total }) => {
  document.getElementById('writing-submitted-count').textContent = `${submitted} / ${total} submitted`;
});

socket.on('phase:reveal:start', (data) => {
  state.room = data.room;
  initReveal(data);
});

socket.on('reveal:newStory', (data) => {
  onRevealNewStory(data);
});

socket.on('reveal:anchor', ({ type, value }) => {
  const elId   = type === 'setting' ? 'reveal-setting'        : 'reveal-subjects';
  const cardId = type === 'setting' ? 'reveal-anchor-setting' : 'reveal-anchor-subjects';
  document.getElementById(elId).textContent = value;
  // Small delay so the text sets before the transition fires
  setTimeout(() => document.getElementById(cardId).classList.add('anchor-visible'), 30);
  Sounds.pop();
});

socket.on('reveal:block', (data) => {
  onRevealBlock(data);
});

socket.on('reveal:end', (data) => {
  onRevealEnd(data);
});

socket.on('reaction:broadcast', ({ emoji }) => {
  spawnFloatingReaction(emoji);
});

// ─── Utilities ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
