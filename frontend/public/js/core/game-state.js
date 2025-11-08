// Game State Management
class GameState {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.myPlayerName = "";
    this.myPlayerId = null;
    this.myTreasureCount = 0;
    this.room = null;
    this.players = {};
    this.maze = [];
    this.treasures = [];
    this.cellSize = CONFIG.CELL_SIZE;
    this.gameStarted = false;
    this.startTime = null;
    this.isReady = false;
  }
  
  // Player methods
  setPlayerName(name) {
    this.myPlayerName = name;
    Utils.logInfo("👤 Player name set:", name);
  }
  
  setPlayerId(id) {
    this.myPlayerId = id;
    Utils.logInfo("🆔 Player ID set:", id);
  }
  
  setRoom(roomCode) {
    this.room = roomCode;
    Utils.logInfo("🏠 Room set:", roomCode);
  }
  
  // FIXED: Merge players instead of replacing
  updatePlayers(newPlayers) {
    Utils.logInfo("👥 updatePlayers called (MERGE mode)");
    Utils.logInfo("  📊 Current players:", Object.keys(this.players).length);
    Utils.logInfo("  📦 New/Updated players:", Object.keys(newPlayers).length);
    
    // Merge each player individually
    Object.keys(newPlayers).forEach(playerId => {
      if (this.players[playerId]) {
        // Player exists - merge/update
        Utils.logInfo(`  ↻ Updating existing player: ${newPlayers[playerId].name}`);
        Object.assign(this.players[playerId], newPlayers[playerId]);
      } else {
        // New player - add
        Utils.logInfo(`  + Adding new player: ${newPlayers[playerId].name}`);
        this.players[playerId] = newPlayers[playerId];
      }
    });
    
    Utils.logInfo("  ✅ After merge - Total players:", Object.keys(this.players).length);
    
    // Log final state
    Object.values(this.players).forEach(p => {
      Utils.logInfo(`    - ${p.name}: ready=${p.ready ? '✅' : '⏸️'}`);
    });
  }
  
  addPlayer(player) {
    Utils.logInfo("➕ Adding player:", player.name);
    this.players[player.id] = player;
    Utils.logInfo("  ✅ Total players now:", Object.keys(this.players).length);
  }
  
  removePlayer(playerId) {
    Utils.logInfo("➖ Removing player:", playerId);
    if (this.players[playerId]) {
      const name = this.players[playerId].name;
      delete this.players[playerId];
      Utils.logInfo(`  ✅ Removed ${name}. Remaining:`, Object.keys(this.players).length);
    } else {
      Utils.logWarn("  ⚠️ Player not found");
    }
  }
  
  updatePlayerReady(playerId, ready) {
    Utils.logInfo(`🎯 updatePlayerReady: ${playerId} -> ${ready}`);
    
    if (this.players[playerId]) {
      this.players[playerId].ready = ready;
      Utils.logInfo(`  ✅ ${this.players[playerId].name} is now ${ready ? 'READY ✅' : 'NOT READY ⏸️'}`);
    } else {
      Utils.logWarn(`  ⚠️ Player ${playerId} not found!`);
    }
  }
  
  // Game methods
  setMaze(maze) {
    this.maze = maze;
    Utils.logInfo("🗺️ Maze set:", maze.length, "x", maze[0]?.length);
  }
  
  setTreasures(treasures) {
    this.treasures = treasures;
    Utils.logInfo("💎 Treasures set:", treasures.length);
  }
  
  collectTreasure(treasureId, playerId) {
    Utils.logInfo("💎 Collecting treasure:", treasureId, "by", playerId);
    
    const treasure = this.treasures.find((t) => t.id === treasureId);
    if (treasure) {
      treasure.collected = true;
      treasure.collectedBy = playerId;
      
      if (playerId === this.myPlayerId) {
        this.myTreasureCount++;
        Utils.logInfo("  ✅ My treasure count:", this.myTreasureCount);
      }
      
      if (this.players[playerId]) {
        this.players[playerId].treasures =
          (this.players[playerId].treasures || 0) + 1;
        Utils.logInfo(`  ✅ ${this.players[playerId].name} now has ${this.players[playerId].treasures} treasures`);
      }
    }
  }
  
  startGame(data) {
    Utils.logInfo("🎮 Starting game with data...");
    
    const payload = data.payload || data;
    
    if (payload.maze) {
      this.maze = payload.maze;
      Utils.logInfo("  🗺️ Maze loaded");
    }
    
    if (payload.treasures) {
      this.treasures = payload.treasures;
      Utils.logInfo("  💎 Treasures loaded:", this.treasures.length);
    }
    
    if (payload.players) {
      this.updatePlayers(payload.players);
      Utils.logInfo("  👥 Players loaded:", Object.keys(this.players).length);
    }
    
    this.gameStarted = true;
    this.startTime = Date.now();
    
    Utils.logInfo("✅ Game started!");
  }
  
  toggleReady() {
    this.isReady = !this.isReady;
    Utils.logInfo("🔄 Toggled my ready status to:", this.isReady ? '✅ READY' : '⏸️ NOT READY');
    
    // Also update in players object if I'm in there
    if (this.myPlayerId && this.players[this.myPlayerId]) {
      this.players[this.myPlayerId].ready = this.isReady;
      Utils.logInfo("  ✅ Updated ready status in players object");
    }
    
    return this.isReady;
  }
}

// Create singleton instance
const gameState = new GameState();

// Expose globally
window.gameState = gameState;
window.GameState = GameState;