// ========================================
// INPUT CONTROLLER
// Handles keyboard and mouse input
// ========================================

class InputController {
  constructor(movementController) {
    this.movementController = movementController;
    
    // Keyboard state
    this.keysPressed = {
      north: false,
      south: false,
      west: false,
      east: false
    };
    
    // Movement timing
    this.lastMoveTime = 0;
    this.moveInterval = 100; // ms between moves when holding key
    
    // Animation frame ID
    this.animationFrameId = null;
    
    Utils.logInfo("⌨️ InputController created");
  }

  /**
   * Initialize input listeners
   */
  init() {
    this.setupKeyboardListeners();
    this.startContinuousMovement();
    Utils.logInfo("✅ InputController initialized");
  }

  /**
   * Setup keyboard event listeners
   */
  setupKeyboardListeners() {
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    document.addEventListener("keyup", (e) => this.handleKeyUp(e));
    Utils.logInfo("⌨️ Keyboard listeners attached");
  }

  /**
   * Handle key down event
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    if (!gameState.gameStarted) return;
    
    const direction = this.getDirectionFromKey(e.key);
    
    if (direction && !this.keysPressed[direction]) {
      this.keysPressed[direction] = true;
      this.movementController.movePlayer(direction);
      e.preventDefault();
    }
  }

  /**
   * Handle key up event
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyUp(e) {
    if (!gameState.gameStarted) return;
    
    const direction = this.getDirectionFromKey(e.key);
    
    if (direction) {
      this.keysPressed[direction] = false;
    }
  }

  /**
   * Map key to direction
   * @param {string} key - Key pressed
   * @returns {string|null} - Direction or null
   */
  getDirectionFromKey(key) {
    const keyMap = {
      'w': 'north',
      'W': 'north',
      'ArrowUp': 'north',
      's': 'south',
      'S': 'south',
      'ArrowDown': 'south',
      'a': 'west',
      'A': 'west',
      'ArrowLeft': 'west',
      'd': 'east',
      'D': 'east',
      'ArrowRight': 'east'
    };
    
    return keyMap[key] || null;
  }

  /**
   * Start continuous movement loop
   */
  startContinuousMovement() {
    const updateMovement = () => {
      if (!gameState.gameStarted) {
        this.animationFrameId = requestAnimationFrame(updateMovement);
        return;
      }
      
      const now = Date.now();
      
      // Rate limit movement
      if (now - this.lastMoveTime >= this.moveInterval) {
        // Priority order: north > south > west > east
        if (this.keysPressed.north) {
          this.movementController.movePlayer("north");
          this.lastMoveTime = now;
        } else if (this.keysPressed.south) {
          this.movementController.movePlayer("south");
          this.lastMoveTime = now;
        } else if (this.keysPressed.west) {
          this.movementController.movePlayer("west");
          this.lastMoveTime = now;
        } else if (this.keysPressed.east) {
          this.movementController.movePlayer("east");
          this.lastMoveTime = now;
        }
      }
      
      this.animationFrameId = requestAnimationFrame(updateMovement);
    };
    
    updateMovement();
    Utils.logInfo("🔄 Continuous movement loop started");
  }

  /**
   * Stop continuous movement
   */
  stopContinuousMovement() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      Utils.logInfo("⏹️ Continuous movement stopped");
    }
  }

  /**
   * Reset all keys
   */
  resetKeys() {
    this.keysPressed = {
      north: false,
      south: false,
      west: false,
      east: false
    };
    Utils.logDebug("🔄 Keys reset");
  }

  /**
   * Check if any movement key is pressed
   * @returns {boolean}
   */
  isMoving() {
    return Object.values(this.keysPressed).some(pressed => pressed);
  }

  /**
   * Get current pressed direction
   * @returns {string|null}
   */
  getCurrentDirection() {
    if (this.keysPressed.north) return 'north';
    if (this.keysPressed.south) return 'south';
    if (this.keysPressed.west) return 'west';
    if (this.keysPressed.east) return 'east';
    return null;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopContinuousMovement();
    this.resetKeys();
    Utils.logInfo("🗑️ InputController destroyed");
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputController;
}

// Global instance
window.InputController = InputController;