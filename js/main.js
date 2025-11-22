// ========================================
// MAIN APPLICATION (Spectator doesn't join as player)
// Entry point - orchestrates initialization
// UPDATED: Complete spectator support with polling
// ========================================

// Global instances
let socket = null;
let coordinateUtils = null;
let collisionUtils = null;
let mazeManager = null;
let playerManager = null;

// Spectator polling interval
let spectatorPollInterval = null;

// ========================================
// INITIALIZATION
// ========================================

function initializeGame() {
  Utils.logInfo("🚀 Initializing Maze Runner VR...");
  
  coordinateUtils = new CoordinateUtils(gameState);
  collisionUtils = new CollisionUtils(gameState);
  
  window.coordinateUtils = coordinateUtils;
  window.collisionUtils = collisionUtils;
  
  mazeManager = new MazeManager(gameState, coordinateUtils);
  playerManager = new PlayerManager(gameState, coordinateUtils);
  
  window.mazeManager = mazeManager;
  window.playerManager = playerManager;
  
  uiManager.init();
  initSocket();
  setupUIHandlers();
  setupAFrameScene();
  
  Utils.logInfo("✅ Application initialized");
}

function initSocket() {
  Utils.logInfo(`🔌 Connecting to server: ${CONFIG.SERVER_URL}`);
  
  const client = new WSClient(
    CONFIG.SERVER_URL,
    CONFIG.WS_PATH,
    CONFIG.IS_LOCAL
  );
  
  client.connect()
    .then((s) => {
      Utils.logInfo("✅ Connected to server");
      socket = s;
      
      const handlers = new WSHandlers(socket);
      handlers.registerAll();
      
      gameController.setSocket(socket);
    })
    .catch((err) => {
      Utils.logError("❌ Failed to connect:", err);
      uiManager.updateConnectionStatus("disconnected");
    });
}

function setupAFrameScene() {
  const scene = document.querySelector("a-scene");
  
  if (!scene) {
    Utils.logError("❌ A-Frame scene not found");
    return;
  }
  
  if (scene.hasLoaded) {
    Utils.logInfo("✅ A-Frame scene loaded");
  } else {
    scene.addEventListener("loaded", () => {
      Utils.logInfo("✅ A-Frame scene loaded");
    });
  }
}

// ========================================
// UI HANDLERS
// ========================================

function setupUIHandlers() {
  Utils.logInfo("🎮 Setting up UI handlers...");
  
  setupNameScreen();
  setupLobbyScreen();
  setupRoomsScreen();
  setupWaitingRoom();
  
  Utils.logInfo("✅ UI handlers configured");
}

function setupNameScreen() {
  const continueBtn = document.getElementById("continueBtn");
  const nameInput = document.getElementById("playerNameInput");
  
  if (continueBtn && nameInput) {
    continueBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      
      if (!name) {
        alert("Por favor, insira seu nome");
        return;
      }
      
      gameState.setPlayerName(name);
      uiManager.showLobbyScreen();
    });
  }
}

function setupLobbyScreen() {
  const showRoomsBtn = document.getElementById("showRoomsBtn");
  const createBtn = document.getElementById("createBtn");
  
  if (showRoomsBtn) {
    showRoomsBtn.addEventListener("click", () => {
      document.getElementById("lobbyScreen").style.display = "none";
      document.getElementById("roomsListScreen").style.display = "block";
      requestRoomsList();
    });
  }
  
  if (createBtn) {
    createBtn.addEventListener("click", createRoom);
  }
}

function setupRoomsScreen() {
  const refreshBtn = document.getElementById("refreshRoomsBtn");
  const backBtn = document.getElementById("backToLobbyBtn");
  
  if (refreshBtn) {
    refreshBtn.addEventListener("click", requestRoomsList);
  }
  
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      document.getElementById("roomsListScreen").style.display = "none";
      document.getElementById("lobbyScreen").style.display = "block";
    });
  }
}

