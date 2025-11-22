// ========================================
// UI MANAGER
// UI Management with Spectator Support
// Spectator is shown locally but not on server
// ========================================

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
      spectatorCheckbox: document.getElementById("spectatorCheckbox"),
    };
  }

  ensureInit() {
    if (!this.initialized) {
      this.init();
    }
  }

  showNameScreen() {
    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "block";
    }
    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "none";
    }
  }

  showLobbyScreen() {
    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "none";
    }
    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "block";
    }
  }

  hideLobby() {
    Utils.logInfo("🚪 Hiding all lobby elements...");
    
    if (this.elements.lobby) {
      this.elements.lobby.style.display = "none";
      this.elements.lobby.classList.add("hidden");
    }
    
    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "none";
    }
    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "none";
    }
    if (this.elements.waitingScreen) {
      this.elements.waitingScreen.style.display = "none";
    }
    
    const scene = document.querySelector("a-scene");
    if (scene) {
      scene.style.display = "block";
      scene.style.visibility = "visible";
    }
  }

  showWaitingRoom(roomCode) {
    Utils.logInfo("🚪 Showing waiting room:", roomCode);
    
    if (this.elements.nameScreen) {
      this.elements.nameScreen.style.display = "none";
    }
    if (this.elements.lobbyScreen) {
      this.elements.lobbyScreen.style.display = "none";
    }
    
    if (this.elements.waitingScreen) {
      this.elements.waitingScreen.style.display = "block";
    }
    
    if (this.elements.lobby) {
      this.elements.lobby.classList.remove("hidden");
      this.elements.lobby.style.display = "flex";
    }
    
    const currentRoom = document.getElementById("currentRoom");
    if (currentRoom) {
      currentRoom.textContent = `Código da Sala: ${roomCode}`;
    }
    
    if (this.elements.spectatorCheckbox) {
      this.elements.spectatorCheckbox.checked = spectatorManager.getIsSpectator();
      // Disable checkbox after joining (can't change mid-session)
      this.elements.spectatorCheckbox.disabled = true;
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
    Utils.logInfo("📋 Updating player list UI...");
    
    const listEl = this.elements.playerList;
    if (!listEl) {
      Utils.logError("❌ playerList element not found!");
      return;
    }

    // Get all server players (doesn't include spectator)
    const serverPlayers = Object.values(gameState.players);
    
    listEl.innerHTML = "<h3>Jogadores na sala:</h3>";

    // Render server players
    serverPlayers.forEach((player, idx) => {
      const item = document.createElement("div");
      item.className = "player-item";
      item.style.borderLeft = `5px solid ${
        CONFIG.PLAYER_COLORS[idx % CONFIG.PLAYER_COLORS.length]
      }`;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = player.name;
      item.appendChild(nameSpan);
      
      const badgesContainer = document.createElement("div");
      badgesContainer.style.display = "flex";
      badgesContainer.style.alignItems = "center";
      badgesContainer.style.gap = "8px";

      if (player.ready === true) {
        const readySpan = document.createElement("span");
        readySpan.className = "player-ready";
        readySpan.textContent = "✓ PRONTO";
        readySpan.style.color = "#4CAF50";
        readySpan.style.fontWeight = "bold";
        badgesContainer.appendChild(readySpan);
      }

      item.appendChild(badgesContainer);
      listEl.appendChild(item);
    });
    
    // ========================================
    // ADD SPECTATOR ENTRY (LOCAL ONLY)
    // ========================================
    if (spectatorManager.getIsSpectator()) {
      const spectatorItem = document.createElement("div");
      spectatorItem.className = "player-item spectator-item";
      spectatorItem.style.borderLeft = "5px solid #9C27B0";
      spectatorItem.style.background = "rgba(156, 39, 176, 0.1)";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = gameState.myPlayerName;
      spectatorItem.appendChild(nameSpan);
      
      const badgesContainer = document.createElement("div");
      badgesContainer.style.display = "flex";
      badgesContainer.style.alignItems = "center";
      badgesContainer.style.gap = "8px";
      
      const spectatorBadge = document.createElement("span");
      spectatorBadge.className = "player-spectator";
      spectatorBadge.textContent = "👁️ ESPECTADOR";
      badgesContainer.appendChild(spectatorBadge);
      
      if (gameState.isReady) {
        const readySpan = document.createElement("span");
        readySpan.className = "player-ready";
        readySpan.textContent = "✓ PRONTO";
        readySpan.style.color = "#4CAF50";
        readySpan.style.fontWeight = "bold";
        badgesContainer.appendChild(readySpan);
      }

      spectatorItem.appendChild(badgesContainer);
      listEl.appendChild(spectatorItem);
      
      // Add note that spectator doesn't count
      const noteDiv = document.createElement("div");
      noteDiv.style.cssText = "font-size: 12px; color: #666; margin-top: 10px; font-style: italic;";
      noteDiv.textContent = "👁️ Espectadores não contam como jogadores";
      listEl.appendChild(noteDiv);
    }
    
    Utils.logInfo(`✅ Player list updated: ${serverPlayers.length} players${spectatorManager.getIsSpectator() ? ' + 1 spectator' : ''}`);
  }

  updateLeaderboard() {
    const listEl = this.elements.leaderboardList;
    if (!listEl) return;

    listEl.innerHTML = "";
    
    // Only show actual players (not spectator)
    const playerArray = Object.values(gameState.players)
      .filter(p => {
        // Exclude local spectator from leaderboard
        if (p.id === gameState.myPlayerId && spectatorManager.getIsSpectator()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.treasures || 0) - (a.treasures || 0));

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
      scoreSpan.style.color = CONFIG.PLAYER_COLORS[idx % CONFIG.PLAYER_COLORS.length];

      item.appendChild(nameSpan);
      item.appendChild(scoreSpan);
      listEl.appendChild(item);
    });
    
    // Add spectator note at bottom if spectating
    if (spectatorManager.getIsSpectator()) {
      const spectatorNote = document.createElement("div");
      spectatorNote.style.cssText = "padding: 8px 0; color: #9C27B0; font-size: 12px; text-align: center; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 8px;";
      spectatorNote.textContent = "👁️ Você está assistindo";
      listEl.appendChild(spectatorNote);
    }
  }

  updateTreasureCount() {
    if (spectatorManager.getIsSpectator()) return;
    
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
        countdownEl.textContent = spectatorManager.getIsSpectator() ? "ASSISTA!" : "VAI!";
      } else {
        countdownEl.style.display = "none";
        clearInterval(interval);
        gameState.gameStarted = true;
        gameState.startTime = Date.now();
      }
    }, CONFIG.COUNTDOWN_INTERVAL);
  }

  showCollectionFeedback() {
    if (spectatorManager.getIsSpectator()) return;
    
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
    const isSpectator = spectatorManager.getIsSpectator();
    
    if (readyBtn) {
      if (isSpectator) {
        readyBtn.textContent = isReady ? "Não Pronto (Espectador)" : "Pronto (Espectador)";
      } else {
        readyBtn.textContent = isReady ? "Não Pronto" : "Pronto";
      }
      readyBtn.style.background = isReady
        ? "#FF9800"
        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    }
  }
}

const uiManager = new UIManager();

window.uiManager = uiManager;
window.UIManager = UIManager;