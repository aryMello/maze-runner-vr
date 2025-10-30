// Player Management and Rendering - FIXED WITH CAMERA SYNC
class PlayerManager {
  constructor() {
    this.playersContainer = document.getElementById("players");
    this.lastMoveTime = 0;
    this.footstepSound = null;
    this.collectSound = null;
    this.winSound = null;
    // Track player color assignments
    this.playerColorMap = {}; // playerId -> colorIndex
    this.nextColorIndex = 0;
    // Camera rotation tracking
    this.lastCameraRotation = 0;
    this.rotationUpdateInterval = null;
  }

  initSounds() {
    this.footstepSound = document.querySelector("#footstep-sound");
    this.collectSound = document.querySelector("#collect-sound");
    this.winSound = document.querySelector("#win-sound");
  }

  // NEW: Start tracking camera rotation for player head
  startCameraRotationSync() {
    if (this.rotationUpdateInterval) {
      clearInterval(this.rotationUpdateInterval);
    }
    
    const camera = document.querySelector("[camera]");
    if (!camera) {
      Utils.logWarn("⚠️ Camera not found for rotation sync");
      return;
    }
    
    // Update player rotation based on camera every 100ms
    this.rotationUpdateInterval = setInterval(() => {
      if (!gameState.gameStarted || !gameState.myPlayerId) return;
      
      const cameraRotation = camera.getAttribute('rotation');
      if (!cameraRotation) return;
      
      const currentYaw = cameraRotation.y;
      
      // Always update visual rotation (no threshold needed)
      this.lastCameraRotation = currentYaw;
      this.updateMyPlayerRotation(currentYaw);
    }, 100);
    
    Utils.logInfo("🔄 Camera rotation sync started");
  }

  // NEW: Stop camera rotation sync
  stopCameraRotationSync() {
    if (this.rotationUpdateInterval) {
      clearInterval(this.rotationUpdateInterval);
      this.rotationUpdateInterval = null;
      Utils.logInfo("⏹️ Camera rotation sync stopped");
    }
  }

  // NEW: Update my player's visual rotation based on camera
  updateMyPlayerRotation(yaw) {
    const playerEl = document.getElementById(`player-${gameState.myPlayerId}`);
    if (!playerEl) return;
    
    // CRITICAL FIX: Player model should face OPPOSITE direction of camera
    // When camera looks north (0°), player model should face south (180°) so we see the front
    const playerModelRotation = (yaw + 180) % 360;
    
    // Update player entity rotation (inverted so we see the front of the player)
    playerEl.setAttribute("rotation", `0 ${playerModelRotation} 0`);
    
    // Store rotation in game state so it's sent with next move
    const myPlayer = gameState.players[gameState.myPlayerId];
    if (myPlayer) {
      myPlayer.rotation = yaw; // Store camera rotation (not model rotation)
    }
  }

  // Get consistent color index for a player
  getPlayerColorIndex(playerId) {
    if (this.playerColorMap[playerId] !== undefined) {
      return this.playerColorMap[playerId];
    }
    
    const colorIndex = this.nextColorIndex;
    this.playerColorMap[playerId] = colorIndex;
    this.nextColorIndex = (this.nextColorIndex + 1) % CONFIG.PLAYER_COLORS.length;
    
    Utils.logInfo(`🎨 Assigned color ${colorIndex} (${CONFIG.PLAYER_COLORS[colorIndex]}) to player ${playerId}`);
    return colorIndex;
  }

  updatePlayerEntities() {
    if (!this.playersContainer) {
      this.playersContainer = document.getElementById("players");
      if (!this.playersContainer) {
        Utils.logWarn("⚠️ Players container not ready yet");
        return;
      }
    }

    Utils.logInfo("🎨 Starting player entities rendering...");
    const playerArray = Object.values(gameState.players);
    Utils.logInfo(`📊 Total players to render: ${playerArray.length}`);

    playerArray.forEach((player) => {
      Utils.logDebug(
        `Processing player ${player.id} (${player.name}) at (${player.x}, ${player.z})`
      );
      const colorIdx = this.getPlayerColorIndex(player.id);
      this.updatePlayerEntity(player.id, colorIdx);
    });

    Utils.logInfo(`✅ Finished rendering ${playerArray.length} players`);
  }