function setupWaitingRoom() {
  const readyBtn = document.getElementById("readyBtn");
  const leaveBtn = document.getElementById("leaveBtn");
  const spectatorCheckbox = document.getElementById("spectatorCheckbox");
  
  if (readyBtn) {
    readyBtn.addEventListener("click", toggleReady);
  }
  
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      // Stop spectator polling if active
      if (spectatorPollInterval) {
        clearInterval(spectatorPollInterval);
        spectatorPollInterval = null;
      }
      
      // Only send leave if not spectator (spectator never joined)
      if (socket && gameState.myPlayerId && gameState.room && !spectatorManager.getIsSpectator()) {
        socket.emit("leave_room", {
          playerId: gameState.myPlayerId,
          roomCode: gameState.room,
        });
      }
      location.reload();
    });
  }
  
  if (spectatorCheckbox) {
    spectatorCheckbox.addEventListener("change", (e) => {
      const isSpectator = e.target.checked;
      spectatorManager.setSpectator(isSpectator);
      updateSpectatorStatus(isSpectator);
      uiManager.updatePlayerList();
      
      Utils.logInfo(`👁️ Spectator checkbox: ${isSpectator ? 'CHECKED' : 'UNCHECKED'}`);
    });
  }
}

function updateSpectatorStatus(isSpectator) {
  const readyBtn = document.getElementById("readyBtn");
  if (readyBtn && isSpectator) {
    readyBtn.textContent = gameState.isReady ? "Não Pronto (Espectador)" : "Pronto (Espectador)";
  } else if (readyBtn) {
    readyBtn.textContent = gameState.isReady ? "Não Pronto" : "Pronto";
  }
}

// ========================================
// ROOM MANAGEMENT
// ========================================

async function requestRoomsList() {
  Utils.logInfo("📋 Requesting rooms list...");
  
  showRoomsLoading();
  
  try {
    const httpUrl = CONFIG.SERVER_URL
      .replace('wss://', 'https://')
      .replace('ws://', 'http://');
    const apiUrl = `${httpUrl}/api/rooms/`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const rooms = Array.isArray(data) ? data : (data.rooms || []);
    
    Utils.logInfo(`✅ Found ${rooms.length} rooms`);
    displayRoomsList(rooms);
    
  } catch (error) {
    Utils.logError("❌ Failed to fetch rooms:", error);
    showRoomsError(error.message);
  }
}

