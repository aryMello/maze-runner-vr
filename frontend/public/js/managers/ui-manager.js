// UI Management
class UIManager {
  constructor() {
    this.elements = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    Utils.logInfo("🎨 Initializing UIManager...");
    this.setupElements();
    this.initialized = true;
    Utils.logInfo("✅ UIManager initialized");
  }

  setupElements() {
    Utils.logDebug("🔍 Caching DOM elements...");
    this.elements = {
      nameScreen: document.getElementById("nameScreen"),
      lobbyScreen: document.getElementById("lobbyScreen"),
      waitingScreen: document.getElementById("waitingScreen"),
      lobby: document.getElementById("lobby"),
      playerList: document.getElementById("playerList"),
      leaderboardList: document.getElementById("leaderboardList"),
      treasureCount: document.getElementById("treasureCount"),
      timer: document.getElementById("timer"),
      countdown: document.getElementById("countdown"),
      roomCodeDisplay: document.getElementById("roomCodeDisplay"),
      roomCode: document.getElementById("roomCode"),
      playerNameInput: document.getElementById("playerNameInput"),
    };

    Utils.logDebug("DOM elements cached:", {
      nameScreen: !!this.elements.nameScreen,
      lobbyScreen: !!this.elements.lobbyScreen,
      waitingScreen: !!this.elements.waitingScreen,
      lobby: !!this.elements.lobby,
    });
  }

  ensureInit() {
    if (!this.initialized) {
      this.init();
    }
  }

