// Configuration
const CONFIG = {
  // Server Configuration
  SERVER_URL: "wss://jogo-s89j.onrender.com",
  WS_PATH: "/ws",
  IS_LOCAL: false,

  // Game Configuration
  CELL_SIZE: 4,
  MOVE_SPEED: 0.5,
  COLLECT_RADIUS: 1.5,

  // Sound Configuration
  FOOTSTEP_INTERVAL: 300, // ms

  // Animation Configuration
  COUNTDOWN_START: 3,
  COUNTDOWN_INTERVAL: 1000, // ms

  // Player Colors
  PLAYER_COLORS: [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
  ],
};

// Expose globally
window.CONFIG = CONFIG;
