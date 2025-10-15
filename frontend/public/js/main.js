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
  document.addEventListener("DOMContentLoaded", () => {
    // Continue button (name screen)
    document.getElementById("continueBtn").addEventListener("click", () => {
      const name = document.getElementById("playerNameInput").value.trim();
      if (!name) {
        alert("Por favor, insira seu nome");
        return;
      }
      gameState.setPlayerName(name);
      uiManager.showLobbyScreen();
    });

    // Create room button
    document.getElementById("createBtn").addEventListener("click", () => {
      Utils.logInfo("Criando sala...", gameState.myPlayerName);
      if (!socket || !socket.connected) {
        alert("Não conectado ao servidor. Aguarde...");
        return;
      }
      socket.emit("create_room", { playerName: gameState.myPlayerName });
    });

    // Join room button
    document.getElementById("joinBtn").addEventListener("click", () => {
      const roomCode = document
        .getElementById("roomCode")
        .value.trim()
        .toUpperCase();
      if (!roomCode) {
        alert("Por favor, insira o código da sala");
        return;
      }
      Utils.logInfo("Entrando na sala:", roomCode);
      if (!socket || !socket.connected) {
        alert("Não conectado ao servidor. Aguarde...");
        return;
      }
      socket.emit("join_room", {
        roomCode: roomCode,
        playerName: gameState.myPlayerName,
      });
    });

    // Ready button
    document.getElementById("readyBtn").addEventListener("click", () => {
      const isReady = gameState.toggleReady();
      Utils.logInfo("✅ Mudando status pronto:", isReady);
      socket.emit("player_ready", {
        roomCode: gameState.room,
        ready: isReady,
      });
      uiManager.updateReadyButton(isReady);
    });

    // Leave button
    document.getElementById("leaveBtn").addEventListener("click", () => {
      socket.emit("leave_room", { roomCode: gameState.room });
      location.reload();
    });
  });
}

// Initialize on page load
window.addEventListener("load", () => {
  Utils.logInfo("Página carregada, inicializando aplicação...");

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
