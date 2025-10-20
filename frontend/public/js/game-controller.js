// Game Controller - Handles game logic and player interactions
class GameController {
  constructor() {
    this.socket = null;
    this.camera = null;
    this.scene = null;
    this.raycaster = null;
    
    // Gaze collection system
    this.gazeTarget = null;
    this.gazeStartTime = 0;
    this.gazeThreshold = 1500; // 1.5 seconds
    this.isCollecting = false;
    this.gazeProgressBar = null;
  }

  setSocket(socket) {
    this.socket = socket;
  }

  // Collision detection
  checkWallCollision(x, z) {
    if (!gameState.maze || gameState.maze.length === 0) return false;

    const cellSize = gameState.cellSize;
    const offsetX = (gameState.maze[0].length * cellSize) / 2;
    const offsetZ = (gameState.maze.length * cellSize) / 2;

    const gridX = Math.floor((x + offsetX) / cellSize);
    const gridZ = Math.floor((z + offsetZ) / cellSize);

    if (
      gridZ < 0 ||
      gridZ >= gameState.maze.length ||
      gridX < 0 ||
      gridX >= gameState.maze[0].length
    ) {
      return true;
    }

    return gameState.maze[gridZ][gridX] === 1;
  }

  // Player movement
  movePlayer(direction) {
    if (!gameState.gameStarted) return;

    const player = gameState.players[gameState.myPlayerId];
    if (!player) return;

    let newX = player.x;
    let newZ = player.z;
    let directionAngle = player.direction || 0;

    switch (direction) {
      case "north":
        newZ -= CONFIG.MOVE_SPEED;
        directionAngle = 0;
        break;
      case "south":
        newZ += CONFIG.MOVE_SPEED;
        directionAngle = 180;
        break;
      case "west":
        newX -= CONFIG.MOVE_SPEED;
        directionAngle = 270;
        break;
      case "east":
        newX += CONFIG.MOVE_SPEED;
        directionAngle = 90;
        break;
    }

    if (!this.checkWallCollision(newX, newZ)) {
      this.socket.emit("move_player", {
        playerId: gameState.myPlayerId,
        roomCode: gameState.room,
        x: newX,
        z: newZ,
        direction: directionAngle,
      });

      playerManager.playFootstep();
    }
  }

  // Keyboard controls
  setupKeyboardControls() {
    document.addEventListener("keydown", (e) => {
      if (!gameState.gameStarted) return;

      switch (e.key) {
        case "w":
        case "W":
        case "ArrowUp":
          this.movePlayer("north");
          e.preventDefault();
          break;
        case "s":
        case "S":
        case "ArrowDown":
          this.movePlayer("south");
          e.preventDefault();
          break;
        case "a":
        case "A":
        case "ArrowLeft":
          this.movePlayer("west");
          e.preventDefault();
          break;
        case "d":
        case "D":
        case "ArrowRight":
          this.movePlayer("east");
          e.preventDefault();
          break;
      }
    });
  }

  // Initialize game
  initGame() {
    Utils.logInfo("🎮 Initializing game controller...");
    
    this.scene = document.querySelector("a-scene");
    this.camera = document.querySelector("[camera]");
    
    if (!this.camera) {
      Utils.logError("❌ Camera not found!");
      return;
    }
    
    // Initialize gaze system for treasure collection
    this.initGazeSystem();
    
    // Initialize existing game elements
    mazeRenderer.renderMaze();
    mazeRenderer.renderTreasures();
    playerManager.updatePlayerEntities();
    uiManager.updateLeaderboard();
    playerManager.initSounds();

    const totalTreasures = gameState.treasures.length;
    if (uiManager.elements.treasureCount) {
      uiManager.elements.treasureCount.textContent = `0/${totalTreasures}`;
    }

    uiManager.showCountdown();
    
    // Start game loop
    this.startGameLoop();
    this.startTimer();
    
    Utils.logInfo("✅ Game controller initialized");
  }

  // Initialize gaze collection system
  initGazeSystem() {
    Utils.logInfo("👁️ Initializing gaze collection system...");
    
    // Create raycaster on camera
    if (!this.camera.components.raycaster) {
      this.camera.setAttribute("raycaster", {
        objects: ".treasure",
        far: 10,
        interval: 100
      });
    }
    
    this.raycaster = this.camera.components.raycaster;
    
    // Create progress bar for gaze feedback
    this.createGazeProgressBar();
    
    Utils.logInfo("✅ Gaze system initialized");
  }

  createGazeProgressBar() {
    // Create a progress bar in the center of the screen
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
    
    Utils.logInfo("✅ Gaze progress bar created");
  }

