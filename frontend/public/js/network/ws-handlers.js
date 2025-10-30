// ========================================
// WEBSOCKET EVENT HANDLERS
// Separates event handling logic from WebSocket client
// ========================================

class WSHandlers {
  constructor(wsClient) {
    this.ws = wsClient;
  }

  /**
   * Register all event handlers
   */
  registerAll() {
    Utils.logInfo("📋 Registering WebSocket handlers...");
    
    // Room events
    this.ws.on("room_created", (data) => this.handleRoomCreated(data));
    
    // Player events
    this.ws.on("player_joined", (data) => this.handlePlayerJoined(data));
    this.ws.on("player_left", (data) => this.handlePlayerLeft(data));
    this.ws.on("ready", (data) => this.handleReady(data));
    this.ws.on("player_ready", (data) => this.handleReady(data));
    this.ws.on("player_update", (data) => this.handlePlayerUpdate(data));
    
    // Game events
    this.ws.on("game_start", (data) => this.handleGameStart(data));
    this.ws.on("game_starting", (data) => this.handleGameStart(data));
    this.ws.on("game_update", (data) => this.handleGameUpdate(data));
    this.ws.on("game_win", (data) => this.handleGameWin(data));
    
    // Treasure events
    this.ws.on("treasure_collected", (data) => this.handleTreasureCollected(data));
    
    // Error handling
    this.ws.on("error", (data) => this.handleError(data));
    this.ws.on("message", (data) => this.handleUnknown(data));
    
    Utils.logInfo("✅ All handlers registered");
  }

  // ========================================
  // ROOM HANDLERS
  // ========================================

  handleRoomCreated(data) {
    Utils.logInfo("🏠 Room created");
    
    const payload = data.payload || data;
    const room = payload.room || payload;
    
    const roomCode = payload.code || room.code;
    const hostId = room.host || payload.host;
    
    gameState.setRoom(roomCode);
    gameState.setPlayerId(hostId);
    
    if (room.maze) gameState.setMaze(room.maze);
    if (room.treasures) gameState.setTreasures(room.treasures);
    if (room.players) gameState.updatePlayers(room.players);
    
    // Join as host
    this.ws.emit("join", {
      playerId: hostId,
      name: gameState.myPlayerName,
    });
    
    uiManager.showWaitingRoom(roomCode);
    uiManager.updatePlayerList();
  }

  // ========================================
  // PLAYER HANDLERS
  // ========================================

  handlePlayerJoined(data) {
    Utils.logInfo("👤 Player joined");
    
    const payload = data.payload || data;
    
    if (payload.players) {
      // Full player list update
      Object.keys(payload.players).forEach(playerId => {
        const serverPlayer = payload.players[playerId];
        if (gameState.players[playerId]) {
          Object.assign(gameState.players[playerId], serverPlayer);
        } else {
          gameState.players[playerId] = serverPlayer;
        }
      });
    } else if (payload.id && payload.name) {
      // Single player update
      const isMe = payload.id === gameState.myPlayerId;
      
      if (isMe) {
        if (window._joinTimeout) {
          clearTimeout(window._joinTimeout);
          window._joinTimeout = null;
        }
        
        gameState.players[payload.id] = payload;
        
        const roomCode = gameState.room || gameState.pendingRoomCode;
        uiManager.showWaitingRoom(roomCode);
        uiManager.updatePlayerList();
      } else {
        gameState.players[payload.id] = payload;
      }
    }
    
    uiManager.updatePlayerList();
    
    if (gameState.gameStarted) {
      playerManager.updatePlayerEntities();
    }
  }

  handlePlayerLeft(data) {
    Utils.logInfo("👋 Player left");
    
    const payload = data.payload || data;
    
    if (payload.players) {
      gameState.updatePlayers(payload.players);
    } else if (payload.playerId || payload.id) {
      const playerId = payload.playerId || payload.id;
      gameState.removePlayer(playerId);
      
      if (gameState.gameStarted) {
        playerManager.removePlayerEntity(playerId);
      }
    }
    
    uiManager.updatePlayerList();
    
    if (gameState.gameStarted) {
      uiManager.updateLeaderboard();
    }
  }

  handleReady(data) {
    Utils.logInfo("✅ Ready status update");
    
    const payload = data.payload || data;
    
    if (payload.players) {
      // Update all players
      Object.keys(payload.players).forEach(playerId => {
        if (gameState.players[playerId]) {
          gameState.players[playerId].ready = payload.players[playerId].ready;
        } else {
          gameState.players[playerId] = payload.players[playerId];
        }
      });
    } else if (payload.playerId || payload.id) {
      // Update single player
      const playerId = payload.playerId || payload.id;
      const ready = payload.ready !== undefined ? payload.ready : true;
      
      if (gameState.players[playerId]) {
        gameState.players[playerId].ready = ready;
      }
    }
    
    uiManager.updatePlayerList();
    
    // Sync my ready button
    const myPlayer = gameState.players[gameState.myPlayerId];
    if (myPlayer) {
      uiManager.updateReadyButton(myPlayer.ready);
    }
  }

