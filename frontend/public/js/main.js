// Main Game Entry Point
// This file orchestrates all game modules and initializes the application

// Global socket reference
let socket = null;
let availableRooms = [];

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

// Request list of available rooms
async function requestRoomsList() {
  Utils.logInfo("📋 Requesting rooms list from server...");
  
  // Show loading state
  showRoomsLoading();
  
  try {
    // Convert WebSocket URL to HTTP URL
    // CONFIG.SERVER_URL is "wss://jogo-s89j.onrender.com"
    // We need "https://jogo-s89j.onrender.com/api/rooms/"
    const httpUrl = CONFIG.SERVER_URL.replace('wss://', 'https://').replace('ws://', 'http://');
    const apiUrl = `${httpUrl}/api/rooms/`;
    Utils.logInfo("🌐 Fetching from:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    Utils.logInfo("✅ Received rooms data:", data);
    
    // The API might return different formats, handle both:
    // 1. Direct array: [{ code: "abc123", ... }, ...]
    // 2. Object with rooms: { rooms: [{ code: "abc123", ... }] }
    const rooms = Array.isArray(data) ? data : (data.rooms || []);
    
    Utils.logInfo(`📊 Found ${rooms.length} rooms`);
    displayRoomsList(rooms);
    
  } catch (error) {
    Utils.logError("❌ Failed to fetch rooms list:", error);
    
    // Show error state
    const loadingDiv = document.getElementById("loadingRooms");
    const noRoomsDiv = document.getElementById("noRoomsMessage");
    const roomsList = document.getElementById("roomsList");
    
    if (loadingDiv) loadingDiv.style.display = "none";
    if (roomsList) roomsList.innerHTML = "";
    
    if (noRoomsDiv) {
      noRoomsDiv.innerHTML = `
        <strong>Erro ao carregar salas</strong>
        <br><br>
        ${error.message}
        <br><br>
        Tente atualizar ou criar uma nova sala.
      `;
      noRoomsDiv.style.display = "block";
    }
  }
}

// Show loading state in rooms list
function showRoomsLoading() {
  const loadingDiv = document.getElementById("loadingRooms");
  const noRoomsDiv = document.getElementById("noRoomsMessage");
  const roomsList = document.getElementById("roomsList");
  
  if (loadingDiv) loadingDiv.style.display = "block";
  if (noRoomsDiv) noRoomsDiv.style.display = "none";
  if (roomsList) roomsList.innerHTML = "";
}

// Display list of rooms
function displayRoomsList(rooms) {
  Utils.logInfo("📋 Displaying rooms list:", rooms);
  
  const loadingDiv = document.getElementById("loadingRooms");
  const noRoomsDiv = document.getElementById("noRoomsMessage");
  const roomsList = document.getElementById("roomsList");
  
  // Hide loading
  if (loadingDiv) loadingDiv.style.display = "none";
  
  // Check if we have rooms
  if (!rooms || rooms.length === 0) {
    Utils.logInfo("ℹ️ No rooms available");
    if (noRoomsDiv) {
      noRoomsDiv.innerHTML = `
        Nenhuma sala disponível no momento.
        <br><br>
        Crie uma nova sala!
      `;
      noRoomsDiv.style.display = "block";
    }
    if (roomsList) roomsList.innerHTML = "";
    return;
  }
  
  // Hide no rooms message
  if (noRoomsDiv) noRoomsDiv.style.display = "none";
  
  // Store rooms
  availableRooms = rooms;
  
  // Build rooms HTML
  let roomsHTML = "";
  
  rooms.forEach(room => {
    // Handle different possible field names from API
    const code = room.code || room.Code || room.roomCode;
    const playerCount = room.playerCount || room.PlayerCount || (room.players ? Object.keys(room.players).length : 0);
    const maxPlayers = room.maxPlayers || room.MaxPlayers || 4;
    const gameStarted = room.gameStarted || room.GameStarted || false;
    
    const isFull = playerCount >= maxPlayers;
    const isStarted = gameStarted;
    const canJoin = !isFull && !isStarted;
    
    let statusClass = "waiting";
    let statusText = "Aguardando";
    
    if (isStarted) {
      statusClass = "started";
      statusText = "Em jogo";
    } else if (isFull) {
      statusClass = "full";
      statusText = "Cheia";
    }
    
    const cardClass = `room-card ${isFull ? 'full' : ''} ${isStarted ? 'started' : ''}`;
    const playersClass = `room-players ${isFull ? 'full' : ''}`;
    
    roomsHTML += `
      <div class="${cardClass}" data-room-code="${code}" ${canJoin ? 'onclick="joinRoomFromList(this)"' : ''}>
        <div class="room-info">
          <div class="room-code-display">${code ? code.toUpperCase() : 'N/A'}</div>
          <div class="room-details">
            <div class="room-detail">
              <span class="room-detail-icon">🎮</span>
              <span>${playerCount}/${maxPlayers} jogadores</span>
            </div>
          </div>
        </div>
        <div class="room-status">
          <div class="${playersClass}">
            ${playerCount}/${maxPlayers}
          </div>
          <div class="room-badge ${statusClass}">
            ${statusText}
          </div>
        </div>
      </div>
    `;
  });
  
  if (roomsList) {
    roomsList.innerHTML = roomsHTML;
  }
  
  Utils.logInfo(`✅ Displayed ${rooms.length} rooms`);
}

// Join room from list (called when clicking a room card)
function joinRoomFromList(element) {
  const roomCode = element.getAttribute('data-room-code');
  
  if (!roomCode) {
    Utils.logError("❌ No room code found on element");
    return;
  }
  
  Utils.logInfo("🚪 Joining room from list:", roomCode);
  joinRoomByCode(roomCode);
}

// Join room by code
function joinRoomByCode(roomCode) {
  Utils.logInfo("🚪 Attempting to join room:", roomCode);
  Utils.logInfo("👤 Player name:", gameState.myPlayerName);
  
  if (!gameState.myPlayerName) {
    Utils.logError("❌ Player name not set!");
    alert("Erro: Nome do jogador não definido. Por favor, volte e insira seu nome.");
    return;
  }

  // Generate a unique player ID if not already set
  if (!gameState.myPlayerId) {
    const playerId = "player-" + Math.random().toString(36).substr(2, 9);
    gameState.setPlayerId(playerId);
    Utils.logInfo("🆔 Generated new player ID:", playerId);
  } else {
    Utils.logInfo("🆔 Using existing player ID:", gameState.myPlayerId);
  }

  // Store room code
  Utils.logInfo("💾 Storing room code:", roomCode);
  gameState.pendingRoomCode = roomCode.toLowerCase();
  gameState.setRoom(roomCode.toLowerCase());

  // Close existing connection if any
  if (socket && socket.ws) {
    Utils.logInfo("🔌 Closing previous WebSocket connection...");
    socket.close();
  }

  // Connect to room-specific WebSocket: /ws/<ROOM_CODE>
  const roomPath = `/ws/${roomCode.toLowerCase()}`;
  Utils.logInfo("🔗 Connecting to room WebSocket:", roomPath);
  
  const roomClient = new WSClient(
    CONFIG.SERVER_URL,
    roomPath,
    CONFIG.IS_LOCAL
  );

  roomClient.connect()
    .then((s) => {
      Utils.logInfo("✅ Connected to room WebSocket:", s.id);
      socket = s;
      
      // Hide rooms list screen immediately
      Utils.logInfo("🙈 Hiding rooms list screen...");
      const roomsListScreen = document.getElementById("roomsListScreen");
      if (roomsListScreen) {
        roomsListScreen.style.display = "none";
      }
      
      // Now send join message
      Utils.logInfo("📤 Sending join message:");
      Utils.logInfo("  - Player ID:", gameState.myPlayerId);
      Utils.logInfo("  - Player Name:", gameState.myPlayerName);

      const success = socket.emit("join", {
        playerId: gameState.myPlayerId,
        name: gameState.myPlayerName,
      });
      
      if (!success) {
        Utils.logError("❌ Failed to send join message");
        alert("Erro ao enviar mensagem. Tente novamente.");
        return;
      }
      
      Utils.logInfo("✅ join message sent successfully");
      Utils.logInfo("⏳ Waiting for server response...");
      
      // Clear any existing timeout
      if (window._joinTimeout) {
        clearTimeout(window._joinTimeout);
      }
      
      // Set a timeout to detect if server doesn't respond
      window._joinTimeout = setTimeout(() => {
        Utils.logError("⏰ Timeout: Server did not respond to join request");
        
        alert("Timeout: O servidor não respondeu.\n\nTente atualizar a lista de salas ou criar uma nova sala.");
        
        // Clear the pending room code
        delete gameState.pendingRoomCode;
        window._joinTimeout = null;
      }, 5000);
    })
    .catch((err) => {
      Utils.logError("❌ Failed to connect to room WebSocket:", err);
      alert("Não foi possível conectar à sala. Verifique o código e tente novamente.");
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

  // Show rooms button
  const showRoomsBtn = document.getElementById("showRoomsBtn");
  Utils.logDebug("Show rooms button found:", !!showRoomsBtn);

  if (showRoomsBtn) {
    showRoomsBtn.addEventListener("click", () => {
      Utils.logInfo("📋 Show rooms button clicked");
      
      // Show rooms list screen
      document.getElementById("lobbyScreen").style.display = "none";
      document.getElementById("roomsListScreen").style.display = "block";
      
      // Request rooms list from server
      requestRoomsList();
    });
  }

  // Refresh rooms button
  const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
  if (refreshRoomsBtn) {
    refreshRoomsBtn.addEventListener("click", () => {
      Utils.logInfo("🔄 Refresh rooms button clicked");
      requestRoomsList();
    });
  }

  // Back to lobby button
  const backToLobbyBtn = document.getElementById("backToLobbyBtn");
  if (backToLobbyBtn) {
    backToLobbyBtn.addEventListener("click", () => {
      Utils.logInfo("← Back to lobby button clicked");
      document.getElementById("roomsListScreen").style.display = "none";
      document.getElementById("lobbyScreen").style.display = "block";
    });
  }

  // Create room button
  const createBtn = document.getElementById("createBtn");
  Utils.logDebug("Create button found:", !!createBtn);

  if (createBtn) {
    createBtn.addEventListener("click", () => {
      Utils.logInfo("🏠 Create room button clicked");
      Utils.logInfo("Criando sala para jogador:", gameState.myPlayerName);
      
      if (!gameState.myPlayerName) {
        Utils.logError("❌ Player name not set!");
        alert("Erro: Nome do jogador não definido. Por favor, volte e insira seu nome.");
        return;
      }
      
      // Check connection status
      if (!socket) {
        Utils.logError("❌ Socket object is null");
        alert("Não conectado ao servidor. Aguarde...");
        return;
      }
      
      if (!socket.isConnected()) {
        Utils.logError("❌ Socket not connected");
        alert("Não conectado ao servidor. Aguarde...");
        return;
      }

      Utils.logInfo("✅ Socket is connected, creating room...");

      // Generate a unique player ID (host)
      const playerId = "host-" + Math.random().toString(36).substr(2, 9);
      gameState.setPlayerId(playerId);
      
      Utils.logInfo("🆔 Generated host ID:", playerId);
      Utils.logInfo("👤 Player name:", gameState.myPlayerName);

      const success = socket.emit("create_room", {
        playerId: playerId,
        name: gameState.myPlayerName,
        maxPlayers: 4,
      });
      
      if (!success) {
        Utils.logError("❌ Failed to send create_room message");
        alert("Erro ao enviar mensagem. Tente novamente.");
      } else {
        Utils.logInfo("✅ create_room message sent successfully");
        Utils.logInfo("⏳ Waiting for room_created response...");
      }
    });
  }

  // Ready button - Optimistic UI + Server Sync
    const readyBtn = document.getElementById("readyBtn");

    if (readyBtn) {
      readyBtn.addEventListener("click", () => {
        Utils.logInfo("✅ Ready button clicked");
        
        if (!gameState.myPlayerId) {
          Utils.logError("❌ No player ID set!");
          alert("Erro: ID do jogador não definido");
          return;
        }
        
        if (!gameState.room) {
          Utils.logError("❌ No room set!");
          alert("Erro: Você não está em uma sala");
          return;
        }
        
        // 1. Toggle ready status locally (optimistic update)
        const isReady = gameState.toggleReady();
        Utils.logInfo("🎯 Toggled ready status locally to:", isReady);
        
        // 2. Update UI immediately for instant feedback
        Utils.logInfo("🎨 Updating UI optimistically...");
        uiManager.updateReadyButton(isReady);
        uiManager.updatePlayerList();
        Utils.logInfo("✅ UI updated locally (will sync with server)");
        
        // 3. Send to server (server expects "ready" event with simple payload)
        Utils.logInfo("📤 Sending ready status to server...");
        const sent = socket.emit("ready", {
          ready: isReady,
        });
        
        if (!sent) {
          Utils.logError("❌ Failed to send ready status!");
          // Revert optimistic update
          gameState.toggleReady();
          uiManager.updateReadyButton(!isReady);
          uiManager.updatePlayerList();
          alert("Erro ao enviar status. Tente novamente.");
          return;
        }
        
        Utils.logInfo("✅ Ready status sent. Waiting for server broadcast via game_update...");
      });
    }

  // Leave button
  const leaveBtn = document.getElementById("leaveBtn");
  Utils.logDebug("Leave button found:", !!leaveBtn);

  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      Utils.logInfo("👋 Leave button clicked");
      
      if (socket && gameState.myPlayerId && gameState.room) {
        socket.emit("leave_room", {
          playerId: gameState.myPlayerId,
          roomCode: gameState.room,
        });
      }
      
      Utils.logInfo("🔄 Reloading page...");
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

scene.addEventListener("loaded", () => {
  Utils.logInfo("A-Frame scene loaded");

  // 🟡 Lógica de coleta de tesouros via gaze (fuse)
  document.addEventListener("click", (e) => {
    const target = e.target;

    if (target && target.classList && target.classList.contains("treasure")) {
      const treasureId = target.id;

      const treasure = gameState.treasures.find(t => t.id === treasureId);
      if (!treasure || treasure.collected) return;

      // Marcar como coletado
      treasure.collected = true;

      // Remover da cena
      target.parentNode.removeChild(target);

      // Atualizar contador de tesouros
      gameState.myTreasureCount++;
      uiManager.updateTreasureCount();

      // Emitir evento para o servidor
      if (gameController.socket) {
        gameController.socket.emit("treasure_collected", {
          playerId: gameState.myPlayerId,
          treasureId: treasureId
        });
      }

      // Feedback: som e UI
      playerManager.playCollectSound();
      uiManager.showCollectionFeedback();
    }
  });
});

// Expose globally for onclick handlers
window.joinRoomFromList = joinRoomFromList;

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