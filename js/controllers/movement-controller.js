// ========================================
// MOVEMENT CONTROLLER (Smooth Continuous Movement)
// Handles all player movement logic with continuous motion
// ========================================

class MovementController {
  constructor(gameState, collisionUtils, coordinateUtils) {
    this.gameState = gameState;
    this.collisionUtils = collisionUtils;
    this.coordinateUtils = coordinateUtils || window.coordinateUtils;
    this.camera = null;
    this.socket = null;
    this.cameraRig = null;
    
    // Continuous movement state
    this.velocity = { x: 0, z: 0 };
    this.isMoving = false;
    this.lastUpdateTime = 0;
    this.lastNetworkUpdate = 0;
    
    // Animation frame
    this.movementLoopId = null;
  }

  /**
   * Initialize movement controller
   * @param {HTMLElement} camera - A-Frame camera element
   * @param {WSClient} socket - WebSocket client instance
   */
  init(camera, socket) {
    this.camera = camera;
    this.socket = socket;
    this.cameraRig = camera.parentElement;
    
    // Start continuous movement loop
    this.startMovementLoop();
    
    Utils.logInfo("🎮 MovementController initialized (continuous movement)");
  }

  /**
   * Start continuous movement update loop
   */
  startMovementLoop() {
    const loop = (timestamp) => {
      if (this.gameState.gameStarted) {
        this.updateMovement(timestamp);
      }
      this.movementLoopId = requestAnimationFrame(loop);
    };
    
    this.movementLoopId = requestAnimationFrame(loop);
    Utils.logInfo("🔄 Continuous movement loop started");
  }

  /**
   * Stop movement loop
   */
  stopMovementLoop() {
    if (this.movementLoopId) {
      cancelAnimationFrame(this.movementLoopId);
      this.movementLoopId = null;
    }
  }

  /**
   * Update movement based on current velocity
   * @param {number} timestamp - Current timestamp
   */
  updateMovement(timestamp) {
    if (!this.isMoving) return;
    
    // Calculate delta time
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = timestamp;
      return;
    }
    
    const deltaTime = (timestamp - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = timestamp;
    
    // Get current player
    const player = this.gameState.players[this.gameState.myPlayerId];
    if (!player) {
      Utils.logWarn("⚠️ Player not found in updateMovement");
      return;
    }
    
    // Calculate new position (GRID COORDINATES)
    const deltaX = this.velocity.x * deltaTime;
    const deltaZ = this.velocity.z * deltaTime;
    
    const oldX = player.x;
    const oldZ = player.z;
    const newX = player.x + deltaX;
    const newZ = player.z + deltaZ;
    
    // Check collision using grid coordinates
    if (!this.collisionUtils.checkWallCollisionWithRadius(newX, newZ, CONFIG.PLAYER_RADIUS)) {
      // Update position (in grid coordinates)
      player.x = newX;
      player.z = newZ;
      
      // Convert to world coordinates
      const { worldX, worldZ } = this.coordinateUtils.gridToWorld(newX, newZ);
      const cameraHeight = CONFIG.CAMERA_HEIGHT || 1.6;
      
      // Update camera rig/camera - this ensures smooth camera movement
      const target = this.cameraRig && this.cameraRig.id === 'rig' ? this.cameraRig : this.camera;
      if (target) {
        // Use object3D.position for smooth, direct updates without animation overhead
        target.object3D.position.set(worldX, cameraHeight, worldZ);
      }
      
      // Update player entity visual to match camera position EXACTLY
      const playerEl = document.getElementById(`player-${this.gameState.myPlayerId}`);
      if (playerEl) {
        // Use object3D.position for frame-perfect sync with camera
        playerEl.object3D.position.set(worldX, 0.8, worldZ);
        
        // Update rotation
        if (player.rotation !== undefined) {
          const modelRotation = (player.rotation + 180) % 360;
          playerEl.object3D.rotation.set(0, THREE.MathUtils.degToRad(modelRotation), 0);
        }
      }
      
      // Send position update to server (throttled)
      if (timestamp - this.lastNetworkUpdate >= CONFIG.POSITION_UPDATE_INTERVAL) {
        this.broadcastPosition(newX, newZ, player.rotation);
        this.lastNetworkUpdate = timestamp;
      }
      
      // Play footstep sound periodically
      if (window.playerManager && Math.random() < 0.03) {
        window.playerManager.playFootstep();
      }
    } else {
      Utils.logDebug(`🚫 Collision at grid (${newX.toFixed(2)}, ${newZ.toFixed(2)})`);
      // Hit a wall - stop movement
      this.stopMovement();
    }
  }

