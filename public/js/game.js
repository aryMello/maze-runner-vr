// Configuration - CHANGE THIS TO YOUR RAILWAY SERVER URL
//const SERVER_URL = window.location.origin; 
// For local development: 
const SERVER_URL = 'http://localhost:3000';

// Socket.io connection
let socket;

// Game State
const gameState = {
  room: null,
  players: {},
  myPlayerId: null,
  myPlayerName: null,
  maze: [],
  treasures: [],
  myTreasureCount: 0,
  gameStarted: false,
  startTime: null,
  isReady: false,
  playerPositions: [
    { x: -20, z: -20 },
    { x: 20, z: -20 },
    { x: -20, z: 20 },
    { x: 20, z: 20 }
  ]
};

// Player colors
const playerColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF'];

// Sound management
let footstepSound, collectSound, ambientSound, winSound;
let lastMoveTime = 0;
const footstepInterval = 500; // milliseconds between footsteps

// Initialize Socket.io connection
function initSocket() {
  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus('connected');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus('disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    updateConnectionStatus('disconnected');
  });

  // Room created
  socket.on('roomCreated', (data) => {
    gameState.room = data.roomCode;
    gameState.myPlayerId = data.playerId;
    showWaitingRoom(data.roomCode);
  });

  // Room joined
  socket.on('roomJoined', (data) => {
    gameState.room = data.roomCode;
    gameState.myPlayerId = data.playerId;
    gameState.players = data.players;
    showWaitingRoom(data.roomCode);
    updatePlayerList();
  });

  // Room error
  socket.on('roomError', (data) => {
    alert(data.message);
  });

  // Player joined
  socket.on('playerJoined', (data) => {
    gameState.players = data.players;
    updatePlayerList();
  });

  // Player left
  socket.on('playerLeft', (data) => {
    gameState.players = data.players;
    updatePlayerList();
    if (gameState.gameStarted) {
      removePlayerEntity(data.playerId);
      updateLeaderboard();
    }
  });

  // Player ready status
  socket.on('playerReady', (data) => {
    gameState.players = data.players;
    updatePlayerList();
  });

  // Game starting
  socket.on('gameStarting', (data) => {
    gameState.maze = data.maze;
    gameState.treasures = data.treasures;
    gameState.players = data.players;
    document.getElementById('lobby').classList.add('hidden');
    initGame();
  });

  // Player moved
  socket.on('playerMoved', (data) => {
    if (gameState.players[data.playerId]) {
      gameState.players[data.playerId].x = data.x;
      gameState.players[data.playerId].z = data.z;
      gameState.players[data.playerId].direction = data.direction;
      updatePlayerEntity(data.playerId);
    }
  });

  // Treasure collected
  socket.on('treasureCollected', (data) => {
    const treasure = gameState.treasures.find(t => t.id === data.treasureId);
    if (treasure) {
      treasure.collected = true;
      treasure.collectedBy = data.playerId;
      removeTreasureEntity(data.treasureId);
      
      // Play collect sound
      if (collectSound) {
        collectSound.components.sound.playSound();
      }
    }
    
    if (data.playerId === gameState.myPlayerId) {
      gameState.myTreasureCount++;
      document.getElementById('treasureCount').textContent = gameState.myTreasureCount;
    }
    
    if (gameState.players[data.playerId]) {
      gameState.players[data.playerId].treasures = data.treasures;
    }
    
    updateLeaderboard();
  });

  // Game won
  socket.on('gameWon', (data) => {
    // Play win sound
    if (winSound) {
      winSound.components.sound.playSound();
    }
    
    setTimeout(() => {
      if (data.playerId === gameState.myPlayerId) {
        alert('🎉 VOCE GANHOU! Conseguiu coletar todos os tesouros primiero!');
      } else {
        const winner = gameState.players[data.playerId];
        alert(`🏆 ${winner.name} ganhou! Eles coletaram todos os tesouros primeiro!`);
      }
    }, 500);
  });
}

// Update connection status indicator
function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connectionStatus');
  statusEl.className = `status-${status}`;
  statusEl.textContent = status === 'connected' ? '🟢 Connected' : 
                        status === 'disconnected' ? '🔴 Disconnected' : '🟡 Connecting...';
}

// Show waiting room
function showWaitingRoom(roomCode) {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('waitingScreen').style.display = 'block';
  document.getElementById('currentRoom').textContent = `Codigo da sala: ${roomCode}`;
  document.getElementById('playerName').textContent = gameState.myPlayerName;
}

// Update player list in lobby
function updatePlayerList() {
  const listEl = document.getElementById('playerList');
  listEl.innerHTML = '<h3>Jogadores na sala:</h3>';
  
  const playerArray = Object.values(gameState.players);
  playerArray.forEach((player, idx) => {
    const item = document.createElement('div');
    item.className = 'player-item';
    item.style.borderLeft = `5px solid ${playerColors[idx % playerColors.length]}`;
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = player.name;
    item.appendChild(nameSpan);
    
    if (player.ready) {
      const readySpan = document.createElement('span');
      readySpan.className = 'player-ready';
      readySpan.textContent = '✓ READY';
      item.appendChild(readySpan);
    }
    
    listEl.appendChild(item);
  });
}

// Update leaderboard
function updateLeaderboard() {
  const listEl = document.getElementById('leaderboardList');
  listEl.innerHTML = '';
  
  const playerArray = Object.values(gameState.players)
    .sort((a, b) => (b.treasures || 0) - (a.treasures || 0));
  
  playerArray.forEach((player, idx) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    
    const rank = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${rank} ${player.name}`;
    
    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = `${player.treasures || 0}/5`;
    scoreSpan.style.color = playerColors[playerArray.indexOf(player) % playerColors.length];
    
    item.appendChild(nameSpan);
    item.appendChild(scoreSpan);
    listEl.appendChild(item);
  });
}

// Render maze
function renderMaze() {
  const mazeContainer = document.getElementById('maze');
  mazeContainer.innerHTML = '';
  
  gameState.maze.forEach((wall) => {
    const wallEl = document.createElement('a-box');
    wallEl.setAttribute('position', `${wall.x} 1.5 ${wall.z}`);
    wallEl.setAttribute('width', '2');
    wallEl.setAttribute('height', '3');
    wallEl.setAttribute('depth', '2');
    wallEl.setAttribute('src', '#wall-texture');
    wallEl.setAttribute('shadow', 'cast: true; receive: true');
    wallEl.setAttribute('class', 'wall');
    mazeContainer.appendChild(wallEl);
  });
}

// Render treasures
function renderTreasures() {
  const treasuresContainer = document.getElementById('treasures');
  treasuresContainer.innerHTML = '';
  
  gameState.treasures.forEach(treasure => {
    if (!treasure.collected) {
      const treasureEl = document.createElement('a-octahedron');
      treasureEl.setAttribute('id', `treasure-${treasure.id}`);
      treasureEl.setAttribute('position', `${treasure.x} 1 ${treasure.z}`);
      treasureEl.setAttribute('radius', '0.5');
      treasureEl.setAttribute('color', '#FFD700');
      treasureEl.setAttribute('metalness', '0.8');
      treasureEl.setAttribute('roughness', '0.2');
      treasureEl.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 3000; easing: linear');
      treasureEl.setAttribute('animation__hover', `property: position; to: ${treasure.x} 1.5 ${treasure.z}; dir: alternate; loop: true; dur: 1000; easing: easeInOutSine`);
      treasureEl.setAttribute('class', 'treasure');
      treasureEl.setAttribute('shadow', 'cast: true');
      treasuresContainer.appendChild(treasureEl);
    }
  });
}

// Remove treasure entity
function removeTreasureEntity(treasureId) {
  const treasureEl = document.getElementById(`treasure-${treasureId}`);
  if (treasureEl) {
    treasureEl.parentNode.removeChild(treasureEl);
  }
}

// Create/update player entities
function updatePlayerEntities() {
  const playerArray = Object.values(gameState.players);
  playerArray.forEach((player, idx) => {
    updatePlayerEntity(player.id, idx);
  });
}

function updatePlayerEntity(playerId, colorIdx) {
  const player = gameState.players[playerId];
  if (!player) return;
  
  const playersContainer = document.getElementById('players');
  let playerEl = document.getElementById(`player-${playerId}`);
  
  if (!playerEl) {
    const playerArray = Object.keys(gameState.players);
    const idx = colorIdx !== undefined ? colorIdx : playerArray.indexOf(playerId);
    
    playerEl = document.createElement('a-entity');
    playerEl.setAttribute('id', `player-${playerId}`);
    
    // Player body
    const body = document.createElement('a-cylinder');
    body.setAttribute('radius', '0.5');
    body.setAttribute('height', '1.6');
    body.setAttribute('color', playerColors[idx % playerColors.length]);
    body.setAttribute('metalness', '0.3');
    body.setAttribute('roughness', '0.7');
    body.setAttribute('shadow', 'cast: true');
    playerEl.appendChild(body);
    
    // Player head
    const head = document.createElement('a-sphere');
    head.setAttribute('radius', '0.3');
    head.setAttribute('position', '0 1.1 0');
    head.setAttribute('color', playerColors[idx % playerColors.length]);
    head.setAttribute('metalness', '0.3');
    head.setAttribute('roughness', '0.7');
    playerEl.appendChild(head);
    
    // Player label
    const label = document.createElement('a-text');
    label.setAttribute('value', player.name);
    label.setAttribute('align', 'center');
    label.setAttribute('position', '0 2.5 0');
    label.setAttribute('scale', '2 2 2');
    label.setAttribute('color', '#FFFFFF');
    label.setAttribute('shader', 'msdf');
    playerEl.appendChild(label);
    
    playersContainer.appendChild(playerEl);
  }
  
  playerEl.setAttribute('position', `${player.x} 0.8 ${player.z}`);
  
  if (player.direction) {
    const rotations = { north: 0, east: 90, south: 180, west: 270 };
    playerEl.setAttribute('rotation', `0 ${rotations[player.direction] || 0} 0`);
  }
}

function removePlayerEntity(playerId) {
  const playerEl = document.getElementById(`player-${playerId}`);
  if (playerEl) {
    playerEl.parentNode.removeChild(playerEl);
  }
}

// Check collision with walls
function checkWallCollision(x, z) {
  const playerRadius = 0.5;
  return gameState.maze.some(wall => {
    const dx = Math.abs(x - wall.x);
    const dz = Math.abs(z - wall.z);
    return dx < (1 + playerRadius) && dz < (1 + playerRadius);
  });
}

// Check treasure collection
function checkTreasureCollection(x, z) {
  const collectRadius = 1.5;
  gameState.treasures.forEach(treasure => {
    if (!treasure.collected) {
      const dx = Math.abs(x - treasure.x);
      const dz = Math.abs(z - treasure.z);
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < collectRadius) {
        socket.emit('collectTreasure', {
          roomCode: gameState.room,
          treasureId: treasure.id
        });
      }
    }
  });
}

// Play footstep sound
function playFootstep() {
  const currentTime = Date.now();
  if (currentTime - lastMoveTime > footstepInterval && footstepSound) {
    footstepSound.components.sound.playSound();
    lastMoveTime = currentTime;
  }
}

// Movement
const moveSpeed = 2;

function movePlayer(direction) {
  if (!gameState.gameStarted) return;
  
  const player = gameState.players[gameState.myPlayerId];
  if (!player) return;
  
  let newX = player.x;
  let newZ = player.z;
  
  switch(direction) {
    case 'north': newZ -= moveSpeed; break;
    case 'south': newZ += moveSpeed; break;
    case 'west': newX -= moveSpeed; break;
    case 'east': newX += moveSpeed; break;
  }
  
  if (!checkWallCollision(newX, newZ)) {
    socket.emit('movePlayer', {
      roomCode: gameState.room,
      x: newX,
      z: newZ,
      direction: direction
    });
    
    // Play footstep sound
    playFootstep();
    
    checkTreasureCollection(newX, newZ);
  }
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (!gameState.gameStarted) return;
  
  switch(e.key) {
    case 'w':
    case 'W':
    case 'ArrowUp':
      movePlayer('north');
      e.preventDefault();
      break;
    case 's':
    case 'S':
    case 'ArrowDown':
      movePlayer('south');
      e.preventDefault();
      break;
    case 'a':
    case 'A':
    case 'ArrowLeft':
      movePlayer('west');
      e.preventDefault();
      break;
    case 'd':
    case 'D':
    case 'ArrowRight':
      movePlayer('east');
      e.preventDefault();
      break;
  }
});

// Timer
function startTimer() {
  setInterval(() => {
    if (gameState.gameStarted && gameState.startTime) {
      const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      document.getElementById('timer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

// Countdown
function startCountdown() {
  const countdownEl = document.getElementById('countdown');
  let count = 3;
  
  countdownEl.style.display = 'block';
  countdownEl.textContent = count;
  
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
    } else if (count === 0) {
      countdownEl.textContent = 'GO!';
    } else {
      countdownEl.style.display = 'none';
      clearInterval(interval);
      gameState.gameStarted = true;
      gameState.startTime = Date.now();
    }
  }, 1000);
}

// Initialize game
function initGame() {
  renderMaze();
  renderTreasures();
  updatePlayerEntities();
  updateLeaderboard();
  
  // Initialize sound references
  footstepSound = document.querySelector('#footstep-sound');
  collectSound = document.querySelector('#collect-sound');
  winSound = document.querySelector('#win-sound');
  
  startCountdown();
  startTimer();
}

// UI Event Listeners
document.getElementById('continueBtn').addEventListener('click', () => {
  const name = document.getElementById('playerNameInput').value.trim();
  if (!name) {
    alert('Please enter your name');
    return;
  }
  gameState.myPlayerName = name;
  document.getElementById('nameScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'block';
});

document.getElementById('createBtn').addEventListener('click', () => {
  socket.emit('createRoom', { playerName: gameState.myPlayerName });
});

document.getElementById('joinBtn').addEventListener('click', () => {
  const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  socket.emit('joinRoom', { 
    roomCode: roomCode,
    playerName: gameState.myPlayerName 
  });
});

document.getElementById('readyBtn').addEventListener('click', () => {
  gameState.isReady = !gameState.isReady;
  socket.emit('playerReady', { 
    roomCode: gameState.room,
    ready: gameState.isReady
  });
  document.getElementById('readyBtn').textContent = gameState.isReady ? 'Not Ready' : 'Ready';
  document.getElementById('readyBtn').style.background = gameState.isReady ? 
    '#FF9800' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
});

document.getElementById('leaveBtn').addEventListener('click', () => {
  socket.emit('leaveRoom', { roomCode: gameState.room });
  location.reload();
});

// Initialize on page load
window.addEventListener('load', () => {
  initSocket();
  
  // Wait for A-Frame to load
  const scene = document.querySelector('a-scene');
  if (scene.hasLoaded) {
    console.log('A-Frame scene loaded');
  } else {
    scene.addEventListener('loaded', () => {
      console.log('A-Frame scene loaded');
    });
  }
});