  updateGazeCollection() {
    if (!this.raycaster) return;
    
    const intersections = this.raycaster.intersections;
    
    // Find if we're looking at a treasure
    const treasureIntersection = intersections.find(intersection => {
      return intersection.object.el && intersection.object.el.classList.contains("treasure");
    });
    
    if (treasureIntersection) {
      const treasureEl = treasureIntersection.object.el;
      const treasureId = treasureEl.id;
      
      // Check if treasure is already collected
      const treasure = gameState.treasures.find(t => t.id === treasureId);
      if (!treasure || treasure.collected) {
        this.resetGaze();
        return;
      }
      
      // Start or continue gaze
      if (this.gazeTarget !== treasureId) {
        // New target
        this.gazeTarget = treasureId;
        this.gazeStartTime = Date.now();
        this.isCollecting = true;
        this.showGazeProgress();
        Utils.logInfo(`👁️ Started gazing at treasure: ${treasureId}`);
      } else {
        // Continue gazing at same target
        const elapsed = Date.now() - this.gazeStartTime;
        const progress = Math.min((elapsed / this.gazeThreshold) * 100, 100);
        
        // Update progress bar
        const progressFill = document.getElementById("gazeProgressFill");
        if (progressFill) {
          progressFill.style.width = `${progress}%`;
        }
        
        // Check if collection is complete
        if (elapsed >= this.gazeThreshold && this.isCollecting) {
          this.isCollecting = false; // Prevent multiple collections
          this.collectTreasure(treasureId);
        }
      }
    } else {
      // No treasure in sight
      this.resetGaze();
    }
  }

  showGazeProgress() {
    if (this.gazeProgressBar) {
      this.gazeProgressBar.style.display = "block";
    }
  }

  hideGazeProgress() {
    if (this.gazeProgressBar) {
      this.gazeProgressBar.style.display = "none";
    }
    const progressFill = document.getElementById("gazeProgressFill");
    if (progressFill) {
      progressFill.style.width = "0%";
    }
  }

  resetGaze() {
    if (this.gazeTarget) {
      Utils.logDebug("👁️ Gaze reset");
      this.gazeTarget = null;
      this.gazeStartTime = 0;
      this.isCollecting = true;
      this.hideGazeProgress();
    }
  }

  collectTreasure(treasureId) {
    Utils.logInfo(`💎 Collecting treasure: ${treasureId}`);
    
    // Reset gaze immediately
    this.resetGaze();
    
    // Mark as collected locally (optimistic update)
    const treasure = gameState.treasures.find(t => t.id === treasureId);
    if (treasure) {
      treasure.collected = true;
    }
    
    // Remove from scene
    const treasureEl = document.getElementById(treasureId);
    if (treasureEl) {
      treasureEl.parentNode.removeChild(treasureEl);
      Utils.logInfo(`✅ Treasure ${treasureId} removed from scene`);
    }
    
    // Send to server with correct payload format
    if (this.socket) {
      this.socket.emit("treasure_collected", {
        playerId: gameState.myPlayerId,
        treasureId: treasureId
      });
      Utils.logInfo(`📤 Sent treasure_collected event to server`);
      Utils.logDebug(`📦 Payload: { playerId: "${gameState.myPlayerId}", treasureId: "${treasureId}" }`);
    }
    
    // Update UI
    playerManager.playCollectSound();
    uiManager.showCollectionFeedback();
    gameState.myTreasureCount++;
    uiManager.updateTreasureCount();
  }

  startGameLoop() {
    Utils.logInfo("🔄 Starting game loop...");
    
    const loop = () => {
      if (gameState.gameStarted) {
        // Update gaze collection
        this.updateGazeCollection();
        
        // Update timer
        uiManager.updateTimer();
      }
      
      requestAnimationFrame(loop);
    };
    
    loop();
    Utils.logInfo("✅ Game loop started");
  }

  // Timer
  startTimer() {
    setInterval(() => {
      uiManager.updateTimer();
    }, 1000);
  }

  // Event handlers
  handleTreasureCollection(data) {
    Utils.logInfo("💎 Treasure collected event received:", data);
    
    const payload = data.payload || data;
    const treasureId = payload.treasureId;
    const playerId = payload.playerId;
    
    // Mark treasure as collected
    const treasure = gameState.treasures.find(t => t.id === treasureId);
    if (treasure) {
      treasure.collected = true;
      Utils.logInfo(`✅ Marked treasure ${treasureId} as collected`);
    }
    
    // Remove from scene if still there
    mazeRenderer.removeTreasure(treasureId);
    
    // Update player's treasure count
    if (payload.treasures !== undefined && gameState.players[playerId]) {
      gameState.players[playerId].treasures = payload.treasures;
      Utils.logInfo(`📊 Player ${gameState.players[playerId].name} now has ${payload.treasures} treasures`);
    }
    
    // Update UI
    if (playerId === gameState.myPlayerId) {
      gameState.myTreasureCount = payload.treasures || gameState.myTreasureCount;
      playerManager.playCollectSound();
      uiManager.showCollectionFeedback();
      uiManager.updateTreasureCount();
    }
    
    uiManager.updateLeaderboard();
  }

  handleGameWon(data) {
    Utils.logInfo("🏆 Game won event received:", data);
    
    const payload = data.payload || data;
    const winnerId = payload.playerId || payload.winnerId;
    const winnerName = payload.playerName || gameState.players[winnerId]?.name || "Desconhecido";
    
    // Stop the game
    gameState.gameStarted = false;
    
    playerManager.playWinSound();

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
      <p style="color: white; font-size: 1.5em; margin: 20px 0;">Tempo: ${
        payload.time || "N/A"
      }</p>
      <button onclick="location.reload()" style="
        padding: 15px 40px;
        font-size: 1.2em;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
      ">Jogar Novamente</button>
    `;
    document.body.appendChild(winModal);
  }
}

// Create singleton instance
const gameController = new GameController();

// Expose globally
window.gameController = gameController;
window.GameController = GameController;