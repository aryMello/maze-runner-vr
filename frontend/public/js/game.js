// Configuration - WebSocket URL
const SERVER_URL = 'http://localhost:3001';
const WS_PATH = '/ws';
const IS_LOCAL = true;

// Socket.io connection
let socket;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 10;

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
  cellSize: 1
};

// Player colors
const playerColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF'];

// Sound management
let footstepSound, collectSound, ambientSound, winSound;
let lastMoveTime = 0;
const footstepInterval = 500;

// Initialize Socket.io connection
function initSocket() {
  socket = io(SERVER_URL, {
    path: WS_PATH,
    transports: ['websocket', 'polling'],
    secure: !IS_LOCAL,
    rejectUnauthorized: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
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
  socket.on('room_created', (data) => {
    console.log('Room created:', data);
    gameState.room = data.payload.code;
    gameState.myPlayerId = data.payload.room.host;
    
    if (data.payload.room) {
      gameState.maze = data.payload.room.maze;
      gameState.treasures = data.payload.room.treasures;
      gameState.players = data.payload.room.players;
    }
    
    showWaitingRoom(data.payload.code);
    updatePlayerList();
  });

  // Room joined
  socket.on('room_joined', (data) => {
    console.log('Room joined:', data);
    gameState.room = data.roomCode || data.code;
    gameState.myPlayerId = data.playerId;
    gameState.players = data.players;
    
    if (data.maze) gameState.maze = data.maze;
    if (data.treasures) gameState.treasures = data.treasures;
    
    showWaitingRoom(gameState.room);
    updatePlayerList();
  });

  // Room error
  socket.on('room_error', (data) => {
    alert(data.message || 'Erro ao entrar na sala');
  });

  // Player joined
  socket.on('player_joined', (data) => {
    console.log('Player joined:', data);
    if (data.players) {
      gameState.players = data.players;
    } else if (data.player) {
      gameState.players[data.player.id] = data.player;
    }
    updatePlayerList();
  });

  // Player left
  socket.on('player_left', (data) => {
    console.log('Player left:', data);
    if (data.players) {
      gameState.players = data.players;
    } else if (data.playerId) {
      delete gameState.players[data.playerId];
    }
    updatePlayerList();
    if (gameState.gameStarted) {
      removePlayerEntity(data.playerId);
      updateLeaderboard();
    }
  });

  // Player ready status
  socket.on('player_ready', (data) => {
    console.log('Player ready:', data);
    if (data.players) {
      gameState.players = data.players;
    } else if (data.playerId && gameState.players[data.playerId]) {
      gameState.players[data.playerId].ready = data.ready;
    }
    updatePlayerList();
  });

  // Game starting
  socket.on('game_starting', (data) => {
    console.log('Game starting:', data);
    gameState.maze = data.maze;
    gameState.treasures = data.treasures;
    gameState.players = data.players;
    document.getElementById('lobby').classList.add('hidden');
    initGame();
  });

  // Player moved
  socket.on('player_moved', (data) => {
    if (gameState.players[data.playerId]) {
      gameState.players[data.playerId].x = data.x;
      gameState.players[data.playerId].z = data.z;
      gameState.players[data.playerId].direction = data.direction;
      updatePlayerEntity(data.playerId);
    }
  });

  // Treasure collected
  socket.on('treasure_collected', (data) => {
    console.log('Treasure collected:', data);
    handleTreasureCollection(data);
  });

  // Game won
  socket.on('game_won', (data) => {
    console.log('Game won:', data);
    handleGameWon(data);
  });
}

// Handle treasure collection
function handleTreasureCollection(data) {
  const treasure = gameState.treasures.find(t => t.id === data.treasureId);
  if (treasure) {
    treasure.collected = true;
    treasure.collectedBy = data.playerId;
    
    // Remove visual do tesouro
    removeTreasureEntity(data.treasureId);
    
    // Toca som de coleta
    if (collectSound && collectSound.components && collectSound.components.sound) {
      try {
        collectSound.components.sound.playSound();
      } catch (e) {
        console.log('Collect sound not available');
      }
    }
    
    // Atualiza contadores
    if (data.playerId === gameState.myPlayerId) {
      gameState.myTreasureCount++;
      const totalTreasures = gameState.treasures.length;
      document.getElementById('treasureCount').textContent = `${gameState.myTreasureCount}/${totalTreasures}`;
      
      // Feedback visual para o jogador
      showCollectionFeedback();
    }
    
    // Atualiza dados do jogador
    if (gameState.players[data.playerId]) {
      if (data.treasures !== undefined) {
        gameState.players[data.playerId].treasures = data.treasures;
      } else {
        gameState.players[data.playerId].treasures = (gameState.players[data.playerId].treasures || 0) + 1;
      }
    }
    
    updateLeaderboard();
  }
}

// Show collection feedback
function showCollectionFeedback() {
  const feedback = document.createElement('div');
  feedback.style.position = 'fixed';
  feedback.style.top = '50%';
  feedback.style.left = '50%';
  feedback.style.transform = 'translate(-50%, -50%)';
  feedback.style.fontSize = '48px';
  feedback.style.color = '#FFD700';
  feedback.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
  feedback.style.animation = 'collectFeedback 1s ease-out';
  feedback.style.pointerEvents = 'none';
  feedback.style.zIndex = '10000';
  feedback.textContent = '💎 +1 Tesouro!';
  
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    document.body.removeChild(feedback);
  }, 1000);
}

