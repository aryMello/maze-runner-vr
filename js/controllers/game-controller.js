// ========================================
// GAME CONTROLLER (Spectator doesn't count as player)
// Orchestrates game initialization and loop
// UPDATED: Full spectator support
// ========================================

class GameController {
  constructor() {
    this.socket = null;
    this.scene = null;
    this.camera = null;
    
    this.movementController = null;
    this.inputController = null;
    this.cameraController = null;
    
    this.timeLimit = 5 * 60 * 1000;
    this.timeLimitTimeout = null;
  }

  setSocket(socket) {
    this.socket = socket;
  }

  initGame() {
    Utils.logInfo("🎮 Initializing game...");
    
    this.scene = document.querySelector("a-scene");
    this.camera = document.querySelector("[camera]");
    
    if (!this.camera) {
      Utils.logError("❌ Camera not found!");
      return;
    }
    
    const isSpectator = spectatorManager.getIsSpectator();
    Utils.logInfo(`👁️ Player mode: ${isSpectator ? 'SPECTATOR' : 'PLAYER'}`);
    
    if (isSpectator) {
      this.initSpectatorMode();
    } else {
      this.initControllers();
      
      const player = gameState.players[gameState.myPlayerId];
      if (player) {
        this.cameraController.positionAtPlayer(player.x, player.z);
        Utils.logInfo(`📹 Camera positioned at (${player.x}, ${player.z})`);
      }
    }
    
    this.renderWorld();
    this.startGameLoop();
    this.startTimer();
    
    Utils.logInfo("✅ Game initialized");
  }

  initSpectatorMode() {
    Utils.logInfo("👁️ Initializing spectator mode...");
    
    spectatorManager.initSpectatorMode(this.camera);
    
    this.cameraController = new CameraController(gameState, coordinateUtils);
    this.cameraController.init(this.camera);
    
    playerManager.init(this.camera);
    // Don't start camera rotation sync for spectator
    
    this.showSpectatorIndicator();
    
    if (window.treasureManager) {
      treasureManager.stopProximityCheck();
    }
    
    Utils.logInfo("✅ Spectator mode initialized");
  }

  showSpectatorIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'spectator-active-indicator';
    indicator.innerHTML = '👁️ MODO ESPECTADOR';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(156, 39, 176, 0.9);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-weight: bold;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(indicator);
  }

  initControllers() {
    this.movementController = new MovementController(
      gameState, 
      collisionUtils,
      coordinateUtils
    );
    this.movementController.init(this.camera, this.socket);
    
    this.inputController = new InputController(this.movementController);
    this.inputController.init();
    
    this.cameraController = new CameraController(gameState, coordinateUtils);
    this.cameraController.init(this.camera);
    
    playerManager.init(this.camera);
    playerManager.startCameraRotationSync();
    
    Utils.logInfo("✅ Controllers initialized");
  }

  renderWorld() {
    Utils.logInfo("🎨 Rendering game world...");
    
    if (gameState.maze && gameState.maze.length > 0) {
      mazeManager.renderMaze();
    }
    
    if (gameState.treasures && gameState.treasures.length > 0) {
      if (window.treasureManager) {
        treasureManager.setTreasures(gameState.treasures);
        treasureManager.renderTreasures();
        
        if (!spectatorManager.getIsSpectator()) {
          treasureManager.startProximityCheck();
        }
      } else {
        mazeManager.renderTreasures();
      }
    }
    
    if (Object.keys(gameState.players).length > 0) {
      playerManager.updatePlayerEntities();
    }
    
    uiManager.updateLeaderboard();
    playerManager.initSounds();
    
    const totalTreasures = gameState.treasures.length;
    if (uiManager.elements.treasureCount && !spectatorManager.getIsSpectator()) {
      uiManager.elements.treasureCount.textContent = `0/${totalTreasures}`;
    }
    
    uiManager.showCountdown();
    
    Utils.logInfo("✅ World rendered");
  }

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

  startTimer() {
    setInterval(() => {
      uiManager.updateTimer();
    }, 1000);
    
    this.startTimeLimit();
  }

  startTimeLimit() {
    Utils.logInfo("⏰ Starting 5-minute time limit...");
    
    this.timeLimitTimeout = setTimeout(() => {
      if (gameState.gameStarted) {
        Utils.logInfo("⏱️ Time limit reached!");
        this.handleTimeUp();
      }
    }, this.timeLimit);
  }

  handleTimeUp() {
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
    
    const myTreasures = spectatorManager.getIsSpectator() 
      ? 0 
      : (gameState.players[gameState.myPlayerId]?.treasures || 0);
    
    this.handleGameWon({
      payload: {
        playerId: winnerId,
        playerName: winnerName,
        treasures: maxTreasures,
        timeUp: true,
        myTreasures: myTreasures
      }
    });
  }

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
    
    if (playerId === gameState.myPlayerId && !spectatorManager.getIsSpectator()) {
      gameState.myTreasureCount = payload.treasures || gameState.myTreasureCount;
      playerManager.playCollectSound();
      uiManager.showCollectionFeedback();
      uiManager.updateTreasureCount();
    }
    
    uiManager.updateLeaderboard();
  }

  handleGameWon(data) {
    Utils.logInfo("🏆 Game won!");
    
    const payload = data.payload || data;
    const winnerId = payload.playerId || payload.winnerId;
    const winnerName = payload.playerName || payload.winnerName || 
                      gameState.players[winnerId]?.name || "Desconhecido";
    const isTimeUp = payload.timeUp || false;
    
    const isSpectator = spectatorManager.getIsSpectator();
    const myTreasures = isSpectator 
      ? 'N/A' 
      : (payload.myTreasures !== undefined 
          ? payload.myTreasures 
          : (gameState.players[gameState.myPlayerId]?.treasures || 0));
    
    gameState.gameStarted = false;
    
    if (this.timeLimitTimeout) {
      clearTimeout(this.timeLimitTimeout);
      this.timeLimitTimeout = null;
    }
    
    if (playerManager.stopCameraRotationSync) {
      playerManager.stopCameraRotationSync();
    }
    
    if (isSpectator) {
      spectatorManager.destroy();
    }
    
    playerManager.playWinSound();

    let timeStr = "N/A";
    if (gameState.startTime) {
      const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    let message;
    if (isSpectator) {
      message = isTimeUp 
        ? `⏰ Tempo Esgotado! ${winnerName} venceu! 🏆`
        : `🏆 ${winnerName} venceu! 🏆`;
    } else if (isTimeUp) {
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
      <p style="color: white; font-size: 1.2em; margin: 10px 0;">Vencedor: ${payload.treasures || 0} tesouros</p>
      ${isSpectator 
        ? '<p style="color: #FFD700; font-size: 1em; margin: 10px 0;">👁️ Você assistiu como espectador</p>' 
        : `<p style="color: white; font-size: 1.2em; margin: 10px 0;">Você: ${myTreasures} tesouros</p>`}
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

const gameController = new GameController();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameController;
}

window.gameController = gameController;
window.GameController = GameController;