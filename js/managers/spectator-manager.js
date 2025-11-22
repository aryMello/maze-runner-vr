// ========================================
// SPECTATOR MANAGER
// Handles spectator mode functionality
// IMPORTANT: Spectators don't send "join" event to backend
// UPDATED: Relies on HTTP API for room state
// ========================================

class SpectatorManager {
  constructor() {
    this.isSpectator = false;
    this.droneHeight = 35;
    this.droneSpeed = 8;
    this.camera = null;
    this.cameraRig = null;
    this.droneControlsActive = false;
    
    this.droneVelocity = { x: 0, z: 0 };
    this.droneKeys = { w: false, a: false, s: false, d: false };
    this.droneLoopId = null;
    
    // Track if we've "silently" joined (connected but not as player)
    this.silentJoin = false;
    
    Utils.logInfo("👁️ SpectatorManager initialized");
  }

  getIsSpectator() {
    return this.isSpectator;
  }

  setSpectator(value) {
    this.isSpectator = value;
    Utils.logInfo(`👁️ Spectator mode: ${value ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if spectator should skip sending join event
   * This prevents backend from counting spectator as a player
   */
  shouldSkipJoin() {
    return this.isSpectator;
  }

  /**
   * Handle spectator "joining" - they connect but don't register as player
   * They receive game updates but aren't counted in player list
   */
  handleSpectatorConnection(socket, roomCode) {
    if (!this.isSpectator) return false;
    
    Utils.logInfo("👁️ Spectator connecting silently (not sending join)...");
    this.silentJoin = true;
    
    // Spectator still needs a local ID for tracking
    if (!gameState.myPlayerId) {
      gameState.setPlayerId("spectator-" + Math.random().toString(36).substr(2, 9));
    }
    
    // DON'T add spectator to gameState.players
    // They will see other players but won't be in the list themselves
    // The HTTP API call in main.js will populate players
    
    return true;
  }

  /**
   * Spectator marks ready - but doesn't send to backend
   * We fake the ready status locally
   */
  handleSpectatorReady() {
    if (!this.isSpectator) return false;
    
    gameState.isReady = !gameState.isReady;
    
    Utils.logInfo(`👁️ Spectator ready status (local only): ${gameState.isReady}`);
    return true;
  }

  initSpectatorMode(camera) {
    if (!this.isSpectator) return;
    
    this.camera = camera;
    this.cameraRig = camera.parentElement;
    
    Utils.logInfo("👁️ Initializing spectator drone view...");
    
    this.positionDroneCamera();
    this.setupDroneControls();
    this.startDroneLoop();
    this.hideLocalPlayer();
    this.updateSpectatorHUD();
    
    Utils.logInfo("✅ Spectator mode active - Drone view enabled");
  }

  positionDroneCamera() {
    const target = this.cameraRig && this.cameraRig.id === 'rig' ? this.cameraRig : this.camera;
    
    if (target) {
      target.object3D.position.set(0, this.droneHeight, 0);
      
      if (this.camera) {
        this.camera.setAttribute('rotation', '-90 0 0');
      }
    }
    
    Utils.logInfo(`📹 Drone positioned at height ${this.droneHeight}`);
  }

  setupDroneControls() {
    this.removeDroneControls();
    
    this.keyDownHandler = (e) => this.handleDroneKeyDown(e);
    this.keyUpHandler = (e) => this.handleDroneKeyUp(e);
    
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    
    this.droneControlsActive = true;
    Utils.logInfo("🎮 Drone controls enabled (WASD to pan, Q/E for height)");
  }

  removeDroneControls() {
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.keyUpHandler) {
      document.removeEventListener('keyup', this.keyUpHandler);
    }
    this.droneControlsActive = false;
  }

  handleDroneKeyDown(e) {
    if (!this.isSpectator || !gameState.gameStarted) return;
    
    const key = e.key.toLowerCase();
    
    if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      
      if (key === 'q') {
        this.droneHeight = Math.min(50, this.droneHeight + 2);
        this.updateDroneHeight();
      } else if (key === 'e') {
        this.droneHeight = Math.max(10, this.droneHeight - 2);
        this.updateDroneHeight();
      } else {
        this.droneKeys[key] = true;
      }
    }
  }

  handleDroneKeyUp(e) {
    if (!this.isSpectator) return;
    
    const key = e.key.toLowerCase();
    
    if (['w', 'a', 's', 'd'].includes(key)) {
      this.droneKeys[key] = false;
    }
  }

  updateDroneHeight() {
    const target = this.cameraRig && this.cameraRig.id === 'rig' ? this.cameraRig : this.camera;
    if (target) {
      const pos = target.object3D.position;
      target.object3D.position.set(pos.x, this.droneHeight, pos.z);
    }
  }

  startDroneLoop() {
    let lastTime = 0;
    
    const loop = (timestamp) => {
      if (!this.isSpectator) {
        this.droneLoopId = null;
        return;
      }
      
      const deltaTime = lastTime ? (timestamp - lastTime) / 1000 : 0;
      lastTime = timestamp;
      
      this.updateDroneMovement(deltaTime);
      
      this.droneLoopId = requestAnimationFrame(loop);
    };
    
    this.droneLoopId = requestAnimationFrame(loop);
  }

  stopDroneLoop() {
    if (this.droneLoopId) {
      cancelAnimationFrame(this.droneLoopId);
      this.droneLoopId = null;
    }
  }

  updateDroneMovement(deltaTime) {
    if (!gameState.gameStarted) return;
    
    const target = this.cameraRig && this.cameraRig.id === 'rig' ? this.cameraRig : this.camera;
    if (!target) return;
    
    let dx = 0, dz = 0;
    
    if (this.droneKeys.w) dz -= 1;
    if (this.droneKeys.s) dz += 1;
    if (this.droneKeys.a) dx -= 1;
    if (this.droneKeys.d) dx += 1;
    
    if (dx !== 0 || dz !== 0) {
      const length = Math.sqrt(dx * dx + dz * dz);
      dx = (dx / length) * this.droneSpeed * deltaTime;
      dz = (dz / length) * this.droneSpeed * deltaTime;
      
      const pos = target.object3D.position;
      
      const mazeSize = gameState.maze ? gameState.maze.length * CONFIG.CELL_SIZE / 2 : 50;
      const newX = Math.max(-mazeSize, Math.min(mazeSize, pos.x + dx));
      const newZ = Math.max(-mazeSize, Math.min(mazeSize, pos.z + dz));
      
      target.object3D.position.set(newX, this.droneHeight, newZ);
    }
  }

  hideLocalPlayer() {
    setTimeout(() => {
      const playerEl = document.getElementById(`player-${gameState.myPlayerId}`);
      if (playerEl) {
        playerEl.setAttribute('visible', 'false');
        Utils.logInfo("👻 Local player entity hidden (spectator)");
      }
    }, 500);
  }

  updateSpectatorHUD() {
    const controlsInfo = document.getElementById('controls-info');
    if (controlsInfo) {
      controlsInfo.innerHTML = `
        <strong>🎥 Modo Espectador (Drone)</strong><br>
        W/S = Norte/Sul | A/D = Oeste/Leste<br>
        Q = Subir | E = Descer<br>
        <small>Você está assistindo o jogo de cima!</small>
      `;
    }
    
    const treasureCount = document.getElementById('treasureCount');
    if (treasureCount) {
      treasureCount.parentElement.innerHTML = '<span style="color: #FFD700;">👁️ ESPECTADOR</span>';
    }
  }

  shouldExcludeFromGame() {
    return this.isSpectator;
  }

  /**
   * Remove spectator from local player list (for UI cleanup)
   */
  removeFromLocalPlayerList() {
    if (this.isSpectator && gameState.myPlayerId) {
      delete gameState.players[gameState.myPlayerId];
    }
  }

  destroy() {
    this.stopDroneLoop();
    this.removeDroneControls();
    this.isSpectator = false;
    this.silentJoin = false;
  }
}

const spectatorManager = new SpectatorManager();

window.spectatorManager = spectatorManager;
window.SpectatorManager = SpectatorManager;