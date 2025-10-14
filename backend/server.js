const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuração de porta
const PORT = process.env.PORT || 3001;

// Configuração do Socket.io
const io = new Server(server, {
  path: '/ws',
  cors: {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://jogo-s89j.onrender.com'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json());

// Estado do jogo
const rooms = new Map();

// Função para gerar código de sala
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Função para gerar labirinto simples
function generateMaze(size = 25) {
  const maze = Array(size).fill(0).map(() => Array(size).fill(0));
  
  // Bordas
  for (let i = 0; i < size; i++) {
    maze[0][i] = 1;
    maze[size - 1][i] = 1;
    maze[i][0] = 1;
    maze[i][size - 1] = 1;
  }
  
  // Paredes internas (padrão simples)
  for (let i = 2; i < size - 2; i += 3) {
    for (let j = 2; j < size - 2; j += 3) {
      maze[i][j] = 1;
      if (Math.random() > 0.5) {
        maze[i][j + 1] = 1;
      } else {
        maze[i + 1][j] = 1;
      }
    }
  }
  
  return maze;
}

// Função para gerar tesouros
function generateTreasures(maze, count = 5) {
  const treasures = [];
  const size = maze.length;
  const cellSize = 1;
  const offsetX = (size * cellSize) / 2;
  const offsetZ = (size * cellSize) / 2;
  
  let attempts = 0;
  while (treasures.length < count && attempts < 100) {
    const row = Math.floor(Math.random() * (size - 2)) + 1;
    const col = Math.floor(Math.random() * (size - 2)) + 1;
    
    if (maze[row][col] === 0) {
      const x = (col * cellSize) - offsetX + (cellSize / 2);
      const z = (row * cellSize) - offsetZ + (cellSize / 2);
      
      treasures.push({
        id: `treasure-${treasures.length}`,
        x: x,
        z: z,
        collected: false,
        collectedBy: null
      });
    }
    attempts++;
  }
  
  return treasures;
}

// Função para encontrar posição inicial válida
function findValidStartPosition(maze) {
  const size = maze.length;
  const cellSize = 1;
  const offsetX = (size * cellSize) / 2;
  const offsetZ = (size * cellSize) / 2;
  
  for (let attempts = 0; attempts < 100; attempts++) {
    const row = Math.floor(Math.random() * (size - 2)) + 1;
    const col = Math.floor(Math.random() * (size - 2)) + 1;
    
    if (maze[row][col] === 0) {
      return {
        x: (col * cellSize) - offsetX + (cellSize / 2),
        z: (row * cellSize) - offsetZ + (cellSize / 2)
      };
    }
  }
  
  return { x: 0, z: 0 };
}

// Rotas HTTP
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Maze Runner VR - Backend',
    websocket: '/ws',
    activeRooms: rooms.size
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    backend: 'running',
    websocket: 'available',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// WebSocket Events
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // Criar sala
  socket.on('create_room', (data) => {
    console.log('Criando sala:', data);
    
    const roomCode = generateRoomCode();
    const maze = generateMaze(15);
    const treasures = generateTreasures(maze, 5);
    const startPos = findValidStartPosition(maze);
    
    const room = {
      code: roomCode,
      host: socket.id,
      players: {
        [socket.id]: {
          id: socket.id,
          name: data.playerName,
          x: startPos.x,
          z: startPos.z,
          direction: 0,
          ready: false,
          treasures: 0
        }
      },
      maze: maze,
      treasures: treasures,
      started: false,
      createdAt: Date.now()
    };
    
    rooms.set(roomCode, room);
    socket.join(roomCode);
    
    socket.emit('room_created', {
      success: true,
      payload: {
        code: roomCode,
        room: room
      }
    });
    
    console.log(`Sala ${roomCode} criada por ${data.playerName}`);
  });

  // Entrar na sala
  socket.on('join_room', (data) => {
    console.log('Tentando entrar na sala:', data);
    
    const room = rooms.get(data.roomCode);
    
    if (!room) {
      socket.emit('room_error', { message: 'Sala não encontrada' });
      return;
    }
    
    if (room.started) {
      socket.emit('room_error', { message: 'Jogo já começou' });
      return;
    }
    
    const startPos = findValidStartPosition(room.maze);
    
    room.players[socket.id] = {
      id: socket.id,
      name: data.playerName,
      x: startPos.x,
      z: startPos.z,
      direction: 0,
      ready: false,
      treasures: 0
    };
    
    socket.join(data.roomCode);
    
    socket.emit('room_joined', {
      roomCode: data.roomCode,
      playerId: socket.id,
      players: room.players,
      maze: room.maze,
      treasures: room.treasures
    });
    
    socket.to(data.roomCode).emit('player_joined', {
      players: room.players
    });
    
    console.log(`${data.playerName} entrou na sala ${data.roomCode}`);
  });

  // Player pronto
  socket.on('player_ready', (data) => {
    console.log('Player ready:', data);
    
    const room = rooms.get(data.roomCode);
    if (!room || !room.players[socket.id]) return;
    
    room.players[socket.id].ready = data.ready;
    
    io.to(data.roomCode).emit('player_ready', {
      playerId: socket.id,
      ready: data.ready,
      players: room.players
    });
    
    // Verificar se todos estão prontos
    const allReady = Object.values(room.players).every(p => p.ready);
    const minPlayers = Object.keys(room.players).length >= 1; // Mínimo 1 para teste
    
    if (allReady && minPlayers && !room.started) {
      room.started = true;
      
      setTimeout(() => {
        io.to(data.roomCode).emit('game_starting', {
          maze: room.maze,
          treasures: room.treasures,
          players: room.players
        });
        console.log(`Jogo iniciado na sala ${data.roomCode}`);
      }, 1000);
    }
  });

  // Movimento do jogador
  socket.on('move_player', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room || !room.players[socket.id]) return;
    
    room.players[socket.id].x = data.x;
    room.players[socket.id].z = data.z;
    room.players[socket.id].direction = data.direction;
    
    socket.to(data.roomCode).emit('player_moved', {
      playerId: socket.id,
      x: data.x,
      z: data.z,
      direction: data.direction
    });
  });

  // Coletar tesouro
  socket.on('collect_treasure', (data) => {
    console.log('Tentando coletar tesouro:', data);
    
    const room = rooms.get(data.roomCode);
    if (!room || !room.players[socket.id]) return;
    
    const treasure = room.treasures.find(t => t.id === data.treasureId);
    if (!treasure || treasure.collected) return;
    
    treasure.collected = true;
    treasure.collectedBy = socket.id;
    room.players[socket.id].treasures++;
    
    io.to(data.roomCode).emit('treasure_collected', {
      treasureId: data.treasureId,
      playerId: socket.id,
      treasures: room.players[socket.id].treasures
    });
    
    console.log(`${room.players[socket.id].name} coletou tesouro ${data.treasureId}`);
    
    // Verificar vitória
    const totalTreasures = room.treasures.length;
    if (room.players[socket.id].treasures >= totalTreasures) {
      io.to(data.roomCode).emit('game_won', {
        playerId: socket.id,
        playerName: room.players[socket.id].name
      });
      console.log(`${room.players[socket.id].name} venceu!`);
    }
  });

  // Sair da sala
  socket.on('leave_room', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room) return;
    
    delete room.players[socket.id];
    socket.leave(data.roomCode);
    
    if (Object.keys(room.players).length === 0) {
      rooms.delete(data.roomCode);
      console.log(`Sala ${data.roomCode} deletada (vazia)`);
    } else {
      io.to(data.roomCode).emit('player_left', {
        playerId: socket.id,
        players: room.players
      });
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    
    // Remover jogador de todas as salas
    rooms.forEach((room, roomCode) => {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        
        if (Object.keys(room.players).length === 0) {
          rooms.delete(roomCode);
          console.log(`Sala ${roomCode} deletada (vazia)`);
        } else {
          io.to(roomCode).emit('player_left', {
            playerId: socket.id,
            players: room.players
          });
        }
      }
    });
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('MAZE RUNNER VR - Backend Server');
  console.log('='.repeat(60));
  console.log(`HTTP Server: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('\nServidor pronto! Aguardando conexões...\n');
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n\n Encerrando servidor...');
  
  io.close(() => {
    console.log('WebSocket encerrado');
  });
  
  server.close(() => {
    console.log('HTTP Server encerrado');
    console.log('Servidor finalizado com sucesso\n');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Forçando encerramento');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);