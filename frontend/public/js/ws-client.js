// WebSocket Client - Native WebSocket Implementation
// Manages WebSocket connection with event handling

class WSClient {
  constructor(server, path, isLocal) {
    this.server = server;
    this.path = path;
    this.isLocal = !!isLocal;
    this.ws = null;
    this.connected = false;
    this.listeners = {};
    this.id = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
  }

  // Build WebSocket URL
  getWebSocketURL() {
    const norm = Utils.normalizeServer(this.server);
    const wsProto = norm.wsProto || "wss";
    const host = norm.host;
    const path = this.path.startsWith("/") ? this.path : "/" + this.path;
    return `${wsProto}://${host}${path}`;
  }

  // Connect to WebSocket server
  connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.getWebSocketURL();
        Utils.logInfo("Connecting to WebSocket:", wsUrl);

        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          Utils.logError("WebSocket connection timeout");
          this.ws.close();
          reject(new Error("Connection timeout"));
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.id = "ws-" + Math.random().toString(36).substr(2, 9);
          Utils.logInfo("✅ WebSocket connected successfully!", this.id);

          uiManager.updateConnectionStatus("connected");
          this.trigger("connect");

          // Setup handlers after connection
          this.setupHandlers();

          resolve(this);
        };

        this.ws.onclose = (event) => {
          Utils.logInfo("WebSocket closed", event.code, event.reason);
          this.connected = false;
          uiManager.updateConnectionStatus("disconnected");
          this.trigger("disconnect", event.reason);

          // Attempt reconnection if not a clean close
          if (
            event.code !== 1000 &&
            this.reconnectAttempts < this.maxReconnectAttempts
          ) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          Utils.logError("WebSocket error:", error);
          this.trigger("error", error);
          this.trigger("connect_error", error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        Utils.logError("Failed to create WebSocket:", error);
        reject(error);
      }
    });
  }

  // Handle incoming messages
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const eventType = data.event || data.type;

      // Log with formatted JSON (compact maze as matrix)
      Utils.logInfo("📨 Received message - Event type:", eventType);
      Utils.logDebug("📨 Raw message structure:", {
        hasEvent: !!data.event,
        hasType: !!data.type,
        hasPayload: !!data.payload,
        hasData: !!data.data,
        eventType: eventType
      });

      // Create a copy for logging with compact maze
      const logData = JSON.parse(JSON.stringify(data));

      // Convert maze to compact matrix representation
      if (logData.payload?.room?.maze) {
        const maze = logData.payload.room.maze;
        const mazeString = maze.map((row) => row.join("")).join("\n");
        console.log(
          `🗺️ Maze (${maze.length}x${maze[0].length}):\n${mazeString}`
        );
        logData.payload.room.maze = `[${maze.length}x${maze[0].length} matrix - see above]`;
      }
      if (logData.payload?.maze) {
        const maze = logData.payload.maze;
        const mazeString = maze.map((row) => row.join("")).join("\n");
        console.log(
          `🗺️ Maze (${maze.length}x${maze[0].length}):\n${mazeString}`
        );
        logData.payload.maze = `[${maze.length}x${maze[0].length} matrix - see above]`;
      }

      console.log("📦 Message content:", JSON.stringify(logData, null, 2));

      // Trigger event based on message structure
      if (data.event) {
        Utils.logDebug("🎯 Triggering event:", data.event);
        this.trigger(data.event, data.data || data);
      } else if (data.type) {
        Utils.logDebug("🎯 Triggering type:", data.type);
        this.trigger(data.type, data);
      } else {
        // Generic message
        Utils.logWarn("⚠️ Message has no event or type, triggering generic 'message'");
        this.trigger("message", data);
      }
    } catch (e) {
      Utils.logError("❌ Failed to parse message:", e);
      Utils.logWarn("Raw message data:", event.data);
      this.trigger("message", event.data);
    }
  }

  // Attempt to reconnect
  attemptReconnect() {
    this.reconnectAttempts++;
    Utils.logInfo(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(() => {
      this.connect().catch((err) => {
        Utils.logError("Reconnection failed:", err);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Register event listener
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  // Remove event listener
  off(event, callback) {
    if (!this.listeners[event]) return;
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    } else {
      delete this.listeners[event];
    }
  }

  // Trigger event listeners
  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          Utils.logError("Error in event listener:", event, e);
        }
      });
    }
  }

  // Check if WebSocket is truly connected and ready
  isConnected() {
    const isReady = this.ws && this.ws.readyState === WebSocket.OPEN;
    
    // Sync the connected flag with actual state
    if (isReady && !this.connected) {
      Utils.logWarn("⚠️ Syncing connected flag to true");
      this.connected = true;
    } else if (!isReady && this.connected) {
      Utils.logWarn("⚠️ Syncing connected flag to false");
      this.connected = false;
    }
    
    return isReady;
  }

  // Send message to server
  emit(event, data) {
    // Detailed connection check with logging
    Utils.logDebug("🔍 Checking connection state for emit:", {
      connected: this.connected,
      hasWs: !!this.ws,
      readyState: this.ws ? this.ws.readyState : 'no ws',
      readyStateExpected: WebSocket.OPEN,
      event: event
    });

    if (!this.ws) {
      Utils.logError("❌ Cannot send - WebSocket object is null");
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      Utils.logError(`❌ Cannot send - WebSocket not open. State: ${this.ws.readyState} (OPEN=${WebSocket.OPEN})`);
      return false;
    }

    if (!this.connected) {
      Utils.logWarn("⚠️ Connected flag is false, but readyState is OPEN. Updating flag...");
      this.connected = true;
    }

    // Format message according to server expectations: {type, payload}
    const messageObj = {
      type: event,
      payload: data,
    };

    const message = JSON.stringify(messageObj);

    try {
      this.ws.send(message);
      Utils.logDebug("📤 Sent:", event);
      console.log(JSON.stringify(messageObj, null, 2));
      return true;
    } catch (e) {
      Utils.logError("Failed to send message:", e);
      return false;
    }
  }

  // Close connection
  close() {
    if (this.ws) {
      this.ws.close(1000, "Client closing connection");
      this.connected = false;
    }
  }

  // Setup all game event handlers
  setupHandlers() {
    Utils.logInfo("Setting up game event handlers...");

    // ===== ROOM EVENTS =====
    
    // Event: room_created
    this.on("room_created", (data) => {
      Utils.logInfo("🏠 Room created - HOST received from server");

      const payload = data.payload || data;
      const room = payload.room || payload;

      Utils.logInfo("📦 Room data:", {
        code: payload.code || room.code,
        host: room.host || payload.host,
        hasMaze: !!(room.maze),
        hasTreasures: !!(room.treasures),
        hasPlayers: !!(room.players)
      });

      const roomCode = payload.code || room.code;
      gameState.setRoom(roomCode);
      Utils.logInfo("🏷️ Room code set:", roomCode);

      const hostId = room.host || payload.host;
      gameState.setPlayerId(hostId);
      Utils.logInfo("👤 Host ID set:", hostId);

      if (room.maze) {
        Utils.logInfo("🗺️ Storing maze data (will render when game starts)");
        gameState.setMaze(room.maze);
      }

      if (room.treasures) {
        Utils.logInfo("💎 Storing treasures data (will render when game starts)");
        gameState.setTreasures(room.treasures);
      }

      if (room.players) {
        Utils.logInfo("👥 Updating HOST in players list");
        gameState.updatePlayers(room.players);
      }

      Utils.logInfo("📤 Sending join message as HOST...");
      const joinSent = this.emit("join", {
        playerId: hostId,
        name: gameState.myPlayerName,
      });
      
      if (joinSent) {
        Utils.logInfo("✅ Join message sent successfully");
      } else {
        Utils.logError("❌ Failed to send join message");
      }
      
      Utils.logInfo("🚪 Showing lobby for HOST...");
      uiManager.showWaitingRoom(roomCode);
      uiManager.updatePlayerList();
      Utils.logInfo("✅ HOST lobby is now visible");
    });

    // ===== PLAYER EVENTS =====
    
    this.on("player_joined", (data) => {
      Utils.logInfo("👤 Player joined event - received from server");
      Utils.logInfo("📦 Player joined data:", JSON.stringify(data, null, 2));

      const payload = data.payload || data;
      
      Utils.logInfo("🔍 Payload analysis:", {
        hasPlayers: !!payload.players,
        hasId: !!payload.id,
        hasName: !!payload.name,
        hasSocketId: !!payload.socketId,
        currentRoom: gameState.room,
        currentPlayerId: gameState.myPlayerId,
        payloadPlayerId: payload.id,
        playerName: payload.name,
        isMe: payload.id === gameState.myPlayerId
      });

      if (payload.players) {
        Utils.logInfo("👥 Received FULL players list (room state)");
        Utils.logInfo("Players in room:", Object.keys(payload.players));
        
        Object.keys(payload.players).forEach(playerId => {
          if (gameState.players[playerId]) {
            Utils.logInfo(`  ↻ Updating existing player: ${payload.players[playerId].name}`);
            Object.assign(gameState.players[playerId], payload.players[playerId]);
          } else {
            Utils.logInfo(`  + Adding new player: ${payload.players[playerId].name}`);
            gameState.players[playerId] = payload.players[playerId];
          }
        });
        
        Utils.logInfo("✅ All players merged into game state");
        Utils.logInfo("📊 Total players now:", Object.keys(gameState.players).length);
      }
      else if (payload.id && payload.name) {
        const isMe = payload.id === gameState.myPlayerId;
        const isNewPlayer = !gameState.players[payload.id];
        
        if (isMe) {
          Utils.logInfo("🎯 This is MY player_joined confirmation!");
          
          if (window._joinTimeout) {
            clearTimeout(window._joinTimeout);
            window._joinTimeout = null;
            Utils.logInfo("✅ Cleared join timeout");
          }
          
          const myData = {};
          myData[payload.id] = payload;
          gameState.updatePlayers(myData);
          
          Utils.logInfo("✅ My player data set");
          
          const roomCode = gameState.room || gameState.pendingRoomCode || "SALA";
          Utils.logInfo("🚪 Redirecting ME to lobby:", roomCode);
          uiManager.showWaitingRoom(roomCode);
          uiManager.updatePlayerList();
          Utils.logInfo("✅ Now in lobby! I can mark myself as ready.");
          
        } else if (isNewPlayer) {
          Utils.logInfo("👋 NEW player joining the room:", payload.name);
          
          const newPlayerData = {};
          newPlayerData[payload.id] = payload;
          gameState.updatePlayers(newPlayerData);
          
          Utils.logInfo("✅ New player added to game state");
          Utils.logInfo("📊 Total players now:", Object.keys(gameState.players).length);
          
          Utils.logInfo("📋 Updating player list...");
          uiManager.updatePlayerList();
        }
      }

      if (gameState.gameStarted && gameState.maze && gameState.maze.length > 0) {
        Utils.logInfo("🎮 Game is running, updating player entities...");
        playerManager.updatePlayerEntities();
      } else {
        Utils.logInfo("⏸️ Still in lobby. Total players:", Object.keys(gameState.players).length);
      }
    });

    this.on("player_left", (data) => {
      Utils.logInfo("👋 Player left:", data);
      
      const payload = data.payload || data;
      
      if (payload.players) {
        Utils.logInfo("📋 Updating players list from payload");
        gameState.updatePlayers(payload.players);
      } else if (payload.playerId || payload.id) {
        const playerId = payload.playerId || payload.id;
        Utils.logInfo("🗑️ Removing player:", playerId);
        gameState.removePlayer(playerId);
      }
      
      uiManager.updatePlayerList();
      
      if (gameState.gameStarted) {
        const playerId = payload.playerId || payload.id;
        playerManager.removePlayerEntity(playerId);
        uiManager.updateLeaderboard();
      }
    });

    this.on("ready", (data) => {
      Utils.logInfo("✅ Ready status update:", data);
      
      const payload = data.payload || data;
      
      Utils.logInfo("🔍 Ready payload structure:", {
        hasPlayers: !!payload.players,
        hasPlayerId: !!(payload.playerId || payload.id),
        hasReady: payload.ready !== undefined,
        ready: payload.ready,
        playerId: payload.playerId || payload.id
      });
      
      if (payload.players) {
        Utils.logInfo("📋 Updating all players ready status from full list");
        Object.keys(payload.players).forEach(playerId => {
          if (gameState.players[playerId]) {
            gameState.players[playerId].ready = payload.players[playerId].ready;
            Utils.logInfo(`  ✓ ${gameState.players[playerId].name}: ${payload.players[playerId].ready ? 'READY' : 'NOT READY'}`);
          } else {
            gameState.players[playerId] = payload.players[playerId];
            Utils.logInfo(`  + Added new player: ${payload.players[playerId].name}`);
          }
        });
      } else if (payload.playerId || payload.id) {
        const playerId = payload.playerId || payload.id;
        const ready = payload.ready !== undefined ? payload.ready : true;
        Utils.logInfo(`🎯 Player ${playerId} is now ${ready ? 'READY ✅' : 'NOT READY ⏸️'}`);
        
        if (gameState.players[playerId]) {
          gameState.players[playerId].ready = ready;
          Utils.logInfo(`✅ Updated ready status for: ${gameState.players[playerId].name}`);
        } else {
          Utils.logWarn(`⚠️ Player ${playerId} not found in game state!`);
        }
      } else {
        Utils.logWarn("⚠️ Incomplete ready event (no playerId). Will sync via game_update.");
        return;
      }
      
      Utils.logInfo("📊 Current players status:");
      Object.values(gameState.players).forEach(p => {
        Utils.logInfo(`  - ${p.name}: ${p.ready ? '✅ READY' : '⏸️ NOT READY'}`);
      });
      
      uiManager.updatePlayerList();
      Utils.logInfo("✅ Player list UI updated");
    });

    this.on("player_ready", (data) => {
      Utils.logInfo("✅ Player ready:", data);
      this.trigger("ready", data);
    });

    // FIXED: Event "move" - Real-time position sync
    // This is THE CRITICAL handler for live position updates!
    this.on("move", (data) => {
      Utils.logInfo("🚶 Move event received from server");
      
      const payload = data.payload || data;
      const playerId = payload.playerId || payload.id;
      
      if (!playerId) {
        Utils.logWarn("⚠️ Move event without playerId:", payload);
        return;
      }
      
      // Skip my own updates (already handled locally)
      if (playerId === gameState.myPlayerId) {
        Utils.logDebug("⏭️ Skipping my own move update");
        return;
      }
      
      // Check if player exists
      if (!gameState.players[playerId]) {
        Utils.logWarn(`⚠️ Player ${playerId} not found in game state`);
        Utils.logWarn("Available players:", Object.keys(gameState.players));
        return;
      }
      
      const player = gameState.players[playerId];
      const playerName = player.name || playerId;
      const oldPos = {x: player.x, z: player.z, dir: player.direction};
      
      // Update position IMMEDIATELY
      let positionChanged = false;
      
      if (payload.x !== undefined && payload.x !== player.x) {
        player.x = payload.x;
        positionChanged = true;
      }
      if (payload.z !== undefined && payload.z !== player.z) {
        player.z = payload.z;
        positionChanged = true;
      }
      if (payload.direction !== undefined && payload.direction !== player.direction) {
        player.direction = payload.direction;
      }
      
      if (positionChanged) {
        Utils.logInfo(`🚶 ${playerName} moved: (${oldPos.x.toFixed(1)}, ${oldPos.z.toFixed(1)}) → (${player.x.toFixed(1)}, ${player.z.toFixed(1)}) [dir: ${payload.direction}°]`);
        
        // Update 3D entity IMMEDIATELY
        if (gameState.gameStarted) {
          const colorIdx = playerManager.getPlayerColorIndex(playerId);
          playerManager.updatePlayerEntity(playerId, colorIdx);
          Utils.logInfo(`✅ Updated 3D entity for ${playerName}`);
        }
      }
    });

    // ===== GAME EVENTS =====
    
    this.on("game_start", (data) => {
      Utils.logInfo("🎮 Game start! (from server) All players are ready!");

      const statusEl = document.getElementById("connectionStatus");
      if (statusEl) {
        statusEl.classList.add("hidden");
      }
      
      gameState.gameStarted = true;
      gameState.startGame(data);
      
      uiManager.hideLobby();
      gameController.initGame();
      
      setTimeout(() => {
        Utils.logInfo("🎨 NOW RENDERING: Game world...");
        
        if (gameState.maze && gameState.maze.length > 0) {
          mazeRenderer.renderMaze();
        }
        
        if (gameState.treasures && gameState.treasures.length > 0) {
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
        
        Utils.logInfo("✅ Game world rendered! Let's play! 🎮");
      }, 200);
    });

    this.on("game_starting", (data) => {
      Utils.logInfo("🎮 Game starting!");
      this.trigger("game_start", data);
    });

    this.on("game_update", (data) => {
      Utils.logInfo("🔄 Game update received");

      const payload = data.payload || data;
      
      Utils.logInfo("📦 game_update payload structure:", {
        hasPlayers: !!payload.players,
        hasMaze: !!payload.maze,
        hasTreasures: !!payload.treasures,
        hasRoomCode: !!(payload.roomCode || payload.code),
        playersCount: payload.players ? Object.keys(payload.players).length : 0,
        currentRoom: gameState.room,
        currentPlayerId: gameState.myPlayerId,
        currentPlayerName: gameState.myPlayerName,
        gameStarted: gameState.gameStarted
      });
      
      if (payload.players) {
        Utils.logInfo("👥 Players in game_update:");
        Object.values(payload.players).forEach(p => {
          Utils.logInfo(`  - ${p.name} (${p.id}) - Ready: ${p.ready ? '✅' : '⏸️'}`);
        });
      }
      
      if (!gameState.gameStarted && gameState.room && payload.players) {
        Utils.logInfo("🔄 CASE 1: Lobby update - syncing player list");
        
        if (payload.maze && (!gameState.maze || gameState.maze.length === 0)) {
          Utils.logInfo("🗺️ Storing maze data...");
          gameState.setMaze(payload.maze);
        }
        
        if (payload.treasures && (!gameState.treasures || gameState.treasures.length === 0)) {
          Utils.logInfo("💎 Storing treasures data...");
          gameState.setTreasures(payload.treasures);
        }
        
        const oldPlayerIds = Object.keys(gameState.players);
        const newPlayerIds = Object.keys(payload.players);
        
        newPlayerIds.forEach(id => {
          if (!oldPlayerIds.includes(id)) {
            Utils.logInfo("👋 NEW PLAYER detected:", payload.players[id].name);
          }
        });
        
        Utils.logInfo("👥 Syncing ALL players from server (server = source of truth)");
        Object.keys(payload.players).forEach(playerId => {
          const serverPlayer = payload.players[playerId];
          const localPlayer = gameState.players[playerId];
          
          if (localPlayer) {
            if (localPlayer.ready !== serverPlayer.ready) {
              const isMe = playerId === gameState.myPlayerId;
              Utils.logInfo(`  🔄 Ready status changed for ${serverPlayer.name}: ${serverPlayer.ready ? '✅' : '⏸️'} ${isMe ? '(ME)' : ''}`);
            }
            
            Object.assign(gameState.players[playerId], serverPlayer);
            Utils.logInfo(`  ↻ Updated: ${serverPlayer.name} - Ready: ${serverPlayer.ready ? '✅' : '⏸️'}`);
          } else {
            gameState.players[playerId] = serverPlayer;
            Utils.logInfo(`  + Added: ${serverPlayer.name} - Ready: ${serverPlayer.ready ? '✅' : '⏸️'}`);
          }
        });
        
        uiManager.updatePlayerList();
        
        const myPlayer = gameState.players[gameState.myPlayerId];
        if (myPlayer) {
          Utils.logInfo(`🔘 Syncing my ready button to server state: ${myPlayer.ready}`);
          uiManager.updateReadyButton(myPlayer.ready);
        }
        
        Utils.logInfo("✅ Lobby synced with", Object.keys(gameState.players).length, "players");
        Utils.logInfo("📊 All players status (synced from server):");
        Object.values(gameState.players).forEach(p => {
          Utils.logInfo(`  - ${p.name}: ${p.ready ? '✅ READY' : '⏸️ NOT READY'}`);
        });
        return;
      }
      
      if (gameState.gameStarted) {
        Utils.logInfo("🎮 CASE 2: In-game update");
        
        if (payload.maze && !mazeRenderer.rendered) {
          Utils.logInfo("🗺️ Rendering maze...");
          mazeRenderer.renderMaze();
        }

        if (payload.treasures) {
          Utils.logInfo("💎 Updating treasures...");
          gameState.setTreasures(payload.treasures);

          setTimeout(() => {
            Utils.logInfo("🎨 Rendering treasures from game_update...");
            mazeRenderer.renderTreasures();
          }, 100);
        }

        if (payload.players) {
          gameState.updatePlayers(payload.players);
          uiManager.updatePlayerList();

          setTimeout(() => {
            Utils.logInfo("🎨 Updating player positions from game_update...");
            playerManager.updatePlayerEntities();
          }, 100);

          Object.keys(payload.players).forEach((playerId) => {
            if (playerId !== gameState.myPlayerId) {
              const colorIdx = playerManager.getPlayerColorIndex(playerId);
              playerManager.updatePlayerEntity(playerId, colorIdx);
            }
          });
          
          uiManager.updateLeaderboard();
        }
        
        Utils.logInfo("✅ In-game state updated");
        return;
      }
      
      Utils.logInfo("📌 CASE 3: Storing data (fallback)");
      
      if (payload.maze) {
        Utils.logInfo("🗺️ Storing maze...");
        gameState.setMaze(payload.maze);
      }
      if (payload.treasures) {
        Utils.logInfo("💎 Storing treasures...");
        gameState.setTreasures(payload.treasures);
      }
      if (payload.players) {
        Utils.logInfo("👥 Storing players...");
        gameState.updatePlayers(payload.players);
        uiManager.updatePlayerList();
      }
    });

    this.on("treasure_collected", (data) => {
      Utils.logInfo("💎 Treasure collected event received:", data);
      
      const payload = data.payload || data;
      
      if (window.treasureManager) {
        treasureManager.handleTreasureCollected(payload);
      } else {
        Utils.logError("❌ treasureManager not available!");
        
        const treasureId = payload.treasureId;
        const playerId = payload.playerId;
        
        const treasure = gameState.treasures.find(t => t.id === treasureId);
        if (treasure) {
          treasure.collected = true;
          treasure.collectedBy = playerId;
          
          const treasureEl = document.getElementById(treasureId);
          if (treasureEl && treasureEl.parentNode) {
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
            const newCount = payload.treasures !== undefined ? payload.treasures : (gameState.players[playerId].treasures || 0) + 1;
            gameState.players[playerId].treasures = newCount;
          }
          
          if (window.uiManager && window.uiManager.updateLeaderboard) {
            uiManager.updateLeaderboard();
          }
        }
      }
    });

    this.on("game_won", (data) => {
      Utils.logInfo("🏆 Game won!", data);
      
      const payload = data.payload || data;
      const winnerId = payload.playerId || payload.winnerId;
      const winnerName = payload.playerName || gameState.players[winnerId]?.name;
      
      Utils.logInfo(`👑 Winner: ${winnerName} (${winnerId})`);
      
      gameController.handleGameWon(data);
    });

    this.on("error", (data) => {
      Utils.logError("❌ Server error:", data);
      
      const payload = data.payload || data;
      const message = payload.message || data.message || "Erro desconhecido no servidor";
      
      Utils.logError("Error message:", message);
      alert("Erro: " + message);
    });
    
    this.on("message", (data) => {
      Utils.logWarn("⚠️ Unhandled message received:", data);
    });

    window.socket = this;
    gameController.setSocket(this);
    
    Utils.logInfo("✅ All event handlers registered successfully!");
  }
}

window.WSClient = WSClient;