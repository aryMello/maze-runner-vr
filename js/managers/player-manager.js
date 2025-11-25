// ========================================
// PLAYER MANAGER (Refactored)
// Manages player entities and rendering
// Camera rotation tracking moved to CameraController
// ========================================

class PlayerManager {
  constructor(gameState, coordinateUtils) {
    this.gameState = gameState;
    this.coordinateUtils = coordinateUtils;
    this.playersContainer = null;
    
    // Player color assignments
    this.playerColorMap = {};
    this.nextColorIndex = 0;
    
    // Sounds
    this.footstepSound = null;
    this.collectSound = null;
    this.winSound = null;
    this.ambientSound = null;
    this.lastMoveTime = 0;
    
    // Camera rotation tracking
    this.camera = null;
    this.rotationUpdateInterval = null;
    this.lastCameraRotation = 0;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize player manager
   * @param {HTMLElement} camera - A-Frame camera element
   */
  init(camera) {
    this.playersContainer = document.getElementById("players");
    this.camera = camera;
    
    if (!this.playersContainer) {
      Utils.logError("❌ Players container not found");
      return;
    }
    
    this.initSounds();
    Utils.logInfo("✅ PlayerManager initialized");
  }

  /**
   * Initialize sound elements
   */
  initSounds() {
    this.footstepSound = document.querySelector("#footstep-sound");
    this.collectSound = document.querySelector("#collect-sound");
    this.winSound = document.querySelector("#win-sound");
    this.ambientSound = document.querySelector("#ambient-sound");
    
    console.log("🔊 Sound elements check:");
    console.log("  - Footstep:", !!this.footstepSound);
    console.log("  - Collect:", !!this.collectSound);
    console.log("  - Win:", !!this.winSound);
    console.log("  - Ambient:", !!this.ambientSound);
    
    // Set up ambient sound for looping
    if (this.ambientSound) {
      this.ambientSound.loop = true;
      this.ambientSound.volume = 0.3; // Adjust volume as needed
      console.log("  - Ambient sound configured for looping");
    }
    
    // Set volumes for other sounds
    if (this.footstepSound) {
      this.footstepSound.volume = 0.4;
    }
    if (this.collectSound) {
      this.collectSound.volume = 0.6;
    }
    if (this.winSound) {
      this.winSound.volume = 0.7;
    }
    
    Utils.logInfo("🔊 Sound elements initialized");
  }

  /**
   * Start ambient music
   */
  startAmbientMusic() {
    console.log("🎵 startAmbientMusic called");
    console.log("  - ambientSound exists:", !!this.ambientSound);
    
    if (!this.ambientSound) {
      console.warn("⚠️ Ambient sound element not found");
      return;
    }
    
    // Play the ambient sound
    this.ambientSound.play().then(() => {
      console.log("✅ Ambient music started successfully");
      Utils.logInfo("🎵 Ambient music started");
    }).catch(e => {
      console.warn("⚠️ Could not start ambient music (user interaction may be required):", e.message);
      Utils.logWarn("⚠️ Ambient music requires user interaction to play");
    });
  }

  /**
   * Stop ambient music
   */
  stopAmbientMusic() {
    console.log("🔇 stopAmbientMusic called");
    
    if (this.ambientSound) {
      try {
        this.ambientSound.pause();
        this.ambientSound.currentTime = 0;
        console.log("✅ Ambient music stopped");
        Utils.logInfo("🔇 Ambient music stopped");
      } catch (e) {
        console.error("❌ Error stopping ambient music:", e);
        Utils.logDebug("Could not stop ambient music");
      }
    } else {
      console.warn("⚠️ Cannot stop - ambient sound not available");
    }
  }

  // ========================================
  // CAMERA ROTATION SYNC
  // ========================================

  /**
   * Start syncing player rotation with camera
   */
  startCameraRotationSync() {
    if (this.rotationUpdateInterval) {
      clearInterval(this.rotationUpdateInterval);
    }
    
    if (!this.camera) {
      Utils.logWarn("⚠️ Camera not initialized");
      return;
    }
    
    this.rotationUpdateInterval = setInterval(() => {
      if (!this.gameState.gameStarted || !this.gameState.myPlayerId) return;
      
      const cameraRotation = this.camera.getAttribute('rotation');
      if (!cameraRotation) return;
      
      const currentYaw = cameraRotation.y;
      this.lastCameraRotation = currentYaw;
      this.updateMyPlayerRotation(currentYaw);
    }, 100);
    
    Utils.logInfo("🔄 Camera rotation sync started");
  }

  /**
   * Stop camera rotation sync
   */
  stopCameraRotationSync() {
    if (this.rotationUpdateInterval) {
      clearInterval(this.rotationUpdateInterval);
      this.rotationUpdateInterval = null;
      Utils.logInfo("⏹️ Camera rotation sync stopped");
    }
  }

  /**
   * Update my player's rotation based on camera
   * @param {number} yaw - Camera yaw in degrees
   */
  updateMyPlayerRotation(yaw) {
    const playerEl = document.getElementById(`player-${this.gameState.myPlayerId}`);
    if (!playerEl) return;
    
    // Player model faces opposite direction (180°) so we see the front
    const playerModelRotation = (yaw + 180) % 360;
    playerEl.setAttribute("rotation", `0 ${playerModelRotation} 0`);
    
    // Store camera rotation in game state
    const myPlayer = this.gameState.players[this.gameState.myPlayerId];
    if (myPlayer) {
      myPlayer.rotation = yaw;
    }
  }

  // ========================================
  // PLAYER COLORS
  // ========================================

  /**
   * Get consistent color index for player
   * @param {string} playerId
   * @returns {number} - Color index
   */
  getPlayerColorIndex(playerId) {
    if (this.playerColorMap[playerId] !== undefined) {
      return this.playerColorMap[playerId];
    }
    
    const colorIndex = this.nextColorIndex;
    this.playerColorMap[playerId] = colorIndex;
    this.nextColorIndex = (this.nextColorIndex + 1) % CONFIG.PLAYER_COLORS.length;
    
    Utils.logDebug(`🎨 Assigned color ${colorIndex} to ${playerId}`);
    return colorIndex;
  }

  // ========================================
  // ENTITY MANAGEMENT
  // ========================================

  /**
   * Update all player entities
   */
  updatePlayerEntities() {
    if (!this.playersContainer) {
      this.playersContainer = document.getElementById("players");
      if (!this.playersContainer) {
        Utils.logWarn("⚠️ Players container not ready");
        return;
      }
    }

    const playerArray = Object.values(this.gameState.players);
    Utils.logDebug(`🎨 Updating ${playerArray.length} player entities`);

    playerArray.forEach((player) => {
      const colorIdx = this.getPlayerColorIndex(player.id);
      this.updatePlayerEntity(player.id, colorIdx);
    });
  }

  /**
   * Update single player entity
   * @param {string} playerId
   * @param {number} colorIdx
   */
  updatePlayerEntity(playerId, colorIdx) {
    const player = this.gameState.players[playerId];
    if (!player) {
      Utils.logWarn(`⚠️ Player ${playerId} not found`);
      return;
    }

    let playerEl = document.getElementById(`player-${playerId}`);

    if (colorIdx === undefined) {
      colorIdx = this.getPlayerColorIndex(playerId);
    }

    // Create or update entity
    if (!playerEl) {
      playerEl = this.createPlayerEntity(playerId, player, colorIdx);
    } else {
      this.updatePlayerLabel(playerId);
    }

    // Update position
    const { worldX, worldZ } = this.coordinateUtils.gridToWorld(player.x, player.z);
    
    const currentPos = playerEl.getAttribute('position');
    if (currentPos) {
      const oldX = currentPos.x;
      const oldZ = currentPos.z;
      
      if (Math.abs(oldX - worldX) > 0.01 || Math.abs(oldZ - worldZ) > 0.01) {
        playerEl.setAttribute('animation__move', {
          property: 'position',
          from: `${oldX} 0.8 ${oldZ}`,
          to: `${worldX} 0.8 ${worldZ}`,
          dur: 150,
          easing: 'easeOutQuad'
        });
      }
    } else {
      playerEl.setAttribute('position', `${worldX} 0.8 ${worldZ}`);
    }

    // Update rotation (skip for my own player - handled by camera sync)
    if (playerId !== this.gameState.myPlayerId) {
      if (player.rotation !== undefined) {
        const modelRotation = (player.rotation + 180) % 360;
        playerEl.setAttribute("rotation", `0 ${modelRotation} 0`);
      }
    }
  }

  /**
   * Create player entity
   * @param {string} playerId
   * @param {object} player
   * @param {number} colorIdx
   * @returns {HTMLElement}
   */
  createPlayerEntity(playerId, player, colorIdx) {
    const playerColor = CONFIG.PLAYER_COLORS[colorIdx % CONFIG.PLAYER_COLORS.length];
    
    Utils.logInfo(`🎨 Creating player ${player.name} with color ${playerColor}`);

    const playerEl = document.createElement("a-entity");
    playerEl.setAttribute("id", `player-${playerId}`);

    // Body
    const body = document.createElement("a-cylinder");
    body.setAttribute("radius", "0.3");
    body.setAttribute("height", "1.6");
    body.setAttribute("color", playerColor);
    body.setAttribute("metalness", "0.3");
    body.setAttribute("roughness", "0.7");
    body.setAttribute("shadow", "cast: true");
    playerEl.appendChild(body);

    // Head
    const head = document.createElement("a-sphere");
    head.setAttribute("radius", "0.25");
    head.setAttribute("position", "0 1.1 0");
    head.setAttribute("color", playerColor);
    head.setAttribute("metalness", "0.3");
    head.setAttribute("roughness", "0.7");
    playerEl.appendChild(head);

    // Nose (direction indicator)
    const nose = document.createElement("a-cone");
    nose.setAttribute("radius-bottom", "0.1");
    nose.setAttribute("radius-top", "0");
    nose.setAttribute("height", "0.3");
    nose.setAttribute("position", "0 1.1 -0.3");
    nose.setAttribute("rotation", "-90 0 0");
    nose.setAttribute("color", "#FFFFFF");
    playerEl.appendChild(nose);

    // Label
    const label = document.createElement("a-text");
    label.setAttribute("value", player.name);
    label.setAttribute("align", "center");
    label.setAttribute("position", "0 2.2 0");
    label.setAttribute("scale", "1.5 1.5 1.5");
    label.setAttribute("color", "#FFFFFF");
    label.setAttribute("shader", "msdf");
    playerEl.appendChild(label);

    this.playersContainer.appendChild(playerEl);
    return playerEl;
  }

  /**
   * Update player label
   * @param {string} playerId
   */
  updatePlayerLabel(playerId) {
    const player = this.gameState.players[playerId];
    if (!player) return;
    
    const playerEl = document.getElementById(`player-${playerId}`);
    if (!playerEl) return;
    
    let label = playerEl.querySelector('a-text');
    
    if (!label) {
      label = document.createElement('a-text');
      label.setAttribute('align', 'center');
      label.setAttribute('position', '0 2.2 0');
      label.setAttribute('scale', '1.5 1.5 1.5');
      label.setAttribute('color', '#FFFFFF');
      label.setAttribute('shader', 'msdf');
      playerEl.appendChild(label);
    }
    
    label.setAttribute('value', player.name);
  }

  /**
   * Remove player entity
   * @param {string} playerId
   */
  removePlayerEntity(playerId) {
    const playerEl = document.getElementById(`player-${playerId}`);
    if (playerEl && playerEl.parentNode) {
      playerEl.parentNode.removeChild(playerEl);
    }
    
    if (this.playerColorMap[playerId] !== undefined) {
      delete this.playerColorMap[playerId];
    }
  }

  // ========================================
  // SOUNDS
  // ========================================

  /**
   * Play footstep sound
   */
  playFootstep() {
    const currentTime = Date.now();
    if (currentTime - this.lastMoveTime > CONFIG.FOOTSTEP_INTERVAL) {
      if (this.footstepSound) {
        this.footstepSound.currentTime = 0;
        this.footstepSound.play().catch(() => {
          // Silently fail if sound cannot play
        });
      }
      this.lastMoveTime = currentTime;
    }
  }

  /**
   * Play collect sound
   */
  playCollectSound() {
    if (this.collectSound) {
      this.collectSound.currentTime = 0;
      this.collectSound.play().catch(() => {
        // Silently fail if sound cannot play
      });
    }
  }

  /**
   * Play win sound
   */
  playWinSound() {
    if (this.winSound) {
      this.winSound.currentTime = 0;
      this.winSound.play().catch(() => {
        // Silently fail if sound cannot play
      });
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerManager;
}

window.PlayerManager = PlayerManager;