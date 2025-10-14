const io = require('socket.io-client');

console.log('Testando conexão com o backend...\n');

// Configuração de teste
const SERVER_URL = 'http://localhost:3001';
const WS_PATH = '/ws';

console.log(`Servidor: ${SERVER_URL}`);
console.log(`Path: ${WS_PATH}\n`);

// Criar conexão
const socket = io(SERVER_URL, {
  path: WS_PATH,
  transports: ['websocket', 'polling'],
  reconnection: false,
  timeout: 5000
});

// Timeout para o teste
const timeout = setTimeout(() => {
  console.error('FALHA: Timeout - servidor não respondeu em 5 segundos\n');
  console.log('Verifique se o backend está rodando:');
  console.log('  cd backend');
  console.log('  npm run dev\n');
  process.exit(1);
}, 5000);

// Eventos
socket.on('connect', () => {
  clearTimeout(timeout);
  console.log('SUCESSO: Conectado ao servidor!');
  console.log(`   Socket ID: ${socket.id}\n`);
  
  // Teste criar sala
  console.log('Testando criação de sala...');
  socket.emit('create_room', { playerName: 'TestPlayer' });
});

socket.on('room_created', (data) => {
  console.log('SUCESSO: Sala criada!');
  console.log(`   Código: ${data.payload.code}`);
  console.log(`   Maze: ${data.payload.room.maze.length}x${data.payload.room.maze[0].length}`);
  console.log(`   Tesouros: ${data.payload.room.treasures.length}\n`);
  
  console.log('Todos os testes passaram!\n');
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  clearTimeout(timeout);
  console.error('FALHA: Erro de conexão');
  console.error(`   Erro: ${error.message}\n`);
  console.log('Verifique se:');
  console.log('  1. O backend está rodando (npm run dev)');
  console.log('  2. A porta 3001 está livre');
  console.log('  3. Não há firewall bloqueando\n');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  if (reason !== 'io client disconnect') {
    console.error(`Desconectado: ${reason}\n`);
  }
});