// Handle game won
function handleGameWon(data) {
  if (winSound && winSound.components && winSound.components.sound) {
    try {
      winSound.components.sound.playSound();
    } catch (e) {
      console.log('Win sound not available');
    }
  }
  
  gameState.gameStarted = false;
  
  setTimeout(() => {
    if (data.playerId === gameState.myPlayerId) {
      showWinScreen('Você Ganhou!', '🎉 Parabéns! Você coletou todos os tesouros primeiro!');
    } else {
      const winner = gameState.players[data.playerId];
      const winnerName = winner ? winner.name : 'Jogador';
      showWinScreen(`${winnerName} Ganhou!`, `🏆 ${winnerName} coletou todos os tesouros primeiro!`);
    }
  }, 500);
}

// Show win screen
function showWinScreen(title, message) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0, 0, 0, 0.8)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '10000';
  overlay.style.animation = 'fadeIn 0.5s ease-in';
  
  const titleEl = document.createElement('h1');
  titleEl.textContent = title;
  titleEl.style.fontSize = '64px';
  titleEl.style.color = '#FFD700';
  titleEl.style.textShadow = '0 0 30px rgba(255, 215, 0, 0.8)';
  titleEl.style.marginBottom = '20px';
  titleEl.style.animation = 'bounceIn 1s ease-out';
  
  const messageEl = document.createElement('p');
  messageEl.textContent = message;
  messageEl.style.fontSize = '24px';
  messageEl.style.color = '#fff';
  messageEl.style.marginBottom = '30px';
  
  const backBtn = document.createElement('button');
  backBtn.textContent = 'Voltar ao Lobby';
  backBtn.style.padding = '15px 30px';
  backBtn.style.fontSize = '18px';
  backBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  backBtn.style.border = 'none';
  backBtn.style.borderRadius = '10px';
  backBtn.style.color = 'white';
  backBtn.style.cursor = 'pointer';
  backBtn.onclick = () => location.reload();
  
  overlay.appendChild(titleEl);
  overlay.appendChild(messageEl);
  overlay.appendChild(backBtn);
  document.body.appendChild(overlay);
}

// Update connection status indicator
function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  
  statusEl.className = `status-${status}`;
  const modeLabel = IS_LOCAL ? ' (Local)' : ' (Remoto)';
  statusEl.textContent = status === 'connected' ? `🟢 Conectado${modeLabel}` : 
                        status === 'disconnected' ? `🔴 Desconectado${modeLabel}` : 
                        `🟡 Conectando...${modeLabel}`;
}

// Show waiting room
function showWaitingRoom(roomCode) {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('waitingScreen').style.display = 'block';
  document.getElementById('currentRoom').textContent = `Código da sala: ${roomCode}`;
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
      readySpan.textContent = '✓ PRONTO';
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
    const totalTreasures = gameState.treasures.length;
    scoreSpan.textContent = `${player.treasures || 0}/${totalTreasures}`;
    scoreSpan.style.color = playerColors[playerArray.indexOf(player) % playerColors.length];
    
    item.appendChild(nameSpan);
    item.appendChild(scoreSpan);
    listEl.appendChild(item);
  });
}

