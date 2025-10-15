// Main Game Entry Point
// This file orchestrates all game modules and initializes the application

// Global socket reference
let socket = null;

// Initialize socket connection
function initSocket() {
  Utils.logInfo("Initializing WebSocket connection...");
  Utils.logInfo(`Mode: ${CONFIG.IS_LOCAL ? "LOCAL" : "REMOTE"}`);
  Utils.logInfo(`Server: ${CONFIG.SERVER_URL}`);

  const client = new WSClient(
    CONFIG.SERVER_URL,
    CONFIG.WS_PATH,
    CONFIG.IS_LOCAL
  );

  client
    .connect()
    .then((s) => {
      Utils.logInfo("Connected via WSClient", s && s.id);
      socket = s;
    })
    .catch((err) => {
      Utils.logError("WSClient failed to connect:", err && err.message);
      uiManager.updateConnectionStatus("disconnected");
    });
}

// Setup UI event listeners
function setupUI() {
  Utils.logInfo("🎮 Setting up UI event listeners...");

  // Continue button (name screen)
  const continueBtn = document.getElementById("continueBtn");
  Utils.logDebug("Continue button found:", !!continueBtn);

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      Utils.logInfo("🔵 Continue button clicked!");
      const nameInput = document.getElementById("playerNameInput");
      const name = nameInput ? nameInput.value.trim() : "";
      Utils.logDebug("Player name entered:", name);

      if (!name) {
        Utils.logWarn("⚠️ No name entered");
        alert("Por favor, insira seu nome");
        return;
      }

      Utils.logInfo("✅ Setting player name:", name);
      gameState.setPlayerName(name);

      Utils.logInfo("🎬 Showing lobby screen...");
      uiManager.showLobbyScreen();
      Utils.logInfo("✅ Lobby screen should now be visible");
    });
  } else {
    Utils.logError("❌ Continue button not found!");
  }

  // Create room button
  const createBtn = document.getElementById("createBtn");
  Utils.logDebug("Create button found:", !!createBtn);

  if (createBtn) {
    createBtn.addEventListener("click", () => {
      Utils.logInfo("🏠 Create room button clicked");
      Utils.logInfo("Criando sala...", gameState.myPlayerName);
      if (!socket || !socket.connected) {
        Utils.logWarn("⚠️ Socket not connected");
        alert("Não conectado ao servidor. Aguarde...");
        return;
      }
      socket.emit("create_room", { playerName: gameState.myPlayerName });
    });
  }

  // Join room button
  const joinBtn = document.getElementById("joinBtn");
  Utils.logDebug("Join button found:", !!joinBtn);

  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      Utils.logInfo("🚪 Join room button clicked");
      const roomCode = document
        .getElementById("roomCode")
        .value.trim()
        .toUpperCase();
      if (!roomCode) {
        Utils.logWarn("⚠️ No room code entered");
        alert("Por favor, insira o código da sala");
        return;
      }
      Utils.logInfo("Entrando na sala:", roomCode);
      if (!socket || !socket.connected) {
        Utils.logWarn("⚠️ Socket not connected");
        alert("Não conectado ao servidor. Aguarde...");
        return;
      }
      socket.emit("join_room", {
        roomCode: roomCode,
        playerName: gameState.myPlayerName,
      });
    });
  }

  // Ready button
  const readyBtn = document.getElementById("readyBtn");
  Utils.logDebug("Ready button found:", !!readyBtn);

  if (readyBtn) {
    readyBtn.addEventListener("click", () => {
      Utils.logInfo("✅ Ready button clicked");
      const isReady = gameState.toggleReady();
      Utils.logInfo("✅ Mudando status pronto:", isReady);
      socket.emit("player_ready", {
        roomCode: gameState.room,
        ready: isReady,
      });
      uiManager.updateReadyButton(isReady);
    });
  }

  // Leave button
  const leaveBtn = document.getElementById("leaveBtn");
  Utils.logDebug("Leave button found:", !!leaveBtn);

  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      Utils.logInfo("👋 Leave button clicked");
      socket.emit("leave_room", { roomCode: gameState.room });
      location.reload();
    });
  }

  Utils.logInfo("✅ All UI event listeners configured");
}

// Initialize on page load
window.addEventListener("load", () => {
  Utils.logInfo("🚀 Página carregada, inicializando aplicação...");

  // Initialize UI Manager first (setup DOM element references)
  uiManager.init();

  // Initialize socket
  initSocket();

  // Setup UI event listeners
  setupUI();

  // Setup keyboard controls
  gameController.setupKeyboardControls();

  // Setup A-Frame scene listener
  const scene = document.querySelector("a-scene");
  if (scene) {
    if (scene.hasLoaded) {
      Utils.logInfo("A-Frame scene loaded");
    } else {
      scene.addEventListener("loaded", () => {
        Utils.logInfo("A-Frame scene loaded");
      });
    }
  }

  Utils.logInfo("✅ Application initialization complete");
});

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes collectFeedback {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    50% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.2);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -80%) scale(1);
    }
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.3);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }
`;
document.head.appendChild(style);