function displayRoomsList(rooms) {
  const loadingDiv = document.getElementById("loadingRooms");
  const noRoomsDiv = document.getElementById("noRoomsMessage");
  const roomsList = document.getElementById("roomsList");
  
  if (loadingDiv) loadingDiv.style.display = "none";
  
  if (!rooms || rooms.length === 0) {
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
  
  if (noRoomsDiv) noRoomsDiv.style.display = "none";
  
  let html = "";
  rooms.forEach(room => {
    const code = room.code || room.Code || room.roomCode || room.RoomCode;
    
    let playerCount = 0;
    if (room.players && typeof room.players === 'object') {
      playerCount = Object.keys(room.players).length;
    } else if (room.playerCount !== undefined) {
      playerCount = room.playerCount;
    } else if (room.PlayerCount !== undefined) {
      playerCount = room.PlayerCount;
    }
    
    const maxPlayers = room.maxPlayers || room.MaxPlayers || room.max_players || 4;
    const gameStarted = room.gameStarted || room.GameStarted || room.game_started || false;
    
    const canJoin = !gameStarted && playerCount < maxPlayers;
    const statusClass = gameStarted ? "started" : (playerCount >= maxPlayers ? "full" : "waiting");
    const statusText = gameStarted ? "Em jogo" : (playerCount >= maxPlayers ? "Cheia" : "Aguardando");
    
    html += `
      <div class="room-card ${canJoin ? '' : 'disabled'}" 
           data-room-code="${code}" 
           ${canJoin ? 'onclick="joinRoomFromList(this)"' : ''}>
        <div class="room-info">
          <div class="room-code-display">${code.toUpperCase()}</div>
          <div class="room-players">${playerCount}/${maxPlayers}</div>
        </div>
        <div class="room-badge ${statusClass}">${statusText}</div>
      </div>
    `;
  });
  
  if (roomsList) roomsList.innerHTML = html;
}

function showRoomsLoading() {
  const loadingDiv = document.getElementById("loadingRooms");
  const noRoomsDiv = document.getElementById("noRoomsMessage");
  const roomsList = document.getElementById("roomsList");
  
  if (loadingDiv) loadingDiv.style.display = "block";
  if (noRoomsDiv) noRoomsDiv.style.display = "none";
  if (roomsList) roomsList.innerHTML = "";
}

function showRoomsError(message) {
  const loadingDiv = document.getElementById("loadingRooms");
  const noRoomsDiv = document.getElementById("noRoomsMessage");
  const roomsList = document.getElementById("roomsList");
  
  if (loadingDiv) loadingDiv.style.display = "none";
  if (roomsList) roomsList.innerHTML = "";
  
  if (noRoomsDiv) {
    noRoomsDiv.innerHTML = `
      <strong>Erro ao carregar salas</strong>
      <br><br>
      ${message}
      <br><br>
      Tente atualizar ou criar uma nova sala.
    `;
    noRoomsDiv.style.display = "block";
  }
}

function createRoom() {
  if (!gameState.myPlayerName) {
    alert("Erro: Nome não definido");
    return;
  }
  
  if (!socket || !socket.isConnected()) {
    alert("Não conectado ao servidor");
    return;
  }
  
  // Spectators cannot create rooms
  if (spectatorManager.getIsSpectator()) {
    alert("Espectadores não podem criar salas. Desmarque a opção de espectador.");
    return;
  }
  
  const playerId = "host-" + Math.random().toString(36).substr(2, 9);
  gameState.setPlayerId(playerId);
  
  socket.emit("create_room", {
    playerId: playerId,
    name: gameState.myPlayerName,
    maxPlayers: 4,
  });
}

function joinRoomFromList(element) {
  const roomCode = element.getAttribute('data-room-code');
  if (!roomCode) return;
  
  joinRoom(roomCode);
}

// ========================================
// SPECTATOR POLLING - Polls room state every 2 seconds
// ========================================

function startSpectatorPolling(roomCode) {
  if (!spectatorManager.getIsSpectator()) return;
  
  Utils.logInfo("👁️ Starting spectator polling...");
  
  // Poll every 2 seconds
  spectatorPollInterval = setInterval(() => {
    if (gameState.gameStarted) {
      // Stop polling once game starts
      clearInterval(spectatorPollInterval);
      spectatorPollInterval = null;
      Utils.logInfo("👁️ Stopped spectator polling (game started)");
      return;
    }
    
    const httpUrl = CONFIG.SERVER_URL
      .replace('wss://', 'https://')
      .replace('ws://', 'http://');
    const roomApiUrl = `${httpUrl}/api/rooms/${roomCode.toLowerCase()}`;
    
    fetch(roomApiUrl)
      .then(response => response.json())
      .then(roomData => {
        const room = roomData.room || roomData;
        
        // Update players and ready status
        if (room.players) {
          let needsUpdate = false;
          
          Object.keys(room.players).forEach(playerId => {
            const serverPlayer = room.players[playerId];
            const localPlayer = gameState.players[playerId];
            
            if (!localPlayer || localPlayer.ready !== serverPlayer.ready) {
              needsUpdate = true;
            }
          });
          
          if (needsUpdate) {
            Utils.logInfo("👁️ Spectator: Detected player changes, updating...");
            gameState.updatePlayers(room.players);
            uiManager.updatePlayerList();
          }
        }
        
        // Check if game started
        if (room.gameStarted || room.game_started) {
          Utils.logInfo("👁️ Spectator: Game started! Stopping poll and initializing...");
          clearInterval(spectatorPollInterval);
          spectatorPollInterval = null;
          
          // Trigger game start manually
          gameState.gameStarted = true;
          uiManager.hideLobby();
          gameController.initGame();
        }
      })
      .catch(err => {
        Utils.logWarn("👁️ Spectator polling error:", err);
      });
  }, 2000);
}

function joinRoom(roomCode) {
  if (!gameState.myPlayerName) {
    alert("Erro: Nome não definido");
    return;
  }
  
  // Generate player ID
  if (!gameState.myPlayerId) {
    const prefix = spectatorManager.getIsSpectator() ? "spectator-" : "player-";
    const playerId = prefix + Math.random().toString(36).substr(2, 9);
    gameState.setPlayerId(playerId);
  }
  
  gameState.setRoom(roomCode.toLowerCase());
  
  const roomPath = `/ws/${roomCode.toLowerCase()}`;
  const roomClient = new WSClient(CONFIG.SERVER_URL, roomPath, CONFIG.IS_LOCAL);
  
  roomClient.connect()
    .then((s) => {
      socket = s;
      
      const handlers = new WSHandlers(socket);
      handlers.registerAll();
      gameController.setSocket(socket);
      
      document.getElementById("roomsListScreen").style.display = "none";
      
      // ========================================
      // SPECTATOR WORKAROUND: Get room state from HTTP API first
      // ========================================
      if (spectatorManager.getIsSpectator()) {
        Utils.logInfo("👁️ Spectator connected - fetching room state from API...");
        
        // Fetch current room state from HTTP API
        const httpUrl = CONFIG.SERVER_URL
          .replace('wss://', 'https://')
          .replace('ws://', 'http://');
        const roomApiUrl = `${httpUrl}/api/rooms/${roomCode.toLowerCase()}`;
        
        fetch(roomApiUrl)
          .then(response => response.json())
          .then(roomData => {
            Utils.logInfo("📊 Got room state from API:", roomData);
            
            // Extract room data
            const room = roomData.room || roomData;
            
            // Update game state with current players
            if (room.players) {
              Utils.logInfo(`📋 Syncing ${Object.keys(room.players).length} existing players`);
              gameState.updatePlayers(room.players);
            }
            
            if (room.maze) {
              gameState.setMaze(room.maze);
            }
            
            if (room.treasures) {
              gameState.setTreasures(room.treasures);
            }
            
            // Handle spectator connection locally
            spectatorManager.handleSpectatorConnection(socket, roomCode);
            
            // Show waiting room with synced player list
            uiManager.showWaitingRoom(roomCode);
            uiManager.updatePlayerList();
            
            Utils.logInfo("✅ Spectator synced with room state");
            
            // If game already started, join mid-game
            if (room.gameStarted || room.game_started) {
              Utils.logInfo("🎮 Game already in progress - spectating");
              gameState.gameStarted = true;
              uiManager.hideLobby();
              gameController.initGame();
            } else {
              // Start polling for updates
              startSpectatorPolling(roomCode);
            }
          })
          .catch(err => {
            Utils.logError("❌ Failed to fetch room state:", err);
            Utils.logInfo("👁️ Spectator will wait for player_joined events...");
            
            spectatorManager.handleSpectatorConnection(socket, roomCode);
            uiManager.showWaitingRoom(roomCode);
            uiManager.updatePlayerList();
            
            // Still start polling as fallback
            startSpectatorPolling(roomCode);
          });
        
      } else {
        // Normal player - send join
        socket.emit("join", {
          playerId: gameState.myPlayerId,
          name: gameState.myPlayerName,
        });
      }
    })
    .catch((err) => {
      Utils.logError("❌ Failed to join room:", err);
      alert("Não foi possível conectar à sala");
    });
}

function toggleReady() {
  if (!gameState.myPlayerId || !gameState.room) {
    alert("Erro: Dados não definidos");
    return;
  }
  
  const isSpectator = spectatorManager.getIsSpectator();
  
  // ========================================
  // Spectator ready is local only
  // ========================================
  if (isSpectator) {
    spectatorManager.handleSpectatorReady();
    uiManager.updateReadyButton(gameState.isReady);
    uiManager.updatePlayerList();
    Utils.logInfo("👁️ Spectator ready toggled (local only)");
    return;
  }
  
  // Normal player - send to server
  const isReady = gameState.toggleReady();
  uiManager.updateReadyButton(isReady);
  uiManager.updatePlayerList();
  
  if (!socket || !socket.isConnected()) {
    Utils.logError("❌ Socket not connected, cannot send ready status");
    return;
  }
  
  socket.emit("ready", { ready: isReady });
}

// ========================================
// APPLICATION ENTRY POINT
// ========================================

window.addEventListener("load", () => {
  Utils.logInfo("🚀 Application starting...");
  initializeGame();
});

window.joinRoomFromList = joinRoomFromList;