// ========================================
// GAME CONTROLLER (Refactored)
// Orchestrates game initialization and loop
// Delegates to specialized controllers
// ========================================

class GameController {
  constructor() {
    this.socket = null;
    this.scene = null;
    this.camera = null;
    
    // Controllers
    this.movementController = null;
    this.inputController = null;
    this.cameraController = null;
    
    // Gaze system
    this.raycaster = null;
    this.gazeTarget = null;
    this.gazeStartTime = 0;
    this.gazeThreshold = 1500;
    this.isCollecting = false;
    this.gazeProgressBar = null;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Set WebSocket client
   * @param {WSClient} socket
   */
  setSocket(socket) {
    this.socket = socket;
  }

  /**
   * Initialize game
   */
  initGame() {
    Utils.logInfo("🎮 Initializing game...");
    
    this.scene = document.querySelector("a-scene");
    this.camera = document.querySelector("[camera]");
    
    if (!this.camera) {
      Utils.logError("❌ Camera not found!");
      return;
    }
    
    // Initialize controllers
    this.initControllers();
    
    // Position camera at player start
    const player = gameState.players[gameState.myPlayerId];
    if (player) {
      this.cameraController.positionAtPlayer(player.x, player.z);
      Utils.logInfo(`📹 Camera positioned at (${player.x}, ${player.z})`);
    }
    
    // Initialize gaze system
    this.initGazeSystem();
    
    // Render game world
    this.renderWorld();
    
    // Start game systems
    this.startGameLoop();
    this.startTimer();
    
    Utils.logInfo("✅ Game initialized");
  }

  /**
 * Initialize all controllers (UPDATED WITH VR SUPPORT)
 */
  initControllers() {
    Utils.logInfo("🎮 Initializing controllers...");
    
    // Movement controller
    this.movementController = new MovementController(gameState, collisionUtils);
    this.movementController.init(this.camera, this.socket);
    
    // VR controller (head-based movement)
    if (window.VRMovementController) {
      this.vrMovementController = new VRMovementController(
        this.movementController, 
        gameState
      );
      this.vrMovementController.init(this.camera);
      Utils.logInfo("✅ VR head movement enabled");
    }
    
    // Keyboard controller
    this.inputController = new InputController(this.movementController);
    this.inputController.init();
    Utils.logInfo("✅ Keyboard controls enabled");
    
    // Camera controller
    this.cameraController = new CameraController(gameState, coordinateUtils);
    this.cameraController.init(this.camera);
    
    // Player manager camera sync
    playerManager.init(this.camera);
    playerManager.startCameraRotationSync();
    
    Utils.logInfo("✅ Controllers initialized (Keyboard + VR)");
  }

  /**
   * Render game world
   */
  renderWorld() {
    Utils.logInfo("🎨 Rendering game world...");
    
    // Render maze
    if (gameState.maze && gameState.maze.length > 0) {
      mazeManager.renderMaze();
    }
    
    // Render treasures
    if (gameState.treasures && gameState.treasures.length > 0) {
      if (window.treasureManager) {
        treasureManager.setTreasures(gameState.treasures);
        treasureManager.renderTreasures();
        treasureManager.startProximityCheck();
      } else {
        mazeManager.renderTreasures();
      }
    }
    
    // Render players
    if (Object.keys(gameState.players).length > 0) {
      playerManager.updatePlayerEntities();
    }
    
    // Update UI
    uiManager.updateLeaderboard();
    playerManager.initSounds();
    
    const totalTreasures = gameState.treasures.length;
    if (uiManager.elements.treasureCount) {
      uiManager.elements.treasureCount.textContent = `0/${totalTreasures}`;
    }
    
    uiManager.showCountdown();
    
    Utils.logInfo("✅ World rendered");
  }

  // ========================================
  // GAZE SYSTEM
  // ========================================

  /**
   * Initialize gaze collection system
   */
  initGazeSystem() {
    Utils.logInfo("👁️ Initializing gaze system...");
    
    if (!this.camera.components.raycaster) {
      this.camera.setAttribute("raycaster", {
        objects: ".treasure",
        far: 10,
        interval: 100
      });
    }
    
    this.raycaster = this.camera.components.raycaster;
    this.createGazeProgressBar();
    
    Utils.logInfo("✅ Gaze system initialized");
  }

  /**
   * Create gaze progress bar
   */
  createGazeProgressBar() {
    const progressBar = document.createElement("div");
    progressBar.id = "gazeProgress";
    progressBar.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 200px;
      height: 8px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      overflow: hidden;
      display: none;
      z-index: 1000;
      border: 2px solid rgba(255, 255, 255, 0.5);
    `;
    
    const progressFill = document.createElement("div");
    progressFill.id = "gazeProgressFill";
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #FFD700, #FFA500);
      transition: width 0.1s linear;
      box-shadow: 0 0 10px #FFD700;
    `;
    
    progressBar.appendChild(progressFill);
    document.body.appendChild(progressBar);
    
    this.gazeProgressBar = progressBar;
  }

  /**
   * Update gaze collection
   */
  updateGazeCollection() {
    if (!this.raycaster) return;
    
    const intersections = this.raycaster.intersections;
    const treasureIntersection = intersections.find(intersection => {
      return intersection.object.el && intersection.object.el.classList.contains("treasure");
    });
    
    if (treasureIntersection) {
      const treasureEl = treasureIntersection.object.el;
      const treasureId = treasureEl.id;
      
      const treasure = gameState.treasures.find(t => t.id === treasureId);
      if (!treasure || treasure.collected) {
        this.resetGaze();
        return;
      }
      
      if (this.gazeTarget !== treasureId) {
        this.gazeTarget = treasureId;
        this.gazeStartTime = Date.now();
        this.isCollecting = true;
        this.showGazeProgress();
      } else {
        const elapsed = Date.now() - this.gazeStartTime;
        const progress = Math.min((elapsed / this.gazeThreshold) * 100, 100);
        
        const progressFill = document.getElementById("gazeProgressFill");
        if (progressFill) {
          progressFill.style.width = `${progress}%`;
        }
        
        if (elapsed >= this.gazeThreshold && this.isCollecting) {
          this.isCollecting = false;
          this.collectTreasure(treasureId);
        }
      }
    } else {
      this.resetGaze();
    }
  }

  /**
   * Show gaze progress
   */
  showGazeProgress() {
    if (this.gazeProgressBar) {
      this.gazeProgressBar.style.display = "block";
    }
  }

  /**
   * Hide gaze progress
   */
  hideGazeProgress() {
    if (this.gazeProgressBar) {
      this.gazeProgressBar.style.display = "none";
    }
    const progressFill = document.getElementById("gazeProgressFill");
    if (progressFill) {
      progressFill.style.width = "0%";
    }
  }

  /**
   * Reset gaze
   */
  resetGaze() {
    if (this.gazeTarget) {
      this.gazeTarget = null;
      this.gazeStartTime = 0;
      this.isCollecting = true;
      this.hideGazeProgress();
    }
  }

  /**
   * Collect treasure
   * @param {string} treasureId
   */
  collectTreasure(treasureId) {
    Utils.logInfo(`💎 Collecting treasure: ${treasureId}`);
    
    this.resetGaze();
    
    const treasure = gameState.treasures.find(t => t.id === treasureId);
    if (treasure) {
      treasure.collected = true;
    }
    
    const treasureEl = document.getElementById(treasureId);
    if (treasureEl && treasureEl.parentNode) {
      treasureEl.parentNode.removeChild(treasureEl);
    }
    
    if (this.socket) {
      this.socket.emit("treasure_collected", {
        playerId: gameState.myPlayerId,
        treasureId: treasureId
      });
    }
    
    playerManager.playCollectSound();
    uiManager.showCollectionFeedback();
    gameState.myTreasureCount++;
    uiManager.updateTreasureCount();
  }

  // ========================================
  // GAME LOOP
  // ========================================

  /**
   * Start game loop
   */
  startGameLoop() {
    Utils.logInfo("🔄 Starting game loop...");
    
    const loop = () => {
      if (gameState.gameStarted) {
        this.updateGazeCollection();
        uiManager.updateTimer();
      }
      requestAnimationFrame(loop);
    };
    
    loop();
  }

  /**
   * Start timer
   */
  startTimer() {
    setInterval(() => {
      uiManager.updateTimer();
    }, 1000);
  }

  // ========================================
  // EVENT HANDLERS
  // ========================================

  /**
   * Handle treasure collection event
   * @param {object} data
   */
  handleTreasureCollection(data) {
    const payload = data.payload || data;
    const treasureId = payload.treasureId;
    const playerId = payload.playerId;
    
    const treasure = gameState.treasures.find(t => t.id === treasureId);
    if (treasure) {
      treasure.collected = true;
    }
    
    mazeManager.removeTreasure(treasureId);
    
    if (payload.treasures !== undefined && gameState.players[playerId]) {
      gameState.players[playerId].treasures = payload.treasures;
    }
    
    if (playerId === gameState.myPlayerId) {
      gameState.myTreasureCount = payload.treasures || gameState.myTreasureCount;
      playerManager.playCollectSound();
      uiManager.showCollectionFeedback();
      uiManager.updateTreasureCount();
    }
    
    uiManager.updateLeaderboard();
  }

  /**
   * Handle game won event
   * @param {object} data
   */
  handleGameWon(data) {
    Utils.logInfo("🏆 Game won!");
    
    const payload = data.payload || data;
    const winnerId = payload.playerId || payload.winnerId;
    const winnerName = payload.playerName || payload.winnerName || 
                      gameState.players[winnerId]?.name || "Desconhecido";
    
    gameState.gameStarted = false;
    
    if (playerManager.stopCameraRotationSync) {
      playerManager.stopCameraRotationSync();
    }
    
    playerManager.playWinSound();

    let timeStr = "N/A";
    if (gameState.startTime) {
      const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    const message = winnerId === gameState.myPlayerId
      ? "🎉 Você venceu! 🎉"
      : `🏆 ${winnerName} venceu! 🏆`;

    const winModal = document.createElement("div");
    winModal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      z-index: 10000;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;
    winModal.innerHTML = `
      <h1 style="color: white; font-size: 3em; margin: 0;">${message}</h1>
      <p style="color: white; font-size: 1.5em; margin: 20px 0;">Tempo: ${timeStr}</p>
      <p style="color: white; font-size: 1.2em; margin: 10px 0;">Tesouros: ${payload.treasures || 0}</p>
      <button onclick="location.reload()" style="
        padding: 15px 40px;
        font-size: 1.2em;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
        margin-top: 20px;
      ">Jogar Novamente</button>
    `;
    document.body.appendChild(winModal);
  }
}

// Create singleton
const gameController = new GameController();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameController;
}

window.gameController = gameController;
window.GameController = GameController;