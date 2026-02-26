const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ─── Game State ───────────────────────────────────────────────────────────────
const rooms = {}; // roomCode -> RoomState

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms[code]);
  return code;
}

function createRoom(hostName, hostId) {
  const code = generateRoomCode();
  rooms[code] = {
    code,
    host: hostId,
    players: [{ id: hostId, name: hostName, isHost: true }],
    phase: 'lobby',          // lobby | story-creation | writing | reveal
    settings: {
      charLimit: 200,
      roundsPerPlayer: 'auto', // 'auto' | number
      timerEnabled: false,
      timerSeconds: 90,
    },
    stories: [],             // { authorId, anchors:{setting,subjects}, blocks:[{authorId,authorName,text}] }
    currentRound: 0,
    totalRounds: 0,
    revealState: {
      storyIndex: 0,
      blockIndex: 0,
    },
    storyCreationSubmissions: new Set(),
    writingSubmissions: new Set(),
  };
  return rooms[code];
}

function getRoom(code) {
  return rooms[code] || null;
}

function getRoundsPerPlayer(playerCount, setting) {
  if (setting !== 'auto') return parseInt(setting, 10);
  if (playerCount === 1) return 5;
  if (playerCount === 2) return 3;
  if (playerCount === 3) return 3;
  if (playerCount <= 6) return 2;
  return 1;
}

function computeTotalRounds(playerCount, roundsPerPlayer) {
  return playerCount * roundsPerPlayer;
}

// Returns which story index a player should write in a given round
// Round 0 = initial writing on own story
// Round r = story offset by r positions
function getAssignedStoryIndex(playerIndex, round, totalPlayers) {
  return (playerIndex + round) % totalPlayers;
}

function safeRoomInfo(room) {
  return {
    code: room.code,
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
    phase: room.phase,
    settings: room.settings,
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
  };
}

// ─── Socket Handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // HOST: create a new room
  socket.on('host:create', ({ name }) => {
    if (!name || !name.trim()) return socket.emit('error', 'Name required');
    const room = createRoom(name.trim(), socket.id);
    socket.join(room.code);
    socket.emit('room:joined', { room: safeRoomInfo(room), playerId: socket.id, isHost: true });
  });

  // PLAYER: join existing room
  socket.on('player:join', ({ code, name }) => {
    const room = getRoom(code?.toUpperCase());
    if (!room) return socket.emit('error', 'Room not found');
    if (room.phase !== 'lobby') return socket.emit('error', 'Game already in progress');
    if (room.players.length >= 32) return socket.emit('error', 'Room is full (max 32)');
    if (!name || !name.trim()) return socket.emit('error', 'Name required');
    const trimmed = name.trim();
    if (room.players.find(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return socket.emit('error', 'Name already taken in this room');
    }
    room.players.push({ id: socket.id, name: trimmed, isHost: false });
    socket.join(room.code);
    socket.emit('room:joined', { room: safeRoomInfo(room), playerId: socket.id, isHost: false });
    io.to(room.code).emit('room:updated', safeRoomInfo(room));
  });

  // HOST: update settings
  socket.on('host:settings', ({ code, settings }) => {
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    room.settings = { ...room.settings, ...settings };
    io.to(room.code).emit('room:updated', safeRoomInfo(room));
  });

  // HOST: kick player
  socket.on('host:kick', ({ code, playerId }) => {
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    room.players = room.players.filter(p => p.id !== playerId);
    io.to(playerId).emit('kicked');
    io.to(room.code).emit('room:updated', safeRoomInfo(room));
  });

  // HOST: start game → go to story-creation phase
  socket.on('host:start', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    if (room.players.length < 1) return socket.emit('error', 'Need at least 1 player');

    const n = room.players.length;
    const roundsPerPlayer = getRoundsPerPlayer(n, room.settings.roundsPerPlayer);
    room.totalRounds = computeTotalRounds(n, roundsPerPlayer);
    room.currentRound = 0;
    room.phase = 'story-creation';
    room.storyCreationSubmissions = new Set();
    room.stories = [];

    io.to(room.code).emit('phase:story-creation', {
      room: safeRoomInfo(room),
      roundsPerPlayer,
    });
  });

  // PLAYER: submit story anchors
  socket.on('player:submitAnchors', ({ code, setting, subjects }) => {
    const room = getRoom(code);
    if (!room || room.phase !== 'story-creation') return;
    if (room.storyCreationSubmissions.has(socket.id)) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    room.stories.push({
      authorId: socket.id,
      authorName: player.name,
      anchors: { setting: setting.trim(), subjects: subjects.trim() },
      blocks: [],
    });
    room.storyCreationSubmissions.add(socket.id);

    // Progress bar for everyone
    io.to(room.code).emit('creation:progress', {
      submitted: room.storyCreationSubmissions.size,
      total: room.players.length,
    });

    // If all players submitted anchors, start round 1
    if (room.storyCreationSubmissions.size === room.players.length) {
      startWritingRound(room);
    }
  });

  // PLAYER: submit writing block
  socket.on('player:submitBlock', ({ code, text }) => {
    const room = getRoom(code);
    if (!room || room.phase !== 'writing') return;
    if (room.writingSubmissions.has(socket.id)) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;
    const player = room.players[playerIndex];

    const storyIndex = getAssignedStoryIndex(playerIndex, room.currentRound, room.players.length);
    const story = room.stories[storyIndex];
    if (!story) return;

    const trimmed = (text || '').trim().slice(0, room.settings.charLimit);
    if (!trimmed) return;

    story.blocks.push({ authorId: socket.id, authorName: player.name, text: trimmed });
    room.writingSubmissions.add(socket.id);

    io.to(room.code).emit('writing:progress', {
      submitted: room.writingSubmissions.size,
      total: room.players.length,
    });

    if (room.writingSubmissions.size === room.players.length) {
      room.currentRound++;
      if (room.currentRound >= room.totalRounds) {
        startReveal(room);
      } else {
        startWritingRound(room);
      }
    }
  });

  // HOST: advance reveal
  socket.on('host:revealNext', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.host !== socket.id || room.phase !== 'reveal') return;
    advanceReveal(room);
  });

  // HOST: restart game to lobby
  socket.on('host:restart', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    room.phase = 'lobby';
    room.stories = [];
    room.currentRound = 0;
    room.totalRounds = 0;
    room.storyCreationSubmissions = new Set();
    room.writingSubmissions = new Set();
    room.revealState = { storyIndex: 0, blockIndex: 0 };
    io.to(room.code).emit('phase:lobby', safeRoomInfo(room));
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;

      const wasHost = room.players[idx].isHost;
      room.players.splice(idx, 1);

      if (room.players.length === 0) {
        delete rooms[code];
        break;
      }

      if (wasHost) {
        // Transfer host to next player
        room.players[0].isHost = true;
        room.host = room.players[0].id;
        io.to(room.players[0].id).emit('promoted:host');
      }

      io.to(code).emit('room:updated', safeRoomInfo(room));

      // If in writing phase and disconnected player was the last needed, advance
      if (room.phase === 'writing' && !room.writingSubmissions.has(socket.id)) {
        // Add a placeholder so the count can match
        room.writingSubmissions.add(socket.id);
        if (room.writingSubmissions.size >= room.players.length + 1) {
          room.currentRound++;
          if (room.currentRound >= room.totalRounds) {
            startReveal(room);
          } else {
            startWritingRound(room);
          }
        }
      }
      break;
    }
  });
});

