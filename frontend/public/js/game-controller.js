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
    
    // Keyboard state for continuous movement
    this.keysPressed = {
      north: false,
      south: false,
      west: false,
      east: false
    };
    this.lastMoveTime = 0;
    this.moveInterval = 100; // Move every 100ms when key is held
  }

  setSocket(socket) {
    this.socket = socket;
  }

  // Collision detection - checks if position would collide with wall
  checkWallCollision(x, z) {
    if (!gameState.maze || gameState.maze.length === 0) return false;

    const cellSize = gameState.cellSize;
    const mazeWidth = gameState.maze[0].length;
    const mazeHeight = gameState.maze.length;
    const offsetX = (mazeWidth * cellSize) / 2;
    const offsetZ = (mazeHeight * cellSize) / 2;

    // Convert world coordinates to grid coordinates
    const worldX = x * cellSize - offsetX;
    const worldZ = z * cellSize - offsetZ;
    
    // Get grid cell
    const gridX = Math.floor((worldX + offsetX) / cellSize);
    const gridZ = Math.floor((worldZ + offsetZ) / cellSize);

    // Check bounds
    if (
      gridZ < 0 ||
      gridZ >= mazeHeight ||
      gridX < 0 ||
      gridX >= mazeWidth
    ) {
      Utils.logDebug(`🚫 Out of bounds: grid(${gridX}, ${gridZ})`);
      return true;
    }

    // Check if cell is a wall
    const isWall = gameState.maze[gridZ][gridX] === 1;
    
    if (isWall) {
      Utils.logDebug(`🧱 Wall detected at grid(${gridX}, ${gridZ})`);
    }
    
    return isWall;
  }
  
  // Additional collision check with player radius (for smoother collision)
  checkWallCollisionWithRadius(x, z, radius = 0.25) {
    // Check center point
    if (this.checkWallCollision(x, z)) return true;
    
    // Check corners of player's bounding box
    const offsets = [
      { dx: radius, dz: radius },
      { dx: radius, dz: -radius },
      { dx: -radius, dz: radius },
      { dx: -radius, dz: -radius }
    ];
    
    for (const offset of offsets) {
      if (this.checkWallCollision(x + offset.dx, z + offset.dz)) {
        return true;
      }
    }
    
    return false;
  }

  // Player movement with smooth interpolation
  movePlayer(direction) {
    if (!gameState.gameStarted) return;

    const player = gameState.players[gameState.myPlayerId];
    if (!player) return;

    // Store old position
    const oldX = player.x;
    const oldZ = player.z;
    
    // Calculate new position with EXACT 0.1 steps
    let newX = oldX;
    let newZ = oldZ;
    let directionAngle = player.direction || 0;

    // CRITICAL: Use exact decimal addition/subtraction
    switch (direction) {
      case "north":
        newZ = Math.round((oldZ - 0.1) * 10) / 10;
        directionAngle = 0;
        break;
      case "south":
        newZ = Math.round((oldZ + 0.1) * 10) / 10;
        directionAngle = 180;
        break;
      case "west":
        newX = Math.round((oldX - 0.1) * 10) / 10;
        directionAngle = 270;
        break;
      case "east":
        newX = Math.round((oldX + 0.1) * 10) / 10;
        directionAngle = 90;
        break;
    }

    // Debug log BEFORE collision check
    Utils.logDebug(`🎯 Attempting move ${direction}: (${oldX.toFixed(1)}, ${oldZ.toFixed(1)}) → (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);

    // CRITICAL: Check wall collision BEFORE moving
    if (this.checkWallCollisionWithRadius(newX, newZ, 0.25)) {
      Utils.logDebug(`🚫 BLOCKED! Wall collision at (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);
      return; // Don't move!
    }

    // No collision - safe to move!
    // Update local state FIRST (optimistic update)
    player.x = newX;
    player.z = newZ;
    player.direction = directionAngle;
    
    Utils.logInfo(`🚶 Moving ${direction}: (${oldX.toFixed(1)}, ${oldZ.toFixed(1)}) → (${newX.toFixed(1)}, ${newZ.toFixed(1)}) dir=${directionAngle}°`);

    // Move camera with smooth animation (POSITION ONLY - NO ROTATION)
    this.smoothMoveCameraToPlayer(oldX, oldZ, newX, newZ);

    // Broadcast to server with EXACT position
    const sent = this.socket.emit("player_update", {
      playerId: gameState.myPlayerId,
      roomCode: gameState.room,
      x: newX,
      z: newZ,
      direction: directionAngle,
    });

    if (sent) {
      Utils.logDebug(`✅ Broadcasted position: (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);
      
      // Update 3D entity locally
      const playerArray = Object.keys(gameState.players);
      const colorIdx = playerArray.indexOf(gameState.myPlayerId);
      playerManager.updatePlayerEntity(gameState.myPlayerId, colorIdx);
    } else {
      Utils.logError("❌ Failed to broadcast position!");
      // Rollback local state
      player.x = oldX;
      player.z = oldZ;
    }

    playerManager.playFootstep();
  }

  // Smooth camera movement WITHOUT rotation (FIXED!)
  smoothMoveCameraToPlayer(oldX, oldZ, newX, newZ) {
    if (!this.camera) return;

    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;
    
    // Calculate world positions
    const oldWorldX = oldX * cellSize - offsetX;
    const oldWorldZ = oldZ * cellSize - offsetZ;
    const newWorldX = newX * cellSize - offsetX;
    const newWorldZ = newZ * cellSize - offsetZ;
    
    // Get camera rig (parent of camera)
    const cameraRig = this.camera.parentElement;
    const targetElement = (cameraRig && cameraRig.id === 'rig') ? cameraRig : this.camera;
    
    // Camera height (eye level - on top of player's head)
    const cameraHeight = CONFIG.CAMERA_HEIGHT || 1.6;
    
    // ONLY animate position - NO rotation changes!
    targetElement.setAttribute('animation__move', {
      property: 'position',
      from: `${oldWorldX} ${cameraHeight} ${oldWorldZ}`,
      to: `${newWorldX} ${cameraHeight} ${newWorldZ}`,
      dur: CONFIG.CAMERA_SMOOTH_TIME || 150,
      easing: 'easeOutQuad'
    });
    
    // Remove any existing rotation animation
    targetElement.removeAttribute('animation__rotate');
    
    Utils.logDebug(`📹 Camera smoothly moving to (${newWorldX.toFixed(1)}, ${cameraHeight}, ${newWorldZ.toFixed(1)}) - Free look enabled`);
  }

  // Move camera to follow player (instant - used for initial positioning)
  moveCameraToPlayer(gridX, gridZ) {
    if (!this.camera) return;

    // Calculate world position (same formula as player rendering)
    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;
    
    const worldX = gridX * cellSize - offsetX;
    const worldZ = gridZ * cellSize - offsetZ;
    
    // Camera height (eye level)
    const cameraHeight = CONFIG.CAMERA_HEIGHT || 1.6;
    
    // Get camera rig (parent of camera)
    const cameraRig = this.camera.parentElement;
    if (cameraRig && cameraRig.id === 'rig') {
      cameraRig.setAttribute('position', `${worldX} ${cameraHeight} ${worldZ}`);
    } else {
      // If no rig, position camera directly
      this.camera.setAttribute('position', `${worldX} ${cameraHeight} ${worldZ}`);
    }
    
    Utils.logDebug(`📹 Camera positioned at (${worldX}, ${cameraHeight}, ${worldZ})`);
  }

  // Keyboard controls with continuous movement
  setupKeyboardControls() {
    document.addEventListener("keydown", (e) => {
      if (!gameState.gameStarted) return;
      
      let direction = null;
      
      switch (e.key) {
        case "w":
        case "W":
        case "ArrowUp":
          direction = "north";
          e.preventDefault();
          break;
        case "s":
        case "S":
        case "ArrowDown":
          direction = "south";
          e.preventDefault();
          break;
        case "a":
        case "A":
        case "ArrowLeft":
          direction = "west";
          e.preventDefault();
          break;
        case "d":
        case "D":
        case "ArrowRight":
          direction = "east";
          e.preventDefault();
          break;
      }
      
      if (direction && !this.keysPressed[direction]) {
        this.keysPressed[direction] = true;
        this.movePlayer(direction); // Immediate move on key press
      }
    });
    
    document.addEventListener("keyup", (e) => {
      if (!gameState.gameStarted) return;
      
      switch (e.key) {
        case "w":
        case "W":
        case "ArrowUp":
          this.keysPressed.north = false;
          break;
        case "s":
        case "S":
        case "ArrowDown":
          this.keysPressed.south = false;
          break;
        case "a":
        case "A":
        case "ArrowLeft":
          this.keysPressed.west = false;
          break;
        case "d":
        case "D":
        case "ArrowRight":
          this.keysPressed.east = false;
          break;
      }
    });
    
    // Continuous movement when key is held
    this.startContinuousMovement();
  }
  
  // Handle continuous movement when keys are held
  startContinuousMovement() {
    const updateMovement = () => {
      if (!gameState.gameStarted) {
        requestAnimationFrame(updateMovement);
        return;
      }
      
      const now = Date.now();
      
      // Rate limit movement
      if (now - this.lastMoveTime >= this.moveInterval) {
        // Check which direction is pressed (priority order)
        if (this.keysPressed.north) {
          this.movePlayer("north");
          this.lastMoveTime = now;
        } else if (this.keysPressed.south) {
          this.movePlayer("south");
          this.lastMoveTime = now;
        } else if (this.keysPressed.west) {
          this.movePlayer("west");
          this.lastMoveTime = now;
        } else if (this.keysPressed.east) {
          this.movePlayer("east");
          this.lastMoveTime = now;
        }
      }
      
      requestAnimationFrame(updateMovement);
    };
    
    updateMovement();
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
    
    // CRITICAL: Disable A-Frame's built-in WASD controls (we handle movement ourselves)
    const cameraEl = this.camera;
    if (cameraEl.hasAttribute('wasd-controls')) {
      cameraEl.setAttribute('wasd-controls', 'enabled: false');
      Utils.logInfo("🚫 Disabled A-Frame WASD controls");
    }
    
    // Get camera rig
    const cameraRig = cameraEl.parentElement;
    if (cameraRig && cameraRig.id === 'rig') {
      if (cameraRig.hasAttribute('wasd-controls')) {
        cameraRig.setAttribute('wasd-controls', 'enabled: false');
        Utils.logInfo("🚫 Disabled A-Frame WASD controls on rig");
      }
    }
    
    // Position camera at player's starting position
    const player = gameState.players[gameState.myPlayerId];
    if (player) {
      this.moveCameraToPlayer(player.x, player.z);
      
      // NO initial rotation setup - let player freely look around
      Utils.logInfo(`📹 Camera initialized at player position (${player.x}, ${player.z}) with free mouse look`);
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
    
    Utils.logInfo("✅ Game controller initialized with free camera look");
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