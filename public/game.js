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
};

// ─── Quick Fill Presets ───────────────────────────────────────────────────────
const SETTING_PRESETS = [
  'A haunted grocery store', 'The surface of Mars', 'A fancy restaurant at 3am',
  'Inside a broken elevator', 'A submarine deep in the Pacific', 'A medieval DMV office',
  'A space station cafeteria', 'An enchanted forest at rush hour',
];

const SUBJECT_PRESETS = [
  'A dog named Bucky', 'A nervous robot', 'The office printer', 'Two rival grandmothers',
  'A wizard who lost their glasses', 'A sentient houseplant', 'An overly confident hamster',
  'A time-traveling barista',
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

// ─── Host Setup ───────────────────────────────────────────────────────────────
document.getElementById('btn-create-room').addEventListener('click', () => {
  const name = document.getElementById('host-name').value.trim();
  if (!name) return showError('host-error', 'Please enter your name.');
  clearError('host-error');
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
function initStoryCreation() {
  renderPresets('setting-presets', SETTING_PRESETS, 'anchor-setting');
  renderPresets('subject-presets', SUBJECT_PRESETS, 'anchor-subjects');

  document.getElementById('anchor-setting').value = '';
  document.getElementById('anchor-subjects').value = '';
  document.getElementById('btn-submit-anchors').disabled = false;
  document.getElementById('creation-waiting').classList.add('hidden');
  document.getElementById('creation-waiting').textContent = '';

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
      document.getElementById(targetInputId).value = text;
    });
    container.appendChild(btn);
  });
}

document.getElementById('btn-submit-anchors').addEventListener('click', () => {
  const setting = document.getElementById('anchor-setting').value.trim();
  const subjects = document.getElementById('anchor-subjects').value.trim();
  if (!setting) return alert('Please enter a setting.');
  if (!subjects) return alert('Please enter subject(s).');

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
    document.getElementById('writing-prev-author').textContent = `Written by ${assignment.previousBlock.authorName}`;
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
    startTimer(room.settings.timerSeconds);
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
  document.getElementById('btn-submit-block').disabled = true;
  writingTextarea.disabled = true;
  clearTimer();

  document.getElementById('writing-submitted').classList.remove('hidden');
  document.getElementById('writing-submitted-count').textContent = '';
  socket.emit('player:submitBlock', { code: state.roomCode, text });
}

function startTimer(seconds) {
  const barWrap = document.getElementById('timer-bar-wrap');
  const bar = document.getElementById('timer-bar');
  const label = document.getElementById('timer-label');
  barWrap.classList.remove('hidden');
  state.timerSecondsLeft = seconds;

  function tick() {
    const pct = (state.timerSecondsLeft / seconds) * 100;
    bar.style.setProperty('--progress', pct + '%');
    const m = Math.floor(state.timerSecondsLeft / 60);
    const s = state.timerSecondsLeft % 60;
    label.textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (state.timerSecondsLeft <= 0) {
      clearTimer();
      submitBlock();
      return;
    }
    state.timerSecondsLeft--;
  }
  tick();
  state.timerInterval = setInterval(tick, 1000);
}

function clearTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
}

// ─── Reveal Phase ─────────────────────────────────────────────────────────────
function initReveal(data) {
  state.revealedBlocks = [];
  document.getElementById('reveal-story-blocks').innerHTML = '';
  document.getElementById('reveal-end').classList.add('hidden');
  document.getElementById('full-read-modal').classList.add('hidden');

  const counter = document.getElementById('reveal-story-counter');
  counter.textContent = `Story 1 of ${data.totalStories}`;
  document.getElementById('reveal-story-title').textContent = 'Story Time!';
  document.getElementById('reveal-setting').textContent = '…';
  document.getElementById('reveal-subjects').textContent = '…';

  updateRevealControls();
  showScreen('screen-reveal');
}

function onRevealNewStory(data) {
  const { storyIndex, totalStories, anchors, authorName } = data;
  document.getElementById('reveal-story-counter').textContent = `Story ${storyIndex + 1} of ${totalStories}`;
  document.getElementById('reveal-story-title').textContent = `${authorName}'s Story`;
  document.getElementById('reveal-setting').textContent = anchors.setting;
  document.getElementById('reveal-subjects').textContent = anchors.subjects;
  const blocksEl = document.getElementById('reveal-story-blocks');
  blocksEl.innerHTML = '';
  blocksEl.classList.remove('authors-revealed');
}

function onRevealBlock(data) {
  const { block, blockIndex } = data;
  const container = document.getElementById('reveal-story-blocks');
  const el = document.createElement('div');
  el.className = `story-block${blockIndex === 0 ? ' first-block' : ''}`;
  el.innerHTML = `
    <div class="block-author">${escHtml(block.authorName)}</div>
    <div class="block-text">${escHtml(block.text)}</div>
  `;
  container.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function onRevealEnd(data) {
  document.getElementById('reveal-story-blocks').classList.add('authors-revealed');
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
  if (state.room) renderLobby(state.room);
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
  initWriting(data);
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

socket.on('reveal:block', (data) => {
  onRevealBlock(data);
});

socket.on('reveal:end', (data) => {
  onRevealEnd(data);
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
