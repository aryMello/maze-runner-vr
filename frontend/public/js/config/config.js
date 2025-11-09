// Configuration
const CONFIG = {
  // Server Configuration
  SERVER_URL: "wss://jogo-s89j.onrender.com",
  WS_PATH: "/ws",
  IS_LOCAL: false,
  
  // Game Configuration
  CELL_SIZE: 4,
  MOVE_SPEED: 0.3, // Movement step size in grid units
  COLLECT_RADIUS: 1.5,
  
  // Camera Configuration
  CAMERA_HEIGHT: 1.6, // Eye level on player's head
  CAMERA_SMOOTH_TIME: 150, // ms for smooth camera movement
  CAMERA_BASED_MOVEMENT: true, // Use camera direction for WASD (Minecraft style)
  
  // Sound Configuration
  FOOTSTEP_INTERVAL: 200, // ms
  
  // Animation Configuration
  COUNTDOWN_START: 3,
  COUNTDOWN_INTERVAL: 1000, // ms

  // VR Configuration
  VR_MODE: true, // Set to true to force VR mode, false for auto-detect
  VR_GAZE_TIME: 1000, // ms to confirm movement by looking
  VR_MOVE_COOLDOWN: 300, // ms between moves
  
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