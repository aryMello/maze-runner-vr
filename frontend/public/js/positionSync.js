// Position Synchronization Module
// Continuously syncs the local player's camera position to the server
// This ensures other players see you moving in real-time

class PositionSync {
  constructor() {
    this.syncInterval = null;
    this.lastPosition = { x: 0, z: 0 };
    this.lastRotation = 0;
    this.syncRate = 100; // Send updates every 100ms
    this.movementThreshold = 0.05; // Minimum movement to trigger update (in units)
    this.rotationThreshold = 5; // Minimum rotation to trigger update (in degrees)
  }

  // Start syncing position to server
  start() {
    Utils.logInfo("📍 Starting position sync...");
    
    // Clear any existing interval
    this.stop();
    
    // Start sync loop
    this.syncInterval = setInterval(() => {
      this.syncPosition();
    }, this.syncRate);
    
    Utils.logInfo(`✅ Position sync active (every ${this.syncRate}ms)`);
  }

  // Stop syncing
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      Utils.logInfo("⏹️ Position sync stopped");
    }
  }

  // Sync current position to server
  syncPosition() {
    // Check prerequisites
    if (!gameState.gameStarted) {
      return; // Don't sync until game starts
    }

    if (!gameState.myPlayerId) {
      Utils.logWarn("⚠️ No player ID set");
      return;
    }

    if (!socket || !socket.isConnected()) {
      Utils.logWarn("⚠️ Socket not connected");
      return;
    }

    // Get camera position
    const camera = document.getElementById("camera");
    if (!camera) {
      Utils.logWarn("⚠️ Camera not found");
      return;
    }

    const position = camera.getAttribute("position");
    const rotation = camera.getAttribute("rotation");

    if (!position) {
      return;
    }

    // Convert world coordinates to grid coordinates
    // REVERSE of the formula in playerManager: grid = (world + offset) / cellSize
    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;

    const gridX = (position.x + offsetX) / cellSize;
    const gridZ = (position.z + offsetZ) / cellSize;

    // Round to 2 decimal places
    const currentX = Math.round(gridX * 100) / 100;
    const currentZ = Math.round(gridZ * 100) / 100;
    const currentRotation = rotation ? Math.round(rotation.y) : 0;

    // Check if position or rotation changed significantly
    const deltaX = Math.abs(currentX - this.lastPosition.x);
    const deltaZ = Math.abs(currentZ - this.lastPosition.z);
    const deltaRotation = Math.abs(currentRotation - this.lastRotation);

    const positionChanged = deltaX > this.movementThreshold || deltaZ > this.movementThreshold;
    const rotationChanged = deltaRotation > this.rotationThreshold;

    if (positionChanged || rotationChanged) {
      // Update last known values
      this.lastPosition.x = currentX;
      this.lastPosition.z = currentZ;
      this.lastRotation = currentRotation;

      // Update local game state
      if (gameState.players[gameState.myPlayerId]) {
        gameState.players[gameState.myPlayerId].x = currentX;
        gameState.players[gameState.myPlayerId].z = currentZ;
        gameState.players[gameState.myPlayerId].direction = currentRotation;
      }

      // Send to server
      const success = socket.emit("move", {
        playerId: gameState.myPlayerId,
        x: currentX,
        z: currentZ,
        direction: currentRotation,
      });

      if (success) {
        Utils.logDebug(`📤 Position synced: grid(${currentX.toFixed(2)}, ${currentZ.toFixed(2)}) rot=${currentRotation}°`);
      } else {
        Utils.logWarn("⚠️ Failed to send position update");
      }
    }
  }

  // Get current grid position (useful for debugging)
  getCurrentGridPosition() {
    const camera = document.getElementById("camera");
    if (!camera) return null;

    const position = camera.getAttribute("position");
    if (!position) return null;

    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;

    return {
      x: (position.x + offsetX) / cellSize,
      z: (position.z + offsetZ) / cellSize,
    };
  }
}

// Create singleton instance
const positionSync = new PositionSync();

// Expose globally IMMEDIATELY
window.positionSync = positionSync;
window.PositionSync = PositionSync;

// Log only if Utils is available
if (window.Utils) {
  Utils.logInfo("✅ Position Sync module loaded");
} else {
  console.log("✅ Position Sync module loaded");
}