// ─── Phase Helpers ────────────────────────────────────────────────────────────
function startWritingRound(room) {
  room.phase = 'writing';
  room.writingSubmissions = new Set();

  // Build per-player assignments
  const assignments = room.players.map((player, playerIndex) => {
    const storyIndex = getAssignedStoryIndex(playerIndex, room.currentRound, room.players.length);
    const story = room.stories[storyIndex];
    const previousBlock = [...story.blocks].reverse().find(b => b.text !== '…') ?? null;
    return {
      playerId: player.id,
      storyIndex,
      anchors: story.anchors,
      previousBlock: previousBlock ? { text: previousBlock.text, authorName: previousBlock.authorName } : null,
      isFirstBlock: story.blocks.length === 0,
    };
  });

  // Send each player their own assignment
  for (const assignment of assignments) {
    io.to(assignment.playerId).emit('phase:writing', {
      room: safeRoomInfo(room),
      assignment,
    });
  }
}

function startReveal(room) {
  room.phase = 'reveal';
  room.revealState = { storyIndex: 0, blockIndex: -1 };
  io.to(room.code).emit('phase:reveal:start', {
    room: safeRoomInfo(room),
    totalStories: room.stories.length,
  });
  advanceReveal(room);
}

function advanceReveal(room) {
  const { storyIndex, blockIndex } = room.revealState;
  const story = room.stories[storyIndex];

  if (!story) return;

  const nextBlockIndex = blockIndex + 1;

  if (nextBlockIndex <= story.blocks.length - 1) {
    // Reveal next block of current story
    room.revealState.blockIndex = nextBlockIndex;
    io.to(room.code).emit('reveal:block', {
      storyIndex,
      blockIndex: nextBlockIndex,
      totalBlocks: story.blocks.length,
      isLastBlock: nextBlockIndex === story.blocks.length - 1,
      block: story.blocks[nextBlockIndex],
      anchors: story.anchors,
      authorName: story.authorName,
    });
  } else {
    // Move to next story or end
    const nextStoryIndex = storyIndex + 1;
    if (nextStoryIndex < room.stories.length) {
      room.revealState = { storyIndex: nextStoryIndex, blockIndex: -1 };
      io.to(room.code).emit('reveal:newStory', {
        storyIndex: nextStoryIndex,
        totalStories: room.stories.length,
        anchors: room.stories[nextStoryIndex].anchors,
        authorName: room.stories[nextStoryIndex].authorName,
      });
      // Immediately reveal first block
      advanceReveal(room);
    } else {
      io.to(room.code).emit('reveal:end', {
        stories: room.stories.map(s => ({
          authorName: s.authorName,
          anchors: s.anchors,
          blocks: s.blocks,
        })),
      });
    }
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Plot Potato server running on http://localhost:${PORT}`);
});
