// Game Controller - Main game logic
class GameController {
  constructor() {
    this.socket = null;
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

  // Check treasure collection
  checkTreasureCollection(x, z) {
    gameState.treasures.forEach((treasure) => {
      if (!treasure.collected) {
        const dx = Math.abs(x - treasure.x);
        const dz = Math.abs(z - treasure.z);
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < CONFIG.COLLECT_RADIUS) {
          Utils.logInfo(`Coletando tesouro ${treasure.id}`);
          this.socket.emit("collect_treasure", {
            roomCode: gameState.room,
            treasureId: treasure.id,
          });
        }
      }
    });
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
        roomCode: gameState.room,
        x: newX,
        z: newZ,
        direction: directionAngle,
      });

      playerManager.playFootstep();
      this.checkTreasureCollection(newX, newZ);
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

  // Timer
  startTimer() {
    setInterval(() => {
      uiManager.updateTimer();
    }, 1000);
  }

  // Initialize game
  initGame() {
    Utils.logInfo("Inicializando jogo...");
    Utils.logInfo("Maze:", gameState.maze);
    Utils.logInfo("Treasures:", gameState.treasures);
    Utils.logInfo("Players:", gameState.players);

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
    this.startTimer();
  }

  // Event handlers
  handleTreasureCollection(data) {
    gameState.collectTreasure(data.treasureId, data.playerId);
    mazeRenderer.removeTreasure(data.treasureId);

    if (data.playerId === gameState.myPlayerId) {
      playerManager.playCollectSound();
      uiManager.updateTreasureCount();
      uiManager.showCollectionFeedback();
    }

    // Update player treasure count from server
    if (data.treasures !== undefined && gameState.players[data.playerId]) {
      gameState.players[data.playerId].treasures = data.treasures;
    }

    uiManager.updateLeaderboard();
  }

  handleGameWon(data) {
    Utils.logInfo("Game won!", data);
    gameState.gameStarted = false;

    playerManager.playWinSound();

    const winnerName = gameState.players[data.winnerId]?.name || "Alguém";
    const message =
      data.winnerId === gameState.myPlayerId
        ? "🎉 Você venceu! 🎉"
        : `${winnerName} venceu!`;

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
        data.time || "N/A"
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

  setSocket(socket) {
    this.socket = socket;
  }
}

// Create singleton instance
const gameController = new GameController();

// Expose globally
window.gameController = gameController;
window.GameController = GameController;