  updatePlayerEntity(playerId, colorIdx) {
    const player = gameState.players[playerId];
    if (!player) {
      Utils.logWarn(`⚠️ Player ${playerId} not found in gameState`);
      return;
    }

    let playerEl = document.getElementById(`player-${playerId}`);

    if (colorIdx === undefined) {
      colorIdx = this.getPlayerColorIndex(playerId);
    }

    if (!playerEl) {
      Utils.logDebug(`Creating new entity for player ${playerId} (${player.name}) with color ${colorIdx}`);
      playerEl = this.createPlayerEntity(playerId, player, colorIdx);
      Utils.logDebug(`✅ Player entity created: player-${playerId}`);
    } else {
      Utils.logDebug(`Updating existing entity for player ${playerId} (${player.name})`);
      this.updatePlayerLabel(playerId);
    }

    // Calculate offset for centering
    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;

    const worldX = player.x * cellSize - offsetX;
    const worldZ = player.z * cellSize - offsetZ;

    // Update position with smooth animation
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

    Utils.logDebug(
      `Position set: grid (${player.x}, ${player.z}) -> world (${worldX}, 0.8, ${worldZ})`
    );

    // CRITICAL: Update rotation
    // For my player, rotation comes from camera (updated by startCameraRotationSync)
    // For other players, rotation comes from server data
    if (playerId !== gameState.myPlayerId) {
      if (player.rotation !== undefined) {
        // Use server-provided rotation (camera yaw from other player)
        // Invert it so we see the FRONT of their model (they're facing us)
        const modelRotation = (player.rotation + 180) % 360;
        playerEl.setAttribute("rotation", `0 ${modelRotation} 0`);
      } else if (player.direction !== undefined) {
        // Fallback to direction if rotation not provided
        if (typeof player.direction === "number") {
          const modelRotation = (player.direction + 180) % 360;
          playerEl.setAttribute("rotation", `0 ${modelRotation} 0`);
        } else {
          const rotations = { north: 180, east: 270, south: 0, west: 90 }; // Inverted
          playerEl.setAttribute("rotation", `0 ${rotations[player.direction] || 180} 0`);
        }
      }
    }
    // Note: My player's rotation is handled by updateMyPlayerRotation()
  }

  updatePlayerLabel(playerId) {
    const player = gameState.players[playerId];
    if (!player) return;
    
    const playerEl = document.getElementById(`player-${playerId}`);
    if (!playerEl) return;
    
    let label = playerEl.querySelector('a-text');
    
    if (!label) {
      Utils.logWarn(`⚠️ Label missing for ${player.name}, creating it...`);
      label = document.createElement('a-text');
      label.setAttribute('align', 'center');
      label.setAttribute('position', '0 2.2 0');
      label.setAttribute('scale', '1.5 1.5 1.5');
      label.setAttribute('color', '#FFFFFF');
      label.setAttribute('shader', 'msdf');
      playerEl.appendChild(label);
    }
    
    label.setAttribute('value', player.name);
    Utils.logDebug(`✅ Label updated for ${player.name}`);
  }

  createPlayerEntity(playerId, player, colorIdx) {
    const playerColor = CONFIG.PLAYER_COLORS[colorIdx % CONFIG.PLAYER_COLORS.length];
    
    Utils.logInfo(`🎨 Creating player ${player.name} with color ${playerColor} (index ${colorIdx})`);

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

    // Face direction indicator (nose/arrow)
    const nose = document.createElement("a-cone");
    nose.setAttribute("radius-bottom", "0.1");
    nose.setAttribute("radius-top", "0");
    nose.setAttribute("height", "0.3");
    nose.setAttribute("position", "0 1.1 -0.3"); // In FRONT of head (negative Z = forward in A-Frame)
    nose.setAttribute("rotation", "-90 0 0"); // Point forward (tip facing -Z direction)
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

  removePlayerEntity(playerId) {
    const playerEl = document.getElementById(`player-${playerId}`);
    if (playerEl) {
      playerEl.parentNode.removeChild(playerEl);
    }
    
    if (this.playerColorMap[playerId] !== undefined) {
      Utils.logDebug(`🗑️ Removed color assignment for player ${playerId}`);
      delete this.playerColorMap[playerId];
    }
  }

  playFootstep() {
    const currentTime = Date.now();
    if (currentTime - this.lastMoveTime > CONFIG.FOOTSTEP_INTERVAL) {
      if (
        this.footstepSound &&
        this.footstepSound.components &&
        this.footstepSound.components.sound
      ) {
        try {
          this.footstepSound.components.sound.playSound();
        } catch (e) {
          Utils.logDebug("Footstep sound not available");
        }
      }
      this.lastMoveTime = currentTime;
    }
  }

  playCollectSound() {
    if (
      this.collectSound &&
      this.collectSound.components &&
      this.collectSound.components.sound
    ) {
      try {
        this.collectSound.components.sound.playSound();
      } catch (e) {
        Utils.logDebug("Collect sound not available");
      }
    }
  }

  playWinSound() {
    if (
      this.winSound &&
      this.winSound.components &&
      this.winSound.components.sound
    ) {
      try {
        this.winSound.components.sound.playSound();
      } catch (e) {
        Utils.logDebug("Win sound not available");
      }
    }
  }

  logColorAssignments() {
    console.group("🎨 Player Color Assignments");
    Object.keys(this.playerColorMap).forEach(playerId => {
      const colorIdx = this.playerColorMap[playerId];
      const color = CONFIG.PLAYER_COLORS[colorIdx];
      const player = gameState.players[playerId];
      const name = player ? player.name : "Unknown";
      console.log(`${name} (${playerId}): Color ${colorIdx} = ${color}`);
    });
    console.groupEnd();
  }
}

// Create singleton instance
const playerManager = new PlayerManager();

// Expose globally
window.playerManager = playerManager;
window.PlayerManager = PlayerManager;