  showNameScreen() {
    Utils.logDebug("📺 Showing name screen");
    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "block";
    }
    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "none";
    }
  }

  showLobbyScreen() {
    Utils.logInfo("📺 Showing lobby screen");
    Utils.logDebug("Name screen element:", !!this.elements.nameScreen);
    Utils.logDebug("Lobby screen element:", !!this.elements.lobbyScreen);

    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "none";
      Utils.logDebug("✅ Name screen hidden");
    }

    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "block";
      Utils.logDebug("✅ Lobby screen shown");
    }
  }

  hideLobby() {
    Utils.logInfo("🚪 Hiding all lobby elements...");
    
    // Hide the main lobby container
    if (this.elements.lobby) {
      this.elements.lobby.style.display = "none";
      this.elements.lobby.classList.add("hidden");
      Utils.logDebug("✅ Lobby container hidden");
    }
    
    // Hide all individual lobby screens
    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "none";
      Utils.logDebug("✅ Name screen hidden");
    }
    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "none";
      Utils.logDebug("✅ Lobby screen hidden");
    }
    if (this.elements.waitingScreen) {
      this.elements.waitingScreen.style.display = "none";
      Utils.logDebug("✅ Waiting screen hidden");
    }
    
    // Hide lobbyContainer if it exists
    if (this.elements.lobbyContainer) {
      this.elements.lobbyContainer.style.display = "none";
      Utils.logDebug("✅ Lobby container element hidden");
    }
    
    // Hide overlay if it exists
    if (this.elements.overlay) {
      this.elements.overlay.style.display = "none";
      Utils.logDebug("✅ Overlay hidden");
    }
    
    // Ensure A-Frame scene is visible
    const scene = document.querySelector("a-scene");
    if (scene) {
      scene.style.display = "block";
      scene.style.visibility = "visible";
      Utils.logDebug("✅ A-Frame scene made visible");
    }
    
    Utils.logInfo("✅ All lobby elements hidden, game scene visible");
  }

  showWaitingRoom(roomCode) {
    Utils.logInfo("🚪 Showing waiting room with code:", roomCode);
    
    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "none";
      Utils.logDebug("✅ Name screen hidden");
    }
    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "none";
      Utils.logDebug("✅ Lobby screen hidden");
    }
    
    if (this.elements.waitingScreen) {
      this.elements.waitingScreen.style.display = "block";
      Utils.logDebug("✅ Waiting screen shown");
    }
    
    if (this.elements.lobby) {
      this.elements.lobby.classList.remove("hidden");
      this.elements.lobby.style.display = "flex";
      Utils.logDebug("✅ Lobby container kept visible");
    }
    
    const currentRoom = document.getElementById("currentRoom");
    if (currentRoom) {
      currentRoom.textContent = `Código da Sala: ${roomCode}`;
      Utils.logDebug("✅ Room code displayed:", roomCode);
    }
    
    Utils.logInfo("✅ Waiting room display complete");
  }

  updateConnectionStatus(status) {
    const statusEl = document.getElementById("connectionStatus");
    if (statusEl) {
      statusEl.textContent =
        status === "connected" ? "🟢 Conectado" : "🔴 Desconectado";
      statusEl.className = `status ${status}`;
    }
  }

  updatePlayerList() {
    Utils.logInfo("📋 Updating player list UI...");
    
    const listEl = this.elements.playerList;
    if (!listEl) {
      Utils.logError("❌ playerList element not found!");
      return;
    }

    const playerArray = Object.values(gameState.players);
    Utils.logInfo(`👥 Found ${playerArray.length} players to display`);
    
    playerArray.forEach((player, idx) => {
      Utils.logDebug(`  ${idx + 1}. ${player.name} - Ready: ${player.ready ? '✅' : '⏸️'}`);
    });

    listEl.innerHTML = "<h3>Jogadores na sala:</h3>";

    playerArray.forEach((player, idx) => {
      const item = document.createElement("div");
      item.className = "player-item";
      item.style.borderLeft = `5px solid ${
        CONFIG.PLAYER_COLORS[idx % CONFIG.PLAYER_COLORS.length]
      }`;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = player.name;
      item.appendChild(nameSpan);

      const isReady = player.ready === true;
      Utils.logDebug(`  → ${player.name}: ready=${player.ready}, isReady=${isReady}`);
      
      if (isReady) {
        const readySpan = document.createElement("span");
        readySpan.className = "player-ready";
        readySpan.textContent = "✓ PRONTO";
        readySpan.style.color = "#4CAF50";
        readySpan.style.fontWeight = "bold";
        item.appendChild(readySpan);
        Utils.logDebug(`    ✅ Added PRONTO badge for ${player.name}`);
      } else {
        Utils.logDebug(`    ⏸️ No badge for ${player.name} (not ready)`);
      }

      listEl.appendChild(item);
    });
    
    Utils.logInfo(`✅ Player list UI updated with ${playerArray.length} players`);
  }

  updateLeaderboard() {
    const listEl = this.elements.leaderboardList;
    if (!listEl) return;

    listEl.innerHTML = "";
    const playerArray = Object.values(gameState.players).sort(
      (a, b) => (b.treasures || 0) - (a.treasures || 0)
    );

    playerArray.forEach((player, idx) => {
      const item = document.createElement("div");
      item.className = "leaderboard-item";

      const rank =
        idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
      const nameSpan = document.createElement("span");
      nameSpan.textContent = `${rank} ${player.name}`;

      const scoreSpan = document.createElement("span");
      const totalTreasures = gameState.treasures.length;
      scoreSpan.textContent = `${player.treasures || 0}/${totalTreasures}`;
      scoreSpan.style.color =
        CONFIG.PLAYER_COLORS[
          playerArray.indexOf(player) % CONFIG.PLAYER_COLORS.length
        ];

      item.appendChild(nameSpan);
      item.appendChild(scoreSpan);
      listEl.appendChild(item);
    });
  }

  updateTreasureCount() {
    if (this.elements.treasureCount) {
      const totalTreasures = gameState.treasures.length;
      this.elements.treasureCount.textContent = `${gameState.myTreasureCount}/${totalTreasures}`;
    }
  }

  updateTimer() {
    if (!gameState.gameStarted || !gameState.startTime) return;

    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    if (this.elements.timer) {
      this.elements.timer.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
  }

  showCountdown() {
    const countdownEl = this.elements.countdown;
    if (!countdownEl) return;

    let count = CONFIG.COUNTDOWN_START;
    countdownEl.style.display = "block";
    countdownEl.textContent = count;

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.textContent = count;
      } else if (count === 0) {
        countdownEl.textContent = "VAI!";
      } else {
        countdownEl.style.display = "none";
        clearInterval(interval);
        gameState.gameStarted = true;
        gameState.startTime = Date.now();
      }
    }, CONFIG.COUNTDOWN_INTERVAL);
  }

  showCollectionFeedback() {
    const feedback = document.createElement("div");
    feedback.className = "collection-feedback";
    feedback.textContent = "+1 ⭐";
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 3em;
      font-weight: bold;
      color: #FFD700;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      pointer-events: none;
      z-index: 10000;
      animation: collectFeedback 1s ease-out forwards;
    `;
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1000);
  }

  updateReadyButton(isReady) {
    const readyBtn = document.getElementById("readyBtn");
    if (readyBtn) {
      readyBtn.textContent = isReady ? "Não Pronto" : "Pronto";
      readyBtn.style.background = isReady
        ? "#FF9800"
        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      Utils.logInfo(`🔘 Ready button updated: ${isReady ? 'NOT READY' : 'READY'}`);
    }
  }
}

// Create singleton instance
const uiManager = new UIManager();

// Expose globally
window.uiManager = uiManager;
window.UIManager = UIManager;