// ========================================
// WEBSOCKET EVENT HANDLERS
// Separates event handling logic from WebSocket client
// UPDATED: Spectator compatible
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
    this.ws.on("room_state", (data) => this.handleRoomState(data));
    
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

  handleRoomState(data) {
    Utils.logInfo("📊 Room state received");
    
    const payload = data.payload || data;
    
    // Update all room data
    if (payload.players) {
      Utils.logInfo(`📋 Syncing ${Object.keys(payload.players).length} players`);
      gameState.updatePlayers(payload.players);
    }
    if (payload.maze) {
      gameState.setMaze(payload.maze);
    }
    if (payload.treasures) {
      gameState.setTreasures(payload.treasures);
    }
    if (payload.gameStarted !== undefined) {
      gameState.gameStarted = payload.gameStarted;
    }
    
    // Update UI
    uiManager.updatePlayerList();
    
    // If game already started, initialize
    if (payload.gameStarted && !gameState.initialized) {
      Utils.logInfo("🎮 Game already in progress - joining as spectator");
      gameState.initialized = true;
      uiManager.hideLobby();
      gameController.initGame();
    }
  }

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
    const isSpectator = spectatorManager.getIsSpectator();
    
    if (payload.players) {
      // Full player list update - works for spectators too!
      Utils.logInfo(`📋 Updating player list: ${Object.keys(payload.players).length} players`);
      
      Object.keys(payload.players).forEach(playerId => {
        const serverPlayer = payload.players[playerId];
        if (gameState.players[playerId]) {
          Object.assign(gameState.players[playerId], serverPlayer);
        } else {
          gameState.players[playerId] = serverPlayer;
        }
      });
      
      // For spectators, always show waiting room with updated list
      if (isSpectator) {
        uiManager.showWaitingRoom(gameState.room);
      }
      
    } else if (payload.id && payload.name) {
      // Single player update
      const isMe = payload.id === gameState.myPlayerId;
      
      if (isMe && !isSpectator) {
        if (window._joinTimeout) {
          clearTimeout(window._joinTimeout);
          window._joinTimeout = null;
        }
        
        gameState.players[payload.id] = payload;
        
        const roomCode = gameState.room || gameState.pendingRoomCode;
        uiManager.showWaitingRoom(roomCode);
      } else {
        // Add other player or spectator viewing other player
        gameState.players[payload.id] = payload;
      }
    }
    
    // Always update UI (for both players and spectators)
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
    const isSpectator = spectatorManager.getIsSpectator();
    
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
    
    // Sync my ready button (skip for spectators)
    if (!isSpectator) {
      const myPlayer = gameState.players[gameState.myPlayerId];
      if (myPlayer) {
        uiManager.updateReadyButton(myPlayer.ready);
      }
    }
  }

  handlePlayerUpdate(data) {
    Utils.logDebug("🔄 Player update received");
    
    const payload = data.payload || data;
    const playerId = payload.playerId || payload.id;
    
    const player = gameState.players[playerId];
    if (!player) {
      Utils.logWarn(`⚠️ Player ${playerId} not found for update`);
      return;
    }
    
    const isSpectator = spectatorManager.getIsSpectator();
    
    // For our own player (if not spectator), queue server updates for reconciliation
    if (playerId === gameState.myPlayerId && !isSpectator) {
      const movementController = window.gameController?.movementController;
      
      if (movementController) {
        // Queue the update - it will be applied when player stops moving
        movementController.queueServerUpdate(
          payload.x,
          payload.z,
          payload.direction
        );
      }
      
      // Update non-position data immediately
      if (payload.treasures !== undefined) {
        player.treasures = payload.treasures;
      }
      if (payload.connected !== undefined) {
        player.connected = payload.connected;
      }
      
      return;
    }
    
    // For other players (or if we're spectator), update normally
    let updated = false;
    
    if (payload.x !== undefined) {
      player.x = payload.x;
      updated = true;
    }
    if (payload.z !== undefined) {
      player.z = payload.z;
      updated = true;
    }
    
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
    
    const payload = data.payload || data;
    const isSpectator = spectatorManager.getIsSpectator();
    
    // Update game state with server data
    if (payload.maze || payload.room?.maze) {
      gameState.setMaze(payload.maze || payload.room.maze);
    }
    if (payload.treasures || payload.room?.treasures) {
      gameState.setTreasures(payload.treasures || payload.room.treasures);
    }
    if (payload.players || payload.room?.players) {
      gameState.updatePlayers(payload.players || payload.room.players);
    }
    
    gameState.gameStarted = true;
    gameState.startGame(data);
    
    Utils.logInfo(`🎮 Game starting for ${isSpectator ? 'SPECTATOR' : 'PLAYER'}`);
    Utils.logInfo(`📊 Players in game: ${Object.keys(gameState.players).length}`);
    
    // Hide status indicator
    const statusEl = document.getElementById("connectionStatus");
    if (statusEl) statusEl.classList.add("hidden");
    
    // Hide lobby
    uiManager.hideLobby();
    
    // Initialize game
    gameController.initGame();
    
    // Render world after short delay
    setTimeout(() => {
      if (gameState.maze) mazeManager.renderMaze();
      
      if (gameState.treasures) {
        if (window.treasureManager) {
          treasureManager.setTreasures(gameState.treasures);
          treasureManager.renderTreasures();
          
          // Only start proximity check for players, not spectators
          if (!isSpectator) {
            treasureManager.startProximityCheck();
          }
        } else {
          mazeManager.renderTreasures();
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
    const isSpectator = spectatorManager.getIsSpectator();
    
    // Store data
    if (payload.maze) gameState.setMaze(payload.maze);
    if (payload.treasures) gameState.setTreasures(payload.treasures);
    if (payload.players) gameState.updatePlayers(payload.players);
    
    // Update UI
    uiManager.updatePlayerList();
    
    // Sync ready button if in lobby (skip for spectators)
    if (!gameState.gameStarted && !isSpectator) {
      const myPlayer = gameState.players[gameState.myPlayerId];
      if (myPlayer) {
        uiManager.updateReadyButton(myPlayer.ready);
      }
    }
    
    // Render if game started
    if (gameState.gameStarted) {
      if (payload.maze && !mazeManager.rendered) {
        mazeManager.renderMaze();
      }
      
      if (payload.treasures) {
        setTimeout(() => mazeManager.renderTreasures(), 100);
      }
      
      if (payload.players) {
        setTimeout(() => playerManager.updatePlayerEntities(), 100);
        uiManager.updateLeaderboard();
      }
    }
  }

  handleGameWin(data) {
    Utils.logInfo("🏆 Game won!");
    
    gameController.handleGameWin(data);
  }

  // ========================================
  // TREASURE HANDLERS
  // ========================================

  handleTreasureCollected(data) {
    Utils.logInfo("💎 Treasure collected");
    
    const payload = data.payload || data;
    const isSpectator = spectatorManager.getIsSpectator();
    
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
        
        // Only update our count if we're not a spectator
        if (playerId === gameState.myPlayerId && !isSpectator) {
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