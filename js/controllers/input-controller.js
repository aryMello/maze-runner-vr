// ========================================
// INPUT CONTROLLER (Smooth Continuous Movement)
// Handles keyboard input for continuous movement
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
    
    // Current active direction
    this.activeDirection = null;
    
    Utils.logInfo("⌨️ InputController created (continuous movement)");
  }

  /**
   * Initialize input listeners
   */
  init() {
    this.setupKeyboardListeners();
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
      this.updateMovement();
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
      this.updateMovement();
    }
  }

  /**
   * Update movement based on currently pressed keys
   */
  updateMovement() {
    // Priority order: north > south > west > east
    // Only one direction can be active at a time for cleaner movement
    let newDirection = null;
    
    if (this.keysPressed.north) {
      newDirection = "north";
    } else if (this.keysPressed.south) {
      newDirection = "south";
    } else if (this.keysPressed.west) {
      newDirection = "west";
    } else if (this.keysPressed.east) {
      newDirection = "east";
    }
    
    // Update movement if direction changed
    if (newDirection !== this.activeDirection) {
      this.activeDirection = newDirection;
      
      if (newDirection) {
        // Start moving in new direction
        this.movementController.setMovementDirection(newDirection);
        Utils.logDebug(`🎮 Started moving: ${newDirection}`);
      } else {
        // Stop movement
        this.movementController.stopMovement();
        Utils.logDebug("🎮 Stopped moving");
      }
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
   * Reset all keys
   */
  resetKeys() {
    this.keysPressed = {
      north: false,
      south: false,
      west: false,
      east: false
    };
    this.activeDirection = null;
    this.movementController.stopMovement();
    Utils.logDebug("🔄 Keys reset");
  }

  /**
   * Check if any movement key is pressed
   * @returns {boolean}
   */
  isMoving() {
    return this.activeDirection !== null;
  }

  /**
   * Get current pressed direction
   * @returns {string|null}
   */
  getCurrentDirection() {
    return this.activeDirection;
  }

  /**
   * Cleanup
   */
  destroy() {
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