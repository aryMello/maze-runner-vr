// ========================================
// GAME CONTROLLER (VR Enhanced)
// Orchestrates game initialization with VR support
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
    this.vrAutoWalkController = null;
    
    // Time limit
    this.timeLimit = 6 * 60 * 1000;
    this.timeLimitTimeout = null;
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
    
    // ✅ ADICIONAR: Inicializar score integration
    this.initScoreIntegration();
    
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
    
    // Render game world
    this.renderWorld();
    
    // Start game systems
    this.startGameLoop();
    this.startTimer();
    
    Utils.logInfo("✅ Game initialized");
  }

  /**
   * Initialize all controllers
   */
  initControllers() {
    // Movement controller
    this.movementController = new MovementController(
      gameState, 
      collisionUtils,
      coordinateUtils
    );
    this.movementController.init(this.camera, this.socket);
    
    // Camera controller
    this.cameraController = new CameraController(gameState, coordinateUtils);
    this.cameraController.init(this.camera);
    
    // VR Auto-Walk controller
    this.vrAutoWalkController = new VRAutoWalkController(
      this.movementController,
      this.cameraController
    );
    this.vrAutoWalkController.init();
    
    // Expose globally for collision detection
    window.vrAutoWalkController = this.vrAutoWalkController;
    
    // Input controller (for desktop mode)
    this.inputController = new InputController(this.movementController);
    this.inputController.init();
    
    // Player manager camera sync
    playerManager.init(this.camera);
    playerManager.startCameraRotationSync();
    
    Utils.logInfo("✅ Controllers initialized (VR enabled)");
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
    
    console.log("🎮 About to start ambient music...");
    
    // Start ambient music with delay to ensure A-Frame is ready
    setTimeout(() => {
      console.log("🎮 Starting ambient music (delayed)...");
      playerManager.startAmbientMusic();
    }, 1000);
    
    const totalTreasures = gameState.treasures.length;
    if (uiManager.elements.treasureCount) {
      uiManager.elements.treasureCount.textContent = `0/${totalTreasures}`;
    }
    
    uiManager.showCountdown();
    
    Utils.logInfo("✅ World rendered");
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
    
    this.startTimeLimit();
  }

  /**
   * Start time limit (6 minutes)
   */
  startTimeLimit() {
    Utils.logInfo("⏰ Starting 6-minute time limit...");
    
    this.timeLimitTimeout = setTimeout(() => {
      if (gameState.gameStarted) {
        Utils.logInfo("⏱️ Time limit reached!");
        this.handleTimeUp();
      }
    }, this.timeLimit);
  }

  /**
 * Initialize score integration
 */
  initScoreIntegration() {
    if (window.scoreIntegration) {
      // Extrair código da URL e inicializar
      const userCode = scoreIntegration.init();
      
      if (userCode) {
        Utils.logInfo("✅ Score integration initialized with code:", userCode);
      } else {
        Utils.logWarn("⚠️ No user code found - score saving may not work");
      }
    } else {
      Utils.logError("❌ scoreIntegration not loaded!");
    }
  }

  /**
 * Handle time up event
 */
  async handleTimeUp() {  // ✅ ADICIONAR async
    let winnerId = null;
    let maxTreasures = -1;
    let winnerName = "Ninguém";
    
    for (const [playerId, player] of Object.entries(gameState.players)) {
      if (player.treasures > maxTreasures) {
        maxTreasures = player.treasures;
        winnerId = playerId;
        winnerName = player.name;
      }
    }
    
    const myTreasures = gameState.players[gameState.myPlayerId]?.treasures || 0;
    
    // ✅ USAR await
    await this.handleGameWon({
      payload: {
        playerId: winnerId,
        playerName: winnerName,
        treasures: maxTreasures,
        timeUp: true,
        myTreasures: myTreasures
      }
    });
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
  async handleGameWon(data) {  // ✅ ADICIONAR async
    Utils.logInfo("🏆 Game won!");
    
    const payload = data.payload || data;
    const winnerId = payload.playerId || payload.winnerId;
    const winnerName = payload.playerName || payload.winnerName || 
                      gameState.players[winnerId]?.name || "Desconhecido";
    const isTimeUp = payload.timeUp || false;
    const myTreasures = payload.myTreasures !== undefined 
      ? payload.myTreasures 
      : (gameState.players[gameState.myPlayerId]?.treasures || 0);
    
    gameState.gameStarted = false;
    
    // Stop ambient music
    if (playerManager && playerManager.stopAmbientMusic) {
      playerManager.stopAmbientMusic();
    }
    
    // Clear time limit timeout
    if (this.timeLimitTimeout) {
      clearTimeout(this.timeLimitTimeout);
      this.timeLimitTimeout = null;
    }
    
    // Stop VR auto-walk
    if (this.vrAutoWalkController) {
      this.vrAutoWalkController.stopAutoWalk();
    }
    
    if (playerManager.stopCameraRotationSync) {
      playerManager.stopCameraRotationSync();
    }
    
    playerManager.playWinSound();
    
    // ✅ CORREÇÃO: Verificar se scoreIntegration existe e está inicializado
    if (window.scoreIntegration) {
      try {
        Utils.logInfo(`📊 Saving player score: ${myTreasures} treasures`);
        
        // ✅ USAR await ao invés de .then()
        const success = await scoreIntegration.saveScore(myTreasures);
        
        if (success) {
          Utils.logInfo("✅ Score saved successfully - API will handle redirect");
          // O scoreIntegration.saveScore() já mostra o modal e redireciona
          // Não fazer mais nada aqui
        } else {
          Utils.logWarn("⚠️ Score save failed, showing local win modal");
          this.showLocalWinModal(winnerId, winnerName, isTimeUp, myTreasures, payload.treasures);
        }
      } catch (error) {
        Utils.logError("❌ Error saving score:", error);
        this.showLocalWinModal(winnerId, winnerName, isTimeUp, myTreasures, payload.treasures);
      }
    } else {
      Utils.logWarn("⚠️ Score integration not available, showing local win modal");
      this.showLocalWinModal(winnerId, winnerName, isTimeUp, myTreasures, payload.treasures);
    }
  }

  /**
   * Show local win modal (fallback)
   * @param {string} winnerId
   * @param {string} winnerName
   * @param {boolean} isTimeUp
   * @param {number} myTreasures
   * @param {number} winnerTreasures
   */
  showLocalWinModal(winnerId, winnerName, isTimeUp, myTreasures, winnerTreasures) {

    let timeStr = "N/A";
    if (gameState.startTime) {
      const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    let message;
    if (isTimeUp) {
      message = winnerId === gameState.myPlayerId
        ? "⏰ Tempo Esgotado! Você venceu! 🎉"
        : `⏰ Tempo Esgotado! ${winnerName} venceu! 🏆`;
    } else {
      message = winnerId === gameState.myPlayerId
        ? "🎉 Você venceu! 🎉"
        : `🏆 ${winnerName} venceu! 🏆`;
    }

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
      <p style="color: white; font-size: 1.2em; margin: 10px 0;">Vencedor: ${winnerTreasures || 0} tesouros</p>
      <p style="color: white; font-size: 1.2em; margin: 10px 0;">Você: ${myTreasures} tesouros</p>
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

// NO FINAL DO ARQUIVO (últimas 10 linhas)
// Create singleton
const gameController = new GameController();

// Manter estas:
window.gameController = gameController;
window.GameController = GameController;