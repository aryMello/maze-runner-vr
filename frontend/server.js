require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Configuração de porta - usa variável de ambiente ou 3000 por padrão
const PORT = process.env.PORT || 3000;

// Detectar ambiente
const isProduction = true;
const BACKEND_URL = process.env.BACKEND_URL || 'https://jogo-s89j.onrender.com';

console.log('\n' + '='.repeat(60));
console.log('  MAZE RUNNER VR - Frontend Server');
console.log('='.repeat(60));
console.log(`  Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
console.log(`  Servindo arquivos de: ${path.join(__dirname, 'public')}`);
console.log('='.repeat(60));

// Middleware para servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para parse de JSON
app.use(express.json());

// Middleware para CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Rota principal - servir index.html da pasta public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de health check com informações do ambiente
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'frontend',
    environment: isProduction ? 'production' : 'development',
    backend: BACKEND_URL,
    websocket: `${BACKEND_URL}/ws`,
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Rota de configuração (para o frontend saber qual backend usar)
app.get('/api/config', (req, res) => {
  res.json({
    backendUrl: BACKEND_URL,
    wsPath: '/ws',
    environment: isProduction ? 'production' : 'development'
  });
});

// Fallback para SPA - qualquer rota não encontrada retorna o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(' Erro:', err.message);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: isProduction ? 'Internal Server Error' : err.message
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`  Frontend rodando em: http://localhost:${PORT}`);
  console.log(`  Backend configurado: ${BACKEND_URL}`);
  console.log(`  WebSocket: ${BACKEND_URL}/ws`);
  console.log('='.repeat(60));
  console.log('\n Servidor pronto! Acesse http://localhost:' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/health\n');
});

// Tratamento de shutdown gracioso
const gracefulShutdown = () => {
  console.log('\n\n  Recebido sinal de encerramento...');
  
  server.close(() => {
    console.log('Servidor HTTP encerrado');
    console.log('Servidor frontend finalizado com sucesso\n');
    process.exit(0);
  });
  
  // Forçar encerramento após 10 segundos
  setTimeout(() => {
    console.error('Forçando encerramento após timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown();
});