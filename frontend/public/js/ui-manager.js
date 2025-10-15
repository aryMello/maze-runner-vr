// UI Management
class UIManager {
  constructor() {
    this.elements = null;
    this.initialized = false;
  }

  // Initialize DOM elements - call this after DOM is ready
  init() {
    if (this.initialized) return;
    Utils.logInfo("🎨 Initializing UIManager...");
    this.setupElements();
    this.initialized = true;
    Utils.logInfo("✅ UIManager initialized");
  }

  setupElements() {
    // Cache DOM elements
    Utils.logDebug("🔍 Caching DOM elements...");
    this.elements = {
      nameScreen: document.getElementById("nameScreen"),
      lobbyScreen: document.getElementById("lobbyScreen"),
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
      lobby: !!this.elements.lobby,
    });
  }

  // Ensure elements are initialized before use
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
    } else {
      Utils.logError("❌ Name screen element not found!");
    }

    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "block";
      Utils.logDebug("✅ Lobby screen shown");
    } else {
      Utils.logError("❌ Lobby screen element not found!");
    }
  }

  hideLobby() {
    if (this.elements.lobby) {
      this.elements.lobby.classList.add("hidden");
    }
  }

  showWaitingRoom(roomCode) {
    this.hideLobby();
    const waitingRoom = document.getElementById("waitingRoom");
    if (waitingRoom) {
      waitingRoom.classList.remove("hidden");
    }
    if (this.elements.roomCodeDisplay) {
      this.elements.roomCodeDisplay.textContent = roomCode;
    }
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
    const listEl = this.elements.playerList;
    if (!listEl) return;

    listEl.innerHTML = "<h3>Jogadores na sala:</h3>";
    const playerArray = Object.values(gameState.players);

    playerArray.forEach((player, idx) => {
      const item = document.createElement("div");
      item.className = "player-item";
      item.style.borderLeft = `5px solid ${
        CONFIG.PLAYER_COLORS[idx % CONFIG.PLAYER_COLORS.length]
      }`;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = player.name;
      item.appendChild(nameSpan);

      if (player.ready) {
        const readySpan = document.createElement("span");
        readySpan.className = "player-ready";
        readySpan.textContent = "✓ PRONTO";
        item.appendChild(readySpan);
      }

      listEl.appendChild(item);
    });
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
    }
  }
}

// Create singleton instance
const uiManager = new UIManager();

// Expose globally
window.uiManager = uiManager;
window.UIManager = UIManager;
