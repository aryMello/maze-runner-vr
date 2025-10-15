// Player Management and Rendering
class PlayerManager {
  constructor() {
    this.playersContainer = document.getElementById("players");
    this.lastMoveTime = 0;
    this.footstepSound = null;
    this.collectSound = null;
    this.winSound = null;
  }

  initSounds() {
    this.footstepSound = document.querySelector("#footstep-sound");
    this.collectSound = document.querySelector("#collect-sound");
    this.winSound = document.querySelector("#win-sound");
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

    playerArray.forEach((player, idx) => {
      Utils.logDebug(
        `Processing player ${player.id} (${player.name}) at (${player.x}, ${player.z})`
      );
      this.updatePlayerEntity(player.id, idx);
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

    if (!playerEl) {
      Utils.logDebug(`Creating new entity for player ${playerId}`);
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
    const playerArray = Object.keys(gameState.players);
    const idx =
      colorIdx !== undefined ? colorIdx : playerArray.indexOf(playerId);

    const playerEl = document.createElement("a-entity");
    playerEl.setAttribute("id", `player-${playerId}`);

    // Body
    const body = document.createElement("a-cylinder");
    body.setAttribute("radius", "0.3");
    body.setAttribute("height", "1.6");
    body.setAttribute(
      "color",
      CONFIG.PLAYER_COLORS[idx % CONFIG.PLAYER_COLORS.length]
    );
    body.setAttribute("metalness", "0.3");
    body.setAttribute("roughness", "0.7");
    body.setAttribute("shadow", "cast: true");
    playerEl.appendChild(body);

    // Head
    const head = document.createElement("a-sphere");
    head.setAttribute("radius", "0.25");
    head.setAttribute("position", "0 1.1 0");
    head.setAttribute(
      "color",
      CONFIG.PLAYER_COLORS[idx % CONFIG.PLAYER_COLORS.length]
    );
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
}

// Create singleton instance
const playerManager = new PlayerManager();

// Expose globally
window.playerManager = playerManager;
window.PlayerManager = PlayerManager;
