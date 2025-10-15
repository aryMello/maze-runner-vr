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
    const playerArray = Object.values(gameState.players);
    playerArray.forEach((player, idx) => {
      this.updatePlayerEntity(player.id, idx);
    });
  }

  updatePlayerEntity(playerId, colorIdx) {
    const player = gameState.players[playerId];
    if (!player) return;

    let playerEl = document.getElementById(`player-${playerId}`);

    if (!playerEl) {
      playerEl = this.createPlayerEntity(playerId, player, colorIdx);
    }

    // Update position
    playerEl.setAttribute("position", `${player.x} 0.8 ${player.z}`);

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