  handlePlayerUpdate(data) {
    Utils.logInfo("🔄 Player update");
    
    const payload = data.payload || data;
    const playerId = payload.playerId || payload.id;
    
    if (!playerId || playerId === gameState.myPlayerId) {
      return; // Skip own updates
    }
    
    const player = gameState.players[playerId];
    if (!player) return;
    
    let updated = false;
    
    // Update position
    if (payload.x !== undefined) {
      player.x = payload.x;
      updated = true;
    }
    if (payload.z !== undefined) {
      player.z = payload.z;
      updated = true;
    }
    
    // Update rotation
    if (payload.direction !== undefined) {
      player.rotation = payload.direction;
      player.direction = payload.direction;
      updated = true;
    }
    
    // Update entity if game started
    if (updated && gameState.gameStarted) {
      const colorIdx = playerManager.getPlayerColorIndex(playerId);
      playerManager.updatePlayerEntity(playerId, colorIdx);
    }
  }

  // ========================================
  // GAME HANDLERS
  // ========================================

  handleGameStart(data) {
    Utils.logInfo("🎮 Game starting!");
    
    gameState.gameStarted = true;
    gameState.startGame(data);
    
    // Hide status indicator
    const statusEl = document.getElementById("connectionStatus");
    if (statusEl) statusEl.classList.add("hidden");
    
    // Hide lobby
    uiManager.hideLobby();
    
    // Initialize game
    gameController.initGame();
    
    // Render world after short delay
    setTimeout(() => {
      if (gameState.maze) mazeRenderer.renderMaze();
      
      if (gameState.treasures) {
        if (window.treasureManager) {
          treasureManager.setTreasures(gameState.treasures);
          treasureManager.renderTreasures();
          treasureManager.startProximityCheck();
        } else {
          mazeRenderer.renderTreasures();
        }
      }
      
      if (Object.keys(gameState.players).length > 0) {
        playerManager.updatePlayerEntities();
      }
      
      Utils.logInfo("✅ Game world rendered!");
    }, 200);
  }

  handleGameUpdate(data) {
    Utils.logInfo("🔄 Game update");
    
    const payload = data.payload || data;
    
    // Store data
    if (payload.maze) gameState.setMaze(payload.maze);
    if (payload.treasures) gameState.setTreasures(payload.treasures);
    if (payload.players) gameState.updatePlayers(payload.players);
    
    // Update UI
    uiManager.updatePlayerList();
    
    // Sync ready button if in lobby
    if (!gameState.gameStarted) {
      const myPlayer = gameState.players[gameState.myPlayerId];
      if (myPlayer) {
        uiManager.updateReadyButton(myPlayer.ready);
      }
    }
    
    // Render if game started
    if (gameState.gameStarted) {
      if (payload.maze && !mazeRenderer.rendered) {
        mazeRenderer.renderMaze();
      }
      
      if (payload.treasures) {
        setTimeout(() => mazeRenderer.renderTreasures(), 100);
      }
      
      if (payload.players) {
        setTimeout(() => playerManager.updatePlayerEntities(), 100);
        uiManager.updateLeaderboard();
      }
    }
  }

  handleGameWin(data) {
    Utils.logInfo("🏆 Game won!");
    
    gameController.handleGameWon(data);
  }

  // ========================================
  // TREASURE HANDLERS
  // ========================================

  handleTreasureCollected(data) {
    Utils.logInfo("💎 Treasure collected");
    
    const payload = data.payload || data;
    
    if (window.treasureManager) {
      treasureManager.handleTreasureCollected(payload);
    } else {
      // Fallback
      const treasureId = payload.treasureId;
      const playerId = payload.playerId;
      
      const treasure = gameState.treasures.find(t => t.id === treasureId);
      if (treasure) {
        treasure.collected = true;
        
        const treasureEl = document.getElementById(treasureId);
        if (treasureEl?.parentNode) {
          treasureEl.parentNode.removeChild(treasureEl);
        }
        
        if (playerId === gameState.myPlayerId) {
          gameState.myTreasureCount++;
          const el = document.getElementById('treasureCount');
          if (el) {
            el.textContent = `${gameState.myTreasureCount}/${gameState.treasures.length}`;
          }
        }
        
        if (gameState.players[playerId]) {
          const newCount = payload.treasures || (gameState.players[playerId].treasures || 0) + 1;
          gameState.players[playerId].treasures = newCount;
        }
        
        uiManager.updateLeaderboard();
      }
    }
  }

  // ========================================
  // ERROR HANDLERS
  // ========================================

  handleError(data) {
    Utils.logError("❌ Server error:", data);
    
    const payload = data.payload || data;
    const message = payload.message || data.message || "Erro desconhecido";
    
    alert("Erro: " + message);
  }

  handleUnknown(data) {
    Utils.logWarn("⚠️ Unhandled message:", data);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WSHandlers;
}

window.WSHandlers = WSHandlers;