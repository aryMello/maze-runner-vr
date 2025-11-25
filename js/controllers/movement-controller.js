// ========================================
// MOVEMENT CONTROLLER (VR Enhanced)
// Handles all player movement logic with VR auto-walk support
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
    this.currentDirection = null;
    this.lastUpdateTime = 0;
    this.lastNetworkUpdate = 0;
    
    // Animation frame
    this.movementLoopId = null;
    
    // Collision tracking
    this.lastCollisionTime = 0;
    this.collisionCooldown = 100; // ms
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
    
    Utils.logInfo("🎮 MovementController initialized (VR enhanced)");
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
    if (!this.isMoving || !this.currentDirection) return;
    
    // Calculate delta time
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = timestamp;
      return;
    }
    
    const deltaTime = (timestamp - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = timestamp;
    
    // Get current player
    const player = this.gameState.players[this.gameState.myPlayerId];
    if (!player) {
      Utils.logWarn("⚠️ Player not found in updateMovement");
      return;
    }
    
    // Recalculate movement vector based on current camera direction
    const movement = this.calculateMovementVector(this.currentDirection);
    if (!movement) return;
    
    const { deltaX, deltaZ, cameraYaw } = movement;
    
    // Update velocity
    this.velocity.x = deltaX * CONFIG.MOVE_SPEED;
    this.velocity.z = deltaZ * CONFIG.MOVE_SPEED;
    
    // Update player rotation
    player.rotation = cameraYaw;
    
    // Calculate new position
    const newX = player.x + this.velocity.x * deltaTime;
    const newZ = player.z + this.velocity.z * deltaTime;
    
    // Check collision
    const hasCollision = this.collisionUtils.checkWallCollisionWithRadius(
      newX, 
      newZ, 
      CONFIG.PLAYER_RADIUS
    );
    
    if (!hasCollision) {
      // Update position
      player.x = newX;
      player.z = newZ;
      
      // Convert to world coordinates
      const { worldX, worldZ } = this.coordinateUtils.gridToWorld(newX, newZ);
      const cameraHeight = CONFIG.CAMERA_HEIGHT || 1.6;
      
      // Update camera rig/camera
      const target = this.cameraRig && this.cameraRig.id === 'rig' ? this.cameraRig : this.camera;
      if (target) {
        target.object3D.position.set(worldX, cameraHeight, worldZ);
      }
      
      // Update player entity
      const playerEl = document.getElementById(`player-${this.gameState.myPlayerId}`);
      if (playerEl) {
        playerEl.object3D.position.set(worldX, 0.8, worldZ);
        
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
      
      // Play footstep sound
      if (window.playerManager && Math.random() < 0.03) {
        window.playerManager.playFootstep();
      }
    } else {
      // Hit a wall - notify VR controller
      const now = Date.now();
      if (now - this.lastCollisionTime > this.collisionCooldown) {
        Utils.logDebug(`🚫 Collision at grid (${newX.toFixed(2)}, ${newZ.toFixed(2)})`);
        this.lastCollisionTime = now;
        
        // Notify VR controller if exists
        if (window.vrAutoWalkController) {
          window.vrAutoWalkController.onCollision();
        } else {
          // For non-VR, stop movement
          this.stopMovement();
        }
      }
    }
  }

  /**
   * Set movement velocity based on direction
   * @param {string} direction - "north", "south", "east", "west"
   */
  setMovementDirection(direction) {
    if (!this.gameState.gameStarted) return;
    
    this.currentDirection = direction;
    this.isMoving = true;
    
    const player = this.gameState.players[this.gameState.myPlayerId];
    if (player) {
      const mazeSize = this.gameState.maze ? this.gameState.maze.length : 0;
      Utils.logInfo(`🎯 Movement direction set: ${direction}`);
      Utils.logDebug(`   Position: (${player.x.toFixed(2)}, ${player.z.toFixed(2)})`);
      Utils.logDebug(`   Maze size: ${mazeSize}x${mazeSize}`);
    }
  }

  /**
   * Stop movement
   */
  stopMovement() {
    this.currentDirection = null;
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

    // Get camera's forward direction
    const cameraEl = this.camera.object3D;
    const forwardVector = new THREE.Vector3(0, 0, -1);
    forwardVector.applyQuaternion(cameraEl.quaternion);
    
    // Project to horizontal plane
    forwardVector.y = 0;
    forwardVector.normalize();
    
    // Calculate yaw
    const cameraYaw = Math.atan2(forwardVector.x, -forwardVector.z) * (180 / Math.PI);
    
    // Calculate movement angle
    let moveAngle = 0;
    
    switch (direction) {
      case "north": // Forward
        moveAngle = cameraYaw;
        break;
      case "south": // Backward
        moveAngle = cameraYaw + 180;
        break;
      case "west": // Left
        moveAngle = cameraYaw - 90;
        break;
      case "east": // Right
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
    
    // Calculate direction vector
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
   * @returns {number}
   */
  getCameraRotation() {
    if (!this.camera) return 0;
    const rotation = this.camera.getAttribute('rotation');
    return rotation ? rotation.y : 0;
  }

  /**
   * Check if currently moving
   * @returns {boolean}
   */
  isCurrentlyMoving() {
    return this.isMoving;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopMovementLoop();
    this.stopMovement();
  }

  queueServerUpdate(){
    // deprecated
  }

}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MovementController;
}

window.MovementController = MovementController;