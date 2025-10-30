// ========================================
// MOVEMENT CONTROLLER
// Handles all player movement logic
// ========================================

class MovementController {
  constructor(gameState, collisionUtils) {
    this.gameState = gameState;
    this.collisionUtils = collisionUtils;
    this.camera = null;
    this.socket = null;
  }

  /**
   * Initialize movement controller
   * @param {HTMLElement} camera - A-Frame camera element
   * @param {WSClient} socket - WebSocket client instance
   */
  init(camera, socket) {
    this.camera = camera;
    this.socket = socket;
    Utils.logInfo("🎮 MovementController initialized");
  }

  /**
   * Calculate movement based on camera direction and input
   * @param {string} direction - "north", "south", "east", "west"
   * @returns {object} - {deltaX, deltaZ, moveAngle}
   */
  calculateMovement(direction) {
    if (!this.camera) {
      Utils.logError("❌ Camera not initialized");
      return null;
    }

    const cameraRotation = this.camera.getAttribute('rotation');
    const cameraYaw = cameraRotation.y;
    
    // Calculate movement angle based on camera direction
    let moveAngle = 0;
    
    switch (direction) {
      case "north": // W - Forward
        moveAngle = cameraYaw;
        break;
      case "south": // S - Backward
        moveAngle = cameraYaw + 180;
        break;
      case "west": // A - Left
        moveAngle = cameraYaw - 90;
        break;
      case "east": // D - Right
        moveAngle = cameraYaw + 90;
        break;
      default:
        Utils.logWarn(`⚠️ Unknown direction: ${direction}`);
        return null;
    }
    
    // Normalize angle
    moveAngle = ((moveAngle % 360) + 360) % 360;
    
    // Convert to radians
    const moveRad = (moveAngle * Math.PI) / 180;
    
    // Calculate deltas
    const deltaX = Math.sin(moveRad) * CONFIG.MOVE_SPEED;
    const deltaZ = -Math.cos(moveRad) * CONFIG.MOVE_SPEED;
    
    return { deltaX, deltaZ, moveAngle, cameraYaw };
  }

  /**
   * Attempt to move player
   * @param {string} direction - Movement direction
   * @returns {boolean} - Success status
   */
  movePlayer(direction) {
    if (!this.gameState.gameStarted) return false;

    const player = this.gameState.players[this.gameState.myPlayerId];
    if (!player) {
      Utils.logWarn("⚠️ Player not found");
      return false;
    }

    // Calculate movement
    const movement = this.calculateMovement(direction);
    if (!movement) return false;

    const { deltaX, deltaZ, moveAngle, cameraYaw } = movement;

    // Store old position
    const oldX = player.x;
    const oldZ = player.z;
    
    // Calculate new position
    const newX = Math.round((oldX + deltaX) * 10) / 10;
    const newZ = Math.round((oldZ + deltaZ) * 10) / 10;

    Utils.logDebug(`🎯 Move ${direction}: yaw=${cameraYaw.toFixed(1)}°, angle=${moveAngle.toFixed(1)}°`);

    // Check collision
    if (this.collisionUtils.checkWallCollisionWithRadius(newX, newZ, 0.25)) {
      Utils.logDebug(`🚫 Blocked at (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);
      return false;
    }

    // Update position
    player.x = newX;
    player.z = newZ;
    player.rotation = cameraYaw;
    player.direction = moveAngle;
    
    Utils.logInfo(`🚶 Moved: (${oldX.toFixed(1)}, ${oldZ.toFixed(1)}) → (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);

    // Broadcast to server
    this.broadcastPosition(newX, newZ, cameraYaw);

    return true;
  }

  /**
   * Broadcast position to server
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {number} rotation - Camera rotation
   */
  broadcastPosition(x, z, rotation) {
    if (!this.socket || !this.socket.isConnected()) {
      Utils.logError("❌ Socket not connected");
      return false;
    }

    const sent = this.socket.emit("move", {
      x: x,
      z: z,
      direction: rotation,
    });

    if (sent) {
      Utils.logDebug(`✅ Broadcast: (${x.toFixed(1)}, ${z.toFixed(1)}) rot=${rotation.toFixed(0)}°`);
    } else {
      Utils.logError("❌ Failed to broadcast position");
    }

    return sent;
  }

  /**
   * Get current camera rotation
   * @returns {number} - Camera yaw in degrees
   */
  getCameraRotation() {
    if (!this.camera) return 0;
    const rotation = this.camera.getAttribute('rotation');
    return rotation ? rotation.y : 0;
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MovementController;
}

// Global instance
window.MovementController = MovementController;