const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Game rooms storage
const rooms = new Map();

// Generate random room code
function generateRoomCode() {
  return 'ROOM' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

// Generate maze
function generateMaze() {
  const mazeSize = 25;
  const maze = [];
  
  for (let x = -mazeSize; x <= mazeSize; x += 2) {
    for (let z = -mazeSize; z <= mazeSize; z += 2) {
      if (Math.random() > 0.7) {
        maze.push({ x, z });
      }
    }
  }
  
  // Boundary walls
  for (let i = -mazeSize; i <= mazeSize; i += 2) {
    maze.push({ x: i, z: -mazeSize });
    maze.push({ x: i, z: mazeSize });
    maze.push({ x: -mazeSize, z: i });
    maze.push({ x: mazeSize, z: i });
  }
  
  return maze;
}

// Generate treasures
function generateTreasures(maze) {
  const treasures = [];
  const count = 5;
  
  for (let i = 0; i < count; i++) {
    let pos;
    let valid = false;
    let attempts = 0;
    
    while (!valid && attempts < 100) {
      pos = {
        x: Math.floor(Math.random() * 40 - 20) * 2,
        z: Math.floor(Math.random() * 40 - 20) * 2
      };
      
      valid = !maze.some(wall => wall.x === pos.x && wall.z === pos.z);
      attempts++;
    }
    
    if (valid) {
      treasures.push({ ...pos, collected: false, id: i });
    }
  }
  
  return treasures;
}

// Player spawn positions
const spawnPositions = [
  { x: -20, z: -20 },
  { x: 20, z: -20 },
  { x: -20, z: 20 },
  { x: 20, z: 20 }
];

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create room
  socket.on('createRoom', (data) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const playerId = socket.id;
    const player = {
      id: playerId,
      name: data.playerName,
      socketId: socket.id,
      ready: false,
      treasures: 0,
      ...spawnPositions[0],
      direction: 'south'
    };

    rooms.set(roomCode, {
      code: roomCode,
      players: { [playerId]: player },
      gameStarted: false,
      maze: null,
      treasures: null,
      host: playerId
    });

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, playerId });
    
    console.log(`Room ${roomCode} created by ${data.playerName}`);
  });

  // Join room
  socket.on('joinRoom', (data) => {
    const { roomCode, playerName } = data;
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('roomError', { message: 'Room not found' });
      return;
    }

    if (room.gameStarted) {
      socket.emit('roomError', { message: 'Game already started' });
      return;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 4) {
      socket.emit('roomError', { message: 'Room is full (max 4 players)' });
      return;
    }

    const playerId = socket.id;
    const player = {
      id: playerId,
      name: playerName,
      socketId: socket.id,
      ready: false,
      treasures: 0,
      ...spawnPositions[playerCount],
      direction: 'south'
    };

    room.players[playerId] = player;
    socket.join(roomCode);
    
    socket.emit('roomJoined', { 
      roomCode, 
      playerId,
      players: room.players 
    });
    
    socket.to(roomCode).emit('playerJoined', { 
      players: room.players 
    });

    console.log(`${playerName} joined room ${roomCode}`);
  });

  // Player ready
  socket.on('playerReady', (data) => {
    const { roomCode, ready } = data;
    const room = rooms.get(roomCode);

    if (!room || !room.players[socket.id]) return;

    room.players[socket.id].ready = ready;
    
    io.to(roomCode).emit('playerReady', { 
      players: room.players 
    });

    // Check if all players are ready (minimum 2 players)
    const playerArray = Object.values(room.players);
    const allReady = playerArray.length >= 2 && 
                     playerArray.every(p => p.ready);

    if (allReady && !room.gameStarted) {
      startGame(roomCode);
    }
  });

  // Start game
  function startGame(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.gameStarted = true;
    room.maze = generateMaze();
    room.treasures = generateTreasures(room.maze);

    io.to(roomCode).emit('gameStarting', {
      maze: room.maze,
      treasures: room.treasures,
      players: room.players
    });

    console.log(`Game started in room ${roomCode}`);
  }

  // Move player
  socket.on('movePlayer', (data) => {
    const { roomCode, x, z, direction } = data;
    const room = rooms.get(roomCode);

    if (!room || !room.players[socket.id] || !room.gameStarted) return;

    room.players[socket.id].x = x;
    room.players[socket.id].z = z;
    room.players[socket.id].direction = direction;

    socket.to(roomCode).emit('playerMoved', {
      playerId: socket.id,
      x,
      z,
      direction
    });
  });

  // Collect treasure
  socket.on('collectTreasure', (data) => {
    const { roomCode, treasureId } = data;
    const room = rooms.get(roomCode);

    if (!room || !room.players[socket.id] || !room.gameStarted) return;

    const treasure = room.treasures.find(t => t.id === treasureId);
    if (!treasure || treasure.collected) return;

    treasure.collected = true;
    treasure.collectedBy = socket.id;
    room.players[socket.id].treasures++;

    io.to(roomCode).emit('treasureCollected', {
      playerId: socket.id,
      treasureId,
      treasures: room.players[socket.id].treasures
    });

    // Check win condition
    if (room.players[socket.id].treasures === room.treasures.length) {
      io.to(roomCode).emit('gameWon', {
        playerId: socket.id,
        playerName: room.players[socket.id].name
      });
      console.log(`${room.players[socket.id].name} won in room ${roomCode}`);
    }
  });

  // Leave room
  socket.on('leaveRoom', (data) => {
    const { roomCode } = data;
    handlePlayerLeave(socket.id, roomCode);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find and remove player from any room
    rooms.forEach((room, roomCode) => {
      if (room.players[socket.id]) {
        handlePlayerLeave(socket.id, roomCode);
      }
    });
  });

  // Handle player leaving
  function handlePlayerLeave(playerId, roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    delete room.players[playerId];

    // If room is empty, delete it
    if (Object.keys(room.players).length === 0) {
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} deleted (empty)`);
      return;
    }

    // If host left, assign new host
    if (room.host === playerId) {
      room.host = Object.keys(room.players)[0];
    }

    // Notify other players
    io.to(roomCode).emit('playerLeft', {
      playerId,
      players: room.players
    });

    console.log(`Player ${playerId} left room ${roomCode}`);
  }
});

// API endpoints
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    code: room.code,
    playerCount: Object.keys(room.players).length,
    gameStarted: room.gameStarted
  }));
  res.json(roomList);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Maze Runner Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
});