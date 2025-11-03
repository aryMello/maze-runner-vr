// ========================================
// MAIN APPLICATION (Refactored)
// Entry point - orchestrates initialization
// ========================================

// Global instances
let socket = null;
let coordinateUtils = null;
let collisionUtils = null;
let mazeManager = null;
let playerManager = null;

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize all game systems
 */
function initializeGame() {
  Utils.logInfo("🚀 Initializing Maze Runner VR...");
  
  // 1. Initialize utilities
  coordinateUtils = new CoordinateUtils(gameState);
  collisionUtils = new CollisionUtils(gameState);
  
  // 2. Initialize managers
  mazeManager = new MazeManager(gameState, coordinateUtils);
  playerManager = new PlayerManager(gameState, coordinateUtils);
  
  // 3. Initialize UI
  uiManager.init();
  
  // 4. Connect to server
  initSocket();
  
  // 5. Setup UI handlers
  setupUIHandlers();
  
  // 6. Setup A-Frame
  setupAFrameScene();
  
  Utils.logInfo("✅ Application initialized");
}

/**
 * Initialize WebSocket connection
 */
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
      
      // Setup event handlers
      const handlers = new WSHandlers(socket);
      handlers.registerAll();
      
      // Set socket in game controller
      gameController.setSocket(socket);
    })
    .catch((err) => {
      Utils.logError("❌ Failed to connect:", err);
      uiManager.updateConnectionStatus("disconnected");
    });
}

/**
 * Setup A-Frame scene
 */
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

/**
 * Setup all UI event handlers
 */
function setupUIHandlers() {
  Utils.logInfo("🎮 Setting up UI handlers...");
  
  setupNameScreen();
  setupLobbyScreen();
  setupRoomsScreen();
  setupWaitingRoom();
  
  Utils.logInfo("✅ UI handlers configured");
}

/**
 * Name screen handlers
 */
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

/**
 * Lobby screen handlers
 */
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

/**
 * Rooms screen handlers
 */
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

/**
 * Waiting room handlers
 */
function setupWaitingRoom() {
  const readyBtn = document.getElementById("readyBtn");
  const leaveBtn = document.getElementById("leaveBtn");
  
  if (readyBtn) {
    readyBtn.addEventListener("click", toggleReady);
  }
  
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      if (socket && gameState.myPlayerId && gameState.room) {
        socket.emit("leave_room", {
          playerId: gameState.myPlayerId,
          roomCode: gameState.room,
        });
      }
      location.reload();
    });
  }
}

// ========================================
// ROOM MANAGEMENT
// ========================================

/**
 * Request list of available rooms
 */
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

/**
 * Display rooms list
 * @param {array} rooms
 */
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
    const code = room.code || room.Code;
    const playerCount = room.playerCount || room.PlayerCount || 0;
    const maxPlayers = room.maxPlayers || room.MaxPlayers || 4;
    const gameStarted = room.gameStarted || room.GameStarted || false;
    
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

/**
 * Show rooms loading state
 */
function showRoomsLoading() {
  const loadingDiv = document.getElementById("loadingRooms");
  const noRoomsDiv = document.getElementById("noRoomsMessage");
  const roomsList = document.getElementById("roomsList");
  
  if (loadingDiv) loadingDiv.style.display = "block";
  if (noRoomsDiv) noRoomsDiv.style.display = "none";
  if (roomsList) roomsList.innerHTML = "";
}

/**
 * Show rooms error
 * @param {string} message
 */
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

/**
 * Create new room
 */
function createRoom() {
  if (!gameState.myPlayerName) {
    alert("Erro: Nome não definido");
    return;
  }
  
  if (!socket || !socket.isConnected()) {
    alert("Não conectado ao servidor");
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

/**
 * Join room from list
 * @param {HTMLElement} element
 */
function joinRoomFromList(element) {
  const roomCode = element.getAttribute('data-room-code');
  if (!roomCode) return;
  
  joinRoom(roomCode);
}

/**
 * Join room by code
 * @param {string} roomCode
 */
function joinRoom(roomCode) {
  if (!gameState.myPlayerName) {
    alert("Erro: Nome não definido");
    return;
  }
  
  if (!gameState.myPlayerId) {
    const playerId = "player-" + Math.random().toString(36).substr(2, 9);
    gameState.setPlayerId(playerId);
  }
  
  gameState.setRoom(roomCode.toLowerCase());
  
  const roomPath = `/ws/${roomCode.toLowerCase()}`;
  const roomClient = new WSClient(CONFIG.SERVER_URL, roomPath, CONFIG.IS_LOCAL);
  
  roomClient.connect()
    .then((s) => {
      socket = s;
      
      // Setup handlers
      const handlers = new WSHandlers(socket);
      handlers.registerAll();
      gameController.setSocket(socket);
      
      // Hide rooms list
      document.getElementById("roomsListScreen").style.display = "none";
      
      // Send join
      socket.emit("join", {
        playerId: gameState.myPlayerId,
        name: gameState.myPlayerName,
      });
    })
    .catch((err) => {
      Utils.logError("❌ Failed to join room:", err);
      alert("Não foi possível conectar à sala");
    });
}

/**
 * Toggle ready status
 */
function toggleReady() {
  if (!gameState.myPlayerId || !gameState.room) {
    alert("Erro: Dados não definidos");
    return;
  }
  
  const isReady = gameState.toggleReady();
  uiManager.updateReadyButton(isReady);
  uiManager.updatePlayerList();
  
  socket.emit("ready", { ready: isReady });
}

// ========================================
// APPLICATION ENTRY POINT
// ========================================

window.addEventListener("load", () => {
  Utils.logInfo("🚀 Application starting...");
  initializeGame();
});

// Global exports
window.joinRoomFromList = joinRoomFromList;