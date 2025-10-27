// Player Management and Rendering - FIXED VERSION
class PlayerManager {
  constructor() {
    this.playersContainer = document.getElementById("players");
    this.lastMoveTime = 0;
    this.footstepSound = null;
    this.collectSound = null;
    this.winSound = null;
    // NEW: Track player color assignments
    this.playerColorMap = {}; // playerId -> colorIndex
    this.nextColorIndex = 0;
  }

  initSounds() {
    this.footstepSound = document.querySelector("#footstep-sound");
    this.collectSound = document.querySelector("#collect-sound");
    this.winSound = document.querySelector("#win-sound");
  }

  // NEW: Get consistent color index for a player
  getPlayerColorIndex(playerId) {
    // If player already has a color assigned, use it
    if (this.playerColorMap[playerId] !== undefined) {
      return this.playerColorMap[playerId];
    }
    
    // Assign a new color to this player
    const colorIndex = this.nextColorIndex;
    this.playerColorMap[playerId] = colorIndex;
    this.nextColorIndex = (this.nextColorIndex + 1) % CONFIG.PLAYER_COLORS.length;
    
    Utils.logInfo(`🎨 Assigned color ${colorIndex} (${CONFIG.PLAYER_COLORS[colorIndex]}) to player ${playerId}`);
    return colorIndex;
  }

  updatePlayerEntities() {
    // Check if container exists (A-Frame scene loaded)
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
      // Use consistent color assignment
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

    // If colorIdx not provided, get it from map
    if (colorIdx === undefined) {
      colorIdx = this.getPlayerColorIndex(playerId);
    }

    if (!playerEl) {
      Utils.logDebug(`Creating new entity for player ${playerId} with color ${colorIdx}`);
      playerEl = this.createPlayerEntity(playerId, player, colorIdx);
      Utils.logDebug(`✅ Player entity created: player-${playerId}`);
    } else {
      Utils.logDebug(`Updating existing entity for player ${playerId}`);
    }

    // Calculate offset for centering (EXACT SAME as maze)
    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;

    // Apply EXACT SAME formula as walls: position = coord * cellSize - offset
    // Players come as grid coordinates (e.g., 1.5 means between cells 1 and 2)
    const worldX = player.x * cellSize - offsetX;
    const worldZ = player.z * cellSize - offsetZ;

    // Update position
    playerEl.setAttribute("position", `${worldX} 0.8 ${worldZ}`);
    Utils.logDebug(
      `Position set: grid (${player.x}, ${player.z}) -> world (${worldX}, 0.8, ${worldZ})`
    );

    // Update rotation
    if (player.direction !== undefined) {
      if (typeof player.direction === "number") {
        playerEl.setAttribute("rotation", `0 ${player.direction} 0`);
      } else {
        const rotations = { north: 0, east: 90, south: 180, west: 270 };
        playerEl.setAttribute(
          "rotation",
          `0 ${rotations[player.direction] || 0} 0`
        );
      }
    }
  }

  createPlayerEntity(playerId, player, colorIdx) {
    // Use the provided colorIdx (which is now consistently assigned)
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
    
    // Clean up color assignment
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

  // NEW: Debug method to show color assignments
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

// PATCH: Add this to PlayerManager to fix name labels

// Add this method to PlayerManager class:
PlayerManager.prototype.updatePlayerLabel = function(playerId) {
  const player = gameState.players[playerId];
  if (!player) return;
  
  const playerEl = document.getElementById(`player-${playerId}`);
  if (!playerEl) return;
  
  // Find or create label
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
  
  // Update label text
  label.setAttribute('value', player.name);
  Utils.logDebug(`✅ Label updated for ${player.name}`);
};

// Modified updatePlayerEntity method - replace the existing one
PlayerManager.prototype.updatePlayerEntity = function(playerId, colorIdx) {
  const player = gameState.players[playerId];
  if (!player) {
    Utils.logWarn(`⚠️ Player ${playerId} not found in gameState`);
    return;
  }

  let playerEl = document.getElementById(`player-${playerId}`);

  // If colorIdx not provided, get it from map
  if (colorIdx === undefined) {
    colorIdx = this.getPlayerColorIndex(playerId);
  }

  if (!playerEl) {
    Utils.logDebug(`Creating new entity for player ${playerId} (${player.name}) with color ${colorIdx}`);
    playerEl = this.createPlayerEntity(playerId, player, colorIdx);
    Utils.logDebug(`✅ Player entity created: player-${playerId}`);
  } else {
    Utils.logDebug(`Updating existing entity for player ${playerId} (${player.name})`);
    
    // CRITICAL: Always update the label when updating entity
    this.updatePlayerLabel(playerId);
  }

  // Calculate offset for centering (EXACT SAME as maze)
  const cellSize = gameState.cellSize;
  const mazeSize = gameState.maze ? gameState.maze.length : 25;
  const offsetX = (mazeSize * cellSize) / 2;
  const offsetZ = (mazeSize * cellSize) / 2;

  // Apply EXACT SAME formula as walls
  const worldX = player.x * cellSize - offsetX;
  const worldZ = player.z * cellSize - offsetZ;

  // Update position with smooth animation
  const currentPos = playerEl.getAttribute('position');
  if (currentPos) {
    const oldX = currentPos.x;
    const oldZ = currentPos.z;
    
    // Only animate if position actually changed
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
    // First time positioning - no animation
    playerEl.setAttribute('position', `${worldX} 0.8 ${worldZ}`);
  }

  Utils.logDebug(
    `Position set: grid (${player.x}, ${player.z}) -> world (${worldX}, 0.8, ${worldZ})`
  );

  // Update rotation
  if (player.direction !== undefined) {
    if (typeof player.direction === "number") {
      playerEl.setAttribute("rotation", `0 ${player.direction} 0`);
    } else {
      const rotations = { north: 0, east: 90, south: 180, west: 270 };
      playerEl.setAttribute(
        "rotation",
        `0 ${rotations[player.direction] || 0} 0`
      );
    }
  }
};

// Apply the patch
if (window.playerManager) {
  Utils.logInfo("🔧 Applying player label fix patch...");
  
  // Add the new method
  playerManager.updatePlayerLabel = PlayerManager.prototype.updatePlayerLabel;
  
  // Replace the updatePlayerEntity method
  playerManager.updatePlayerEntity = PlayerManager.prototype.updatePlayerEntity;
  
  Utils.logInfo("✅ Player label fix applied!");
  
  // Force refresh all player entities if game has started
  if (gameState.gameStarted && Object.keys(gameState.players).length > 0) {
    Utils.logInfo("🔄 Refreshing all player entities...");
    playerManager.updatePlayerEntities();
  }
} else {
  Utils.logWarn("⚠️ playerManager not available yet, patch will be applied when loaded");
}