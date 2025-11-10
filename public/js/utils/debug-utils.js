// ========================================
// DEBUG UTILITIES FOR VR MAZE GAME
// ========================================
// Cole este código no console do navegador para testar

// Função para verificar estado dos jogadores
window.debugPlayers = function() {
  console.group("👥 PLAYER STATE DEBUG");
  
  console.log("My Player ID:", gameState.myPlayerId);
  console.log("My Player Name:", gameState.myPlayerName);
  console.log("Room Code:", gameState.room);
  console.log("Game Started:", gameState.gameStarted);
  console.log("---");
  
  const players = Object.values(gameState.players);
  console.log(`Total Players: ${players.length}`);
  
  players.forEach((player, idx) => {
    console.log(`\n[${idx + 1}] ${player.name} (${player.id})`);
    console.log(`  Position: (${player.x}, ${player.z})`);
    console.log(`  Direction: ${player.direction}`);
    console.log(`  Treasures: ${player.treasures || 0}`);
    console.log(`  Ready: ${player.ready ? '✅' : '❌'}`);
    
    // Check if 3D entity exists
    const entity = document.getElementById(`player-${player.id}`);
    console.log(`  3D Entity: ${entity ? '✅ EXISTS' : '❌ MISSING'}`);
    if (entity) {
      const pos = entity.getAttribute('position');
      console.log(`  3D Position: (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  });
  
  console.groupEnd();
};

// Função para verificar eventos WebSocket
window.debugWebSocket = function() {
  console.group("🔌 WEBSOCKET DEBUG");
  
  console.log("Socket exists:", !!window.socket);
  if (window.socket) {
    console.log("Socket ID:", window.socket.id);
    console.log("Connected:", window.socket.connected);
    console.log("WebSocket ready:", window.socket.ws?.readyState === WebSocket.OPEN);
    console.log("Server URL:", window.socket.server);
    console.log("Path:", window.socket.path);
    
    console.log("\n📋 Registered Event Listeners:");
    Object.keys(window.socket.listeners).forEach(event => {
      console.log(`  - ${event}: ${window.socket.listeners[event].length} handler(s)`);
    });
  } else {
    console.error("❌ Socket not initialized!");
  }
  
  console.groupEnd();
};

// Função para simular movimento de teste
window.debugTestMove = function(direction = 'north') {
  console.log(`🧪 Testing move: ${direction}`);
  
  if (!gameState.gameStarted) {
    console.error("❌ Game not started!");
    return;
  }
  
  const player = gameState.players[gameState.myPlayerId];
  if (!player) {
    console.error("❌ My player not found!");
    return;
  }
  
  console.log("Before move:", {x: player.x, z: player.z});
  gameController.movePlayer(direction);
  
  setTimeout(() => {
    console.log("After move:", {x: player.x, z: player.z});
  }, 500);
};

// Função para verificar estado do leaderboard
window.debugLeaderboard = function() {
  console.group("🏆 LEADERBOARD DEBUG");
  
  const players = Object.values(gameState.players)
    .sort((a, b) => (b.treasures || 0) - (a.treasures || 0));
  
  console.log(`Total Treasures in Game: ${gameState.treasures.length}`);
  console.log(`My Treasure Count: ${gameState.myTreasureCount}`);
  console.log("\nRanking:");
  
  players.forEach((player, idx) => {
    const rank = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
    const isMe = player.id === gameState.myPlayerId ? " (ME)" : "";
    console.log(`${rank} ${player.name}${isMe}: ${player.treasures || 0}/${gameState.treasures.length} 💎`);
  });
  
  const leaderboardEl = document.getElementById('leaderboardList');
  console.log("\nLeaderboard Element:", leaderboardEl ? "✅ EXISTS" : "❌ MISSING");
  if (leaderboardEl) {
    console.log("Children:", leaderboardEl.children.length);
  }
  
  console.groupEnd();
};

// Função para verificar tesouros
window.debugTreasures = function() {
  console.group("💎 TREASURES DEBUG");
  
  console.log(`Total Treasures: ${gameState.treasures.length}`);
  
  const collected = gameState.treasures.filter(t => t.collected);
  const available = gameState.treasures.filter(t => !t.collected);
  
  console.log(`Collected: ${collected.length}`);
  console.log(`Available: ${available.length}`);
  
  console.log("\n📍 Available Treasures:");
  available.forEach((treasure, idx) => {
    console.log(`[${idx + 1}] ${treasure.id}: (${treasure.x}, ${treasure.z})`);
    
    const el = document.getElementById(treasure.id);
    console.log(`  3D Element: ${el ? '✅' : '❌'}`);
  });
  
  if (collected.length > 0) {
    console.log("\n✅ Collected Treasures:");
    collected.forEach((treasure, idx) => {
      console.log(`[${idx + 1}] ${treasure.id}: collected by ${treasure.collectedBy}`);
    });
  }
  
  console.groupEnd();
};

// Função para forçar atualização de tudo
window.debugForceUpdate = function() {
  console.log("🔄 Forcing full update...");
  
  // Update player entities
  console.log("Updating player entities...");
  playerManager.updatePlayerEntities();
  
  // Update leaderboard
  console.log("Updating leaderboard...");
  uiManager.updateLeaderboard();
  
  // Update player list
  console.log("Updating player list...");
  uiManager.updatePlayerList();
  
  // Update treasures
  console.log("Updating treasures...");
  if (window.treasureManager) {
    treasureManager.renderTreasures();
  } else {
    mazeRenderer.renderTreasures();
  }
  
  console.log("✅ Full update complete!");
};

// Função para enviar evento de teste ao servidor
window.debugSendEvent = function(eventName, data) {
  console.log(`📤 Sending test event: ${eventName}`);
  console.log("Data:", data);
  
  if (!window.socket || !window.socket.isConnected()) {
    console.error("❌ Socket not connected!");
    return;
  }
  
  const sent = window.socket.emit(eventName, data);
  console.log(sent ? "✅ Sent successfully" : "❌ Failed to send");
};

// Função para verificar o estado completo
window.debugFullState = function() {
  console.group("🔍 FULL STATE DEBUG");
  
  console.log("=== CONFIG ===");
  console.log("Server:", CONFIG.SERVER_URL);
  console.log("Cell Size:", CONFIG.CELL_SIZE);
  console.log("Move Speed:", CONFIG.MOVE_SPEED);
  
  console.log("\n=== GAME STATE ===");
  console.log("My Player ID:", gameState.myPlayerId);
  console.log("My Player Name:", gameState.myPlayerName);
  console.log("Room Code:", gameState.room);
  console.log("Game Started:", gameState.gameStarted);
  console.log("My Treasure Count:", gameState.myTreasureCount);
  console.log("Total Players:", Object.keys(gameState.players).length);
  console.log("Total Treasures:", gameState.treasures.length);
  console.log("Maze Size:", gameState.maze?.length, "x", gameState.maze?.[0]?.length);
  
  console.log("\n=== WEBSOCKET ===");
  if (window.socket) {
    console.log("Connected:", window.socket.connected);
    console.log("Ready State:", window.socket.ws?.readyState);
    console.log("Event Listeners:", Object.keys(window.socket.listeners).length);
  } else {
    console.log("❌ Not connected");
  }
  
  console.log("\n=== MANAGERS ===");
  console.log("GameController:", !!window.gameController);
  console.log("PlayerManager:", !!window.playerManager);
  console.log("MazeRenderer:", !!window.mazeRenderer);
  console.log("TreasureManager:", !!window.treasureManager);
  console.log("UIManager:", !!window.uiManager);
  
  console.log("\n=== 3D SCENE ===");
  const scene = document.querySelector('a-scene');
  console.log("Scene exists:", !!scene);
  if (scene) {
    console.log("Scene loaded:", scene.hasLoaded);
    console.log("Players container:", !!document.getElementById('players'));
    console.log("Maze container:", !!document.getElementById('maze'));
    console.log("Treasures container:", !!document.getElementById('treasures'));
  }
  
  console.groupEnd();
};

// Função para monitorar eventos WebSocket em tempo real
window.debugMonitorEvents = function(enable = true) {
  if (!window.socket) {
    console.error("❌ Socket not initialized!");
    return;
  }
  
  if (enable) {
    console.log("🎧 Monitoring WebSocket events...");
    console.log("Call debugMonitorEvents(false) to stop");
    
    // Store original trigger method
    if (!window.socket._originalTrigger) {
      window.socket._originalTrigger = window.socket.trigger;
    }
    
    // Override trigger to log all events
    window.socket.trigger = function(event, data) {
      console.log(`📨 Event: ${event}`);
      console.log("Data:", data);
      console.log("---");
      
      // Call original trigger
      window.socket._originalTrigger.call(this, event, data);
    };
  } else {
    console.log("🔇 Stopped monitoring events");
    
    // Restore original trigger
    if (window.socket._originalTrigger) {
      window.socket.trigger = window.socket._originalTrigger;
    }
  }
};

// Função para simular coleta de tesouro
window.debugCollectTreasure = function(treasureId) {
  console.log(`💎 Attempting to collect treasure: ${treasureId}`);
  
  const treasure = gameState.treasures.find(t => t.id === treasureId);
  
  if (!treasure) {
    console.error(`❌ Treasure ${treasureId} not found!`);
    console.log("Available treasures:", gameState.treasures.map(t => t.id));
    return;
  }
  
  if (treasure.collected) {
    console.warn(`⚠️ Treasure ${treasureId} already collected!`);
    return;
  }
  
  console.log("Treasure position:", treasure.x, treasure.z);
  console.log("My position:", gameState.players[gameState.myPlayerId]?.x, gameState.players[gameState.myPlayerId]?.z);
  
  if (window.treasureManager) {
    treasureManager.collectTreasure(treasureId);
  } else {
    gameController.collectTreasure(treasureId);
  }
};

// Função para teleportar para um tesouro (para testes)
window.debugTeleportToTreasure = function(treasureId) {
  const treasure = gameState.treasures.find(t => t.id === treasureId);
  
  if (!treasure) {
    console.error(`❌ Treasure ${treasureId} not found!`);
    return;
  }
  
  if (treasure.collected) {
    console.warn(`⚠️ Treasure ${treasureId} already collected!`);
    return;
  }
  
  console.log(`🚀 Teleporting to treasure ${treasureId} at (${treasure.x}, ${treasure.z})`);
  
  if (!window.socket || !window.socket.isConnected()) {
    console.error("❌ Socket not connected!");
    return;
  }
  
  window.socket.emit("player_update", {
    playerId: gameState.myPlayerId,
    roomCode: gameState.room,
    x: treasure.x,
    z: treasure.z,
    direction: 0
  });
  
  console.log("✅ Teleport command sent!");
};

// Lista todas as funções de debug disponíveis
window.debugHelp = function() {
  console.log(`
🛠️  DEBUG UTILITIES - VR MAZE GAME
=====================================

Available Commands:
-------------------
debugHelp()              - Show this help message
debugFullState()         - Show complete game state
debugPlayers()           - Show all players info
debugWebSocket()         - Show WebSocket connection info
debugLeaderboard()       - Show leaderboard state
debugTreasures()         - Show treasures state
debugForceUpdate()       - Force update all UI elements

Testing Commands:
-----------------
debugTestMove(dir)       - Test movement ('north', 'south', 'east', 'west')
debugCollectTreasure(id) - Simulate treasure collection
debugTeleportToTreasure(id) - Teleport to treasure (for testing)
debugSendEvent(name, data) - Send custom event to server
debugMonitorEvents(true/false) - Monitor all WebSocket events

Examples:
---------
debugTestMove('north')
debugCollectTreasure('treasure-0')
debugTeleportToTreasure('treasure-0')
debugSendEvent('player_update', {x: 5, z: 5})
debugMonitorEvents(true)  // Start monitoring
debugMonitorEvents(false) // Stop monitoring
  `);
};

// Auto-print help on load
console.log("🎮 Debug utilities loaded! Type debugHelp() for available commands.");

// Export for use
window.debugUtils = {
  help: debugHelp,
  fullState: debugFullState,
  players: debugPlayers,
  webSocket: debugWebSocket,
  leaderboard: debugLeaderboard,
  treasures: debugTreasures,
  forceUpdate: debugForceUpdate,
  testMove: debugTestMove,
  collectTreasure: debugCollectTreasure,
  teleportToTreasure: debugTeleportToTreasure,
  sendEvent: debugSendEvent,
  monitorEvents: debugMonitorEvents
};