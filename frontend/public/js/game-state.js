// Game State Management
class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.myPlayerName = "";
    this.myPlayerId = null;
    this.myTreasureCount = 0;
    this.room = null;
    this.players = {};
    this.maze = [];
    this.treasures = [];
    this.cellSize = CONFIG.CELL_SIZE;
    this.gameStarted = false;
    this.startTime = null;
    this.isReady = false;
  }

  // Player methods
  setPlayerName(name) {
    this.myPlayerName = name;
  }

  setPlayerId(id) {
    this.myPlayerId = id;
  }

  setRoom(roomCode) {
    this.room = roomCode;
  }

  updatePlayers(players) {
    this.players = players;
  }

  addPlayer(player) {
    this.players[player.id] = player;
  }

  removePlayer(playerId) {
    delete this.players[playerId];
  }

  updatePlayerReady(playerId, ready) {
    if (this.players[playerId]) {
      this.players[playerId].ready = ready;
    }
  }

  // Game methods
  setMaze(maze) {
    this.maze = maze;
  }

  setTreasures(treasures) {
    this.treasures = treasures;
  }

  collectTreasure(treasureId, playerId) {
    const treasure = this.treasures.find((t) => t.id === treasureId);
    if (treasure) {
      treasure.collected = true;
      treasure.collectedBy = playerId;

      if (playerId === this.myPlayerId) {
        this.myTreasureCount++;
      }

      // Update player treasure count
      if (this.players[playerId]) {
        this.players[playerId].treasures =
          (this.players[playerId].treasures || 0) + 1;
      }
    }
  }

  startGame(data) {
    this.maze = data.maze;
    this.treasures = data.treasures;
    this.players = data.players;
    this.gameStarted = true;
    this.startTime = Date.now();
  }

  toggleReady() {
    this.isReady = !this.isReady;
    return this.isReady;
  }
}

// Create singleton instance
const gameState = new GameState();

// Expose globally
window.gameState = gameState;
window.GameState = GameState;