// Convert maze to walls
function convertMazeToWalls(mazeGrid) {
  const walls = [];
  const cellSize = gameState.cellSize;
  
  for (let row = 0; row < mazeGrid.length; row++) {
    for (let col = 0; col < mazeGrid[row].length; col++) {
      if (mazeGrid[row][col] === 1) {
        const offsetX = (mazeGrid[0].length * cellSize) / 2;
        const offsetZ = (mazeGrid.length * cellSize) / 2;
        
        walls.push({
          x: (col * cellSize) - offsetX + (cellSize / 2),
          z: (row * cellSize) - offsetZ + (cellSize / 2)
        });
      }
    }
  }
  
  return walls;
}

// Render maze
function renderMaze() {
  const mazeContainer = document.getElementById('maze');
  mazeContainer.innerHTML = '';
  
  if (!gameState.maze || gameState.maze.length === 0) {
    console.warn('Maze não carregado ainda');
    return;
  }
  
  const walls = convertMazeToWalls(gameState.maze);
  
  walls.forEach((wall) => {
    const wallEl = document.createElement('a-box');
    wallEl.setAttribute('position', `${wall.x} 1.5 ${wall.z}`);
    wallEl.setAttribute('width', gameState.cellSize.toString());
    wallEl.setAttribute('height', '3');
    wallEl.setAttribute('depth', gameState.cellSize.toString());
    wallEl.setAttribute('src', '#wall-texture');
    wallEl.setAttribute('shadow', 'cast: true; receive: true');
    wallEl.setAttribute('class', 'wall');
    mazeContainer.appendChild(wallEl);
  });
  
  console.log(`Renderizadas ${walls.length} paredes`);
}

// Render treasures
function renderTreasures() {
  const treasuresContainer = document.getElementById('treasures');
  treasuresContainer.innerHTML = '';
  
  if (!gameState.treasures || gameState.treasures.length === 0) {
    console.warn('Tesouros não carregados ainda');
    return;
  }
  
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
  
  console.log(`Renderizados ${gameState.treasures.filter(t => !t.collected).length} tesouros`);
}

// Remove treasure entity
function removeTreasureEntity(treasureId) {
  const treasureEl = document.getElementById(`treasure-${treasureId}`);
  if (treasureEl) {
    // Animação de coleta
    treasureEl.setAttribute('animation__collect', 'property: scale; to: 0 0 0; dur: 300; easing: easeInBack');
    treasureEl.setAttribute('animation__spin', 'property: rotation; to: 0 720 0; dur: 300; easing: easeInBack');
    
    setTimeout(() => {
      treasureEl.parentNode.removeChild(treasureEl);
    }, 300);
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
    
    const body = document.createElement('a-cylinder');
    body.setAttribute('radius', '0.3');
    body.setAttribute('height', '1.6');
    body.setAttribute('color', playerColors[idx % playerColors.length]);
    body.setAttribute('metalness', '0.3');
    body.setAttribute('roughness', '0.7');
    body.setAttribute('shadow', 'cast: true');
    playerEl.appendChild(body);
    
    const head = document.createElement('a-sphere');
    head.setAttribute('radius', '0.25');
    head.setAttribute('position', '0 1.1 0');
    head.setAttribute('color', playerColors[idx % playerColors.length]);
    head.setAttribute('metalness', '0.3');
    head.setAttribute('roughness', '0.7');
    playerEl.appendChild(head);
    
    const label = document.createElement('a-text');
    label.setAttribute('value', player.name);
    label.setAttribute('align', 'center');
    label.setAttribute('position', '0 2.2 0');
    label.setAttribute('scale', '1.5 1.5 1.5');
    label.setAttribute('color', '#FFFFFF');
    label.setAttribute('shader', 'msdf');
    playerEl.appendChild(label);
    
    playersContainer.appendChild(playerEl);
  }
  
  playerEl.setAttribute('position', `${player.x} 0.8 ${player.z}`);
  
  if (player.direction !== undefined) {
    if (typeof player.direction === 'number') {
      playerEl.setAttribute('rotation', `0 ${player.direction} 0`);
    } else {
      const rotations = { north: 0, east: 90, south: 180, west: 270 };
      playerEl.setAttribute('rotation', `0 ${rotations[player.direction] || 0} 0`);
    }
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
  if (!gameState.maze || gameState.maze.length === 0) return false;
  
  const cellSize = gameState.cellSize;
  const offsetX = (gameState.maze[0].length * cellSize) / 2;
  const offsetZ = (gameState.maze.length * cellSize) / 2;
  
  const gridX = Math.floor((x + offsetX) / cellSize);
  const gridZ = Math.floor((z + offsetZ) / cellSize);
  
  if (gridZ < 0 || gridZ >= gameState.maze.length || 
      gridX < 0 || gridX >= gameState.maze[0].length) {
    return true;
  }
  
  return gameState.maze[gridZ][gridX] === 1;
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
        console.log(`Coletando tesouro ${treasure.id}`);
        socket.emit('collect_treasure', {
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
  if (currentTime - lastMoveTime > footstepInterval) {
    if (footstepSound && footstepSound.components && footstepSound.components.sound) {
      try {
        footstepSound.components.sound.playSound();
      } catch (e) {
        console.log('Footstep sound not available');
      }
    }
    lastMoveTime = currentTime;
  }
}

// Movement
const moveSpeed = 0.5;

function movePlayer(direction) {
  if (!gameState.gameStarted) return;
  
  const player = gameState.players[gameState.myPlayerId];
  if (!player) return;
  
  let newX = player.x;
  let newZ = player.z;
  let directionAngle = player.direction || 0;
  
  switch(direction) {
    case 'north': 
      newZ -= moveSpeed;
      directionAngle = 0;
      break;
    case 'south': 
      newZ += moveSpeed;
      directionAngle = 180;
      break;
    case 'west': 
      newX -= moveSpeed;
      directionAngle = 270;
      break;
    case 'east': 
      newX += moveSpeed;
      directionAngle = 90;
      break;
  }
  
  if (!checkWallCollision(newX, newZ)) {
    socket.emit('move_player', {
      roomCode: gameState.room,
      x: newX,
      z: newZ,
      direction: directionAngle
    });
    
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
      countdownEl.textContent = 'VAI!';
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
  console.log('Inicializando jogo...');
  console.log('Maze:', gameState.maze);
  console.log('Treasures:', gameState.treasures);
  console.log('Players:', gameState.players);
  
  renderMaze();
  renderTreasures();
  updatePlayerEntities();
  updateLeaderboard();
  
  footstepSound = document.querySelector('#footstep-sound');
  collectSound = document.querySelector('#collect-sound');
  winSound = document.querySelector('#win-sound');
  
  const totalTreasures = gameState.treasures.length;
  document.getElementById('treasureCount').textContent = `0/${totalTreasures}`;
  
  startCountdown();
  startTimer();
}

// UI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  
  document.getElementById('continueBtn').addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim();
    if (!name) {
      alert('Por favor, insira seu nome');
      return;
    }
    gameState.myPlayerName = name;
    document.getElementById('nameScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'block';
  });

  document.getElementById('createBtn').addEventListener('click', () => {
    console.log('Criando sala...', gameState.myPlayerName);
    if (!socket || !socket.connected) {
      alert('Não conectado ao servidor. Aguarde...');
      return;
    }
    socket.emit('create_room', { playerName: gameState.myPlayerName });
  });

  document.getElementById('joinBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    if (!roomCode) {
      alert('Por favor, insira o código da sala');
      return;
    }
    console.log('Entrando na sala:', roomCode);
    if (!socket || !socket.connected) {
      alert('Não conectado ao servidor. Aguarde...');
      return;
    }
    socket.emit('join_room', { 
      roomCode: roomCode,
      playerName: gameState.myPlayerName 
    });
  });

  document.getElementById('readyBtn').addEventListener('click', () => {
    gameState.isReady = !gameState.isReady;
    console.log('✅ Mudando status pronto:', gameState.isReady);
    socket.emit('player_ready', { 
      roomCode: gameState.room,
      ready: gameState.isReady
    });
    document.getElementById('readyBtn').textContent = gameState.isReady ? 'Não Pronto' : 'Pronto';
    document.getElementById('readyBtn').style.background = gameState.isReady ? 
      '#FF9800' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  });

  document.getElementById('leaveBtn').addEventListener('click', () => {
    socket.emit('leave_room', { roomCode: gameState.room });
    location.reload();
  });
  
});

// Initialize on page load
window.addEventListener('load', () => {
  console.log('Página carregada, inicializando socket...');
  console.log(`Modo: ${IS_LOCAL ? 'LOCAL' : 'REMOTO'}`);
  initSocket();
  
  const scene = document.querySelector('a-scene');
  if (scene) {
    if (scene.hasLoaded) {
      console.log('A-Frame scene loaded');
    } else {
      scene.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded');
      });
    }
  }
});

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes collectFeedback {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    50% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.2);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -80%) scale(1);
    }
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.3);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }
`;
document.head.appendChild(style);