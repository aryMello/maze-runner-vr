// Configuration
const CONFIG = {
  // Server Configuration
  SERVER_URL: "wss://jogo-s89j.onrender.com",
  WS_PATH: "/ws",
  IS_LOCAL: false,
  
  // Game Configuration
  CELL_SIZE: 4,
  MOVE_SPEED: 2.0, // Grid units per second (reduced for better control)
  COLLECT_RADIUS: 2.0,
  
  // Camera Configuration
  CAMERA_HEIGHT: 1.6, // Eye level on player's head
  CAMERA_BASED_MOVEMENT: true, // Use camera direction for WASD (Minecraft style)
  
  // Movement Configuration (NEW)
  CONTINUOUS_MOVEMENT: true, // Enable continuous movement
  COLLISION_CHECK_DISTANCE: 0.4, // How far ahead to check for walls
  PLAYER_RADIUS: 0.3, // Player collision radius
  
  // Network Configuration (NEW)
  POSITION_UPDATE_INTERVAL: 100, // Send position updates every 100ms (increased from 50ms to reduce spam)
  
  // Sound Configuration
  FOOTSTEP_INTERVAL: 400, // ms (adjusted for continuous movement)
  
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