  /**
   * Update camera position directly (no animation for smooth movement)
   * @param {number} x - Grid X coordinate
   * @param {number} z - Grid Z coordinate
   */
  updateCameraPosition(x, z) {
    // This method is no longer used - camera update is inline in updateMovement
    // Kept for backwards compatibility
  }

  /**
   * Set movement velocity based on direction
   * @param {string} direction - "north", "south", "east", "west"
   */
  setMovementDirection(direction) {
    if (!this.gameState.gameStarted) return;
    
    const movement = this.calculateMovementVector(direction);
    if (!movement) return;
    
    const { deltaX, deltaZ, cameraYaw } = movement;
    
    // Set velocity (grid units per second)
    this.velocity.x = deltaX * CONFIG.MOVE_SPEED;
    this.velocity.z = deltaZ * CONFIG.MOVE_SPEED;
    this.isMoving = true;
    
    // Update player rotation
    const player = this.gameState.players[this.gameState.myPlayerId];
    if (player) {
      player.rotation = cameraYaw;
      
      // Log current position and maze info
      const mazeSize = this.gameState.maze ? this.gameState.maze.length : 0;
      Utils.logInfo(`🎯 Movement set: ${direction}`);
      Utils.logInfo(`   Position: (${player.x.toFixed(2)}, ${player.z.toFixed(2)})`);
      Utils.logInfo(`   Maze size: ${mazeSize}x${mazeSize}`);
      Utils.logInfo(`   Velocity: (${this.velocity.x.toFixed(2)}, ${this.velocity.z.toFixed(2)}) grid units/sec`);
    }
  }

  /**
   * Stop movement
   */
  stopMovement() {
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.isMoving = false;
    this.lastUpdateTime = 0;
    
    // Send final position to server
    const player = this.gameState.players[this.gameState.myPlayerId];
    if (player) {
      this.broadcastPosition(player.x, player.z, player.rotation);
    }
    
    Utils.logDebug("⏸️ Movement stopped");
  }

  /**
   * Calculate movement vector based on camera direction
   * @param {string} direction - "north", "south", "east", "west"
   * @returns {object} - {deltaX, deltaZ, cameraYaw}
   */
  calculateMovementVector(direction) {
    if (!this.camera) {
      Utils.logError("❌ Camera not initialized");
      return null;
    }

    // Get camera's forward direction vector (projected on horizontal plane)
    const cameraEl = this.camera.object3D;
    const forwardVector = new THREE.Vector3(0, 0, -1);
    forwardVector.applyQuaternion(cameraEl.quaternion);
    
    // Project to horizontal plane
    forwardVector.y = 0;
    forwardVector.normalize();
    
    // Calculate horizontal yaw from the forward vector
    const cameraYaw = Math.atan2(forwardVector.x, -forwardVector.z) * (180 / Math.PI);
    
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
    
    // Calculate normalized direction vector
    const deltaX = Math.sin(moveRad);
    const deltaZ = -Math.cos(moveRad);
    
    return { deltaX, deltaZ, moveAngle, cameraYaw };
  }

  /**
   * Broadcast position to server
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {number} rotation - Camera rotation
   */
  broadcastPosition(x, z, rotation) {
    if (!this.socket || !this.socket.isConnected()) {
      return false;
    }

    // Round to reduce precision spam
    const roundedX = Math.round(x * 100) / 100;
    const roundedZ = Math.round(z * 100) / 100;
    const roundedRotation = Math.round(rotation);

    const sent = this.socket.emit("move", {
      x: roundedX,
      z: roundedZ,
      direction: roundedRotation,
    });

    if (sent) {
      Utils.logDebug(`✅ Broadcast: (${roundedX.toFixed(2)}, ${roundedZ.toFixed(2)}) rot=${roundedRotation}°`);
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

  /**
   * Cleanup
   */
  destroy() {
    this.stopMovementLoop();
    this.stopMovement();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MovementController;
}

// Global instance
window.MovementController = MovementController;