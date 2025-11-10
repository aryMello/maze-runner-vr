// ========================================
// VR HEAD-BASED MOVEMENT CONTROLLER
// Allows player to move by looking in a direction
// and confirming with gaze or button press
// ========================================

class VRMovementController {
  constructor(movementController, gameState) {
    this.movementController = movementController;
    this.gameState = gameState;
    
    // Gaze detection
    this.camera = null;
    this.currentDirection = null;
    this.directionIndicators = {};
    
    // Gaze confirmation
    this.gazeStartTime = 0;
    this.gazeThreshold = 1000; // 1 second to confirm
    this.lastMoveTime = 0;
    this.moveCooldown = 300; // Prevent rapid moves
    
    // Direction zones (in degrees)
    this.directionZones = {
      north: { min: -45, max: 45 },      // Forward
      east: { min: 45, max: 135 },       // Right
      south: { min: 135, max: 225 },     // Backward (or -135 to -225)
      west: { min: 225, max: 315 }       // Left (or -45 to -135)
    };
    
    Utils.logInfo("👁️ VR Movement Controller created");
  }

  /**
   * Initialize VR movement system
   * @param {HTMLElement} camera - A-Frame camera element
   */
  init(camera) {
    this.camera = camera;
    this.createDirectionIndicators();
    this.startDirectionDetection();
    this.createVRToggleButton();
    
    Utils.logInfo("✅ VR Movement Controller initialized");
  }

  /**
   * Create VR mode toggle button
   */
  createVRToggleButton() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'vr-mode-toggle';
    toggleBtn.textContent = '🥽 VR Mode: ON';
    toggleBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      padding: 15px 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    `;

    toggleBtn.addEventListener('mouseover', () => {
      toggleBtn.style.transform = 'scale(1.05)';
    });

    toggleBtn.addEventListener('mouseout', () => {
      toggleBtn.style.transform = 'scale(1)';
    });

    toggleBtn.addEventListener('click', () => {
      this.toggleVRMode();
    });

    document.body.appendChild(toggleBtn);
    this.toggleButton = toggleBtn;
  }

  /**
   * Toggle VR mode on/off
   */
  toggleVRMode() {
    const isVisible = this.isIndicatorsVisible();
    this.setIndicatorsVisible(!isVisible);

    if (this.toggleButton) {
      this.toggleButton.textContent = isVisible ? '🥽 VR Mode: OFF' : '🥽 VR Mode: ON';
      this.toggleButton.style.background = isVisible 
        ? 'linear-gradient(135deg, #666 0%, #999 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    Utils.logInfo(`🥽 VR Mode ${isVisible ? 'disabled' : 'enabled'}`);
  }

  /**
   * Check if indicators are visible
   * @returns {boolean}
   */
  isIndicatorsVisible() {
    const container = document.getElementById('direction-indicators');
    if (!container) return false;
    const visible = container.getAttribute('visible');
    return visible !== 'false';
  }

  /**
   * Create visual indicators for each direction
   */
  createDirectionIndicators() {
    const scene = document.querySelector('a-scene');
    if (!scene) {
      Utils.logError("❌ Scene not found");
      return;
    }

    const camera = this.camera;
    if (!camera) {
      Utils.logError("❌ Camera not found");
      return;
    }

    // Create container attached to CAMERA (not rig)
    // This makes indicators move with head look direction
    const indicatorContainer = document.createElement('a-entity');
    indicatorContainer.setAttribute('id', 'direction-indicators');
    indicatorContainer.setAttribute('position', '0 0 0');
    camera.appendChild(indicatorContainer);

    // Direction configurations - positioned in VIEW space
    // These are relative to where the camera is looking
    const directions = [
      { name: 'north', position: '0 0.8 -2.5', color: '#4ECDC4', icon: '↑', label: 'FRENTE' },
      { name: 'south', position: '0 -0.8 -2.5', color: '#FF6B6B', icon: '↓', label: 'TRÁS' },
      { name: 'east', position: '1.2 0 -2.5', color: '#FFA07A', icon: '→', label: 'DIREITA' },
      { name: 'west', position: '-1.2 0 -2.5', color: '#45B7D1', icon: '←', label: 'ESQUERDA' }
    ];

    directions.forEach(dir => {
      // Create indicator group
      const indicator = document.createElement('a-entity');
      indicator.setAttribute('id', `indicator-${dir.name}`);
      indicator.setAttribute('position', dir.position);
      indicator.setAttribute('class', 'direction-indicator');
      indicator.setAttribute('data-direction', dir.name); // Add data attribute

      // Background circle (clickable/raycastable)
      const circle = document.createElement('a-circle');
      circle.setAttribute('radius', '0.3');
      circle.setAttribute('color', dir.color);
      circle.setAttribute('opacity', '0.4');
      circle.setAttribute('side', 'double');
      circle.setAttribute('class', 'direction-indicator'); // Make it detectable
      circle.setAttribute('data-direction', dir.name);
      indicator.appendChild(circle);

      // Direction arrow/text (larger)
      const text = document.createElement('a-text');
      text.setAttribute('value', dir.icon);
      text.setAttribute('align', 'center');
      text.setAttribute('color', '#FFFFFF');
      text.setAttribute('width', '3');
      text.setAttribute('position', '0 0 0.01');
      indicator.appendChild(text);

      // Label below arrow
      const label = document.createElement('a-text');
      label.setAttribute('value', dir.label);
      label.setAttribute('align', 'center');
      label.setAttribute('color', '#FFFFFF');
      label.setAttribute('width', '1.5');
      label.setAttribute('position', '0 -0.35 0.01');
      indicator.appendChild(label);

      // Progress ring (for gaze confirmation)
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', '0.32');
      ring.setAttribute('radius-outer', '0.38');
      ring.setAttribute('color', '#FFD700');
      ring.setAttribute('opacity', '0');
      ring.setAttribute('theta-length', '0');
      ring.setAttribute('rotation', '0 0 -90');
      ring.setAttribute('side', 'double');
      ring.setAttribute('class', 'progress-ring');
      indicator.appendChild(ring);

      indicatorContainer.appendChild(indicator);
      this.directionIndicators[dir.name] = indicator;
    });

    Utils.logInfo("✅ Direction indicators created (camera-relative)");
  }

  /**
   * Start continuous direction detection
   */
  startDirectionDetection() {
    const updateLoop = () => {
      if (this.gameState.gameStarted) {
        this.updateDirection();
        this.updateGazeProgress();
      }
      requestAnimationFrame(updateLoop);
    };

    updateLoop();
    Utils.logInfo("🔄 Direction detection started");
  }

  /**
   * Update current direction based on what player is looking at
   * Uses raycasting to detect which indicator is in view
   */
  updateDirection() {
    if (!this.camera) return;

    // Get camera raycaster
    let raycaster = this.camera.components.raycaster;
    
    // If raycaster doesn't exist, create it
    if (!raycaster) {
      this.camera.setAttribute('raycaster', {
        objects: '.direction-indicator',
        far: 5,
        interval: 50
      });
      raycaster = this.camera.components.raycaster;
    }

    let newDirection = null;

    // Method 1: Check raycaster intersections
    if (raycaster && raycaster.intersections && raycaster.intersections.length > 0) {
      const intersections = raycaster.intersections;
      
      for (let i = 0; i < intersections.length; i++) {
        const intersection = intersections[i];
        const el = intersection.object.el;
        
        if (el) {
          // Check element itself
          const dataDir = el.getAttribute('data-direction');
          if (dataDir) {
            newDirection = dataDir;
            break;
          }
          
          // Check parent
          if (el.parentElement) {
            const parentDir = el.parentElement.getAttribute('data-direction');
            if (parentDir) {
              newDirection = parentDir;
              break;
            }
            
            // Check parent's ID
            const parentId = el.parentElement.id;
            if (parentId && parentId.startsWith('indicator-')) {
              newDirection = parentId.replace('indicator-', '');
              break;
            }
          }
          
          // Check element's ID
          const elId = el.id;
          if (elId && elId.startsWith('indicator-')) {
            newDirection = elId.replace('indicator-', '');
            break;
          }
        }
      }
      
      // Debug: Log first intersection
      if (intersections.length > 0) {
        const first = intersections[0];
        Utils.logDebug(`🎯 Raycaster hit: ${first.object.el?.id || 'unknown'}, distance: ${first.distance.toFixed(2)}`);
      }
    }

    // Method 2: Fallback - check camera rotation and proximity to indicators
    if (!newDirection) {
      newDirection = this.detectDirectionByPosition();
    }

    // Direction changed
    if (newDirection !== this.currentDirection) {
      this.onDirectionChange(newDirection);
    }
  }

  /**
   * Fallback method: Detect direction by camera rotation
   * Used when raycasting fails
   */
  detectDirectionByPosition() {
    if (!this.camera) return null;

    const rotation = this.camera.getAttribute('rotation');
    if (!rotation) return null;

    const pitch = rotation.x; // Up/Down
    const yaw = rotation.y;   // Left/Right

    // Determine direction based on where camera is pointing
    // Priority: Pitch first (up/down), then yaw (left/right)
    
    // Strong UP tilt (looking at top button)
    if (pitch < -15) {
      return 'north'; // FRENTE (up button)
    }
    
    // Strong DOWN tilt (looking at bottom button)
    if (pitch > 15) {
      return 'south'; // TRÁS (down button)
    }
    
    // Moderate pitch range - check yaw for left/right
    if (Math.abs(pitch) <= 15) {
      // Normalize yaw to -180 to 180
      let normalizedYaw = yaw;
      while (normalizedYaw > 180) normalizedYaw -= 360;
      while (normalizedYaw < -180) normalizedYaw += 360;
      
      // Looking LEFT (negative yaw)
      if (normalizedYaw < -15) {
        return 'west'; // ESQUERDA
      }
      
      // Looking RIGHT (positive yaw)
      if (normalizedYaw > 15) {
        return 'east'; // DIREITA
      }
    }

    return null;
  }

  /**
   * Normalize angle to -180 to 180 range
   * @param {number} angle - Angle in degrees
   * @returns {number}
   */
  normalizeAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  /**
   * Handle direction change
   * @param {string} newDirection
   */
  onDirectionChange(newDirection) {
    // Reset previous direction
    if (this.currentDirection) {
      this.resetIndicator(this.currentDirection);
    }

    this.currentDirection = newDirection;
    this.gazeStartTime = Date.now();

    // Highlight new direction
    if (this.currentDirection) {
      this.highlightIndicator(this.currentDirection);
      Utils.logDebug(`👁️ Looking ${this.currentDirection}`);
    }
  }

  /**
   * Update gaze progress for current direction
   */
  updateGazeProgress() {
    if (!this.currentDirection) return;

    const now = Date.now();
    const elapsed = now - this.gazeStartTime;
    const progress = Math.min(elapsed / this.gazeThreshold, 1);

    // Update progress ring
    this.updateProgressRing(this.currentDirection, progress);

    // Confirm move when gaze time reached
    if (progress >= 1 && now - this.lastMoveTime > this.moveCooldown) {
      this.confirmMove(this.currentDirection);
    }
  }

  /**
   * Highlight direction indicator
   * @param {string} direction
   */
  highlightIndicator(direction) {
    const indicator = this.directionIndicators[direction];
    if (!indicator) return;

    const circle = indicator.querySelector('a-circle');
    if (circle) {
      circle.setAttribute('opacity', '0.8');
      circle.setAttribute('animation', {
        property: 'scale',
        to: '1.2 1.2 1.2',
        dur: 200,
        easing: 'easeOutQuad'
      });
    }
  }

  /**
   * Reset direction indicator
   * @param {string} direction
   */
  resetIndicator(direction) {
    const indicator = this.directionIndicators[direction];
    if (!indicator) return;

    const circle = indicator.querySelector('a-circle');
    if (circle) {
      circle.setAttribute('opacity', '0.3');
      circle.setAttribute('scale', '1 1 1');
      circle.removeAttribute('animation');
    }

    // Reset progress ring
    const ring = indicator.querySelector('.progress-ring');
    if (ring) {
      ring.setAttribute('theta-length', '0');
      ring.setAttribute('opacity', '0');
    }
  }

  /**
   * Update progress ring for gaze confirmation
   * @param {string} direction
   * @param {number} progress - 0 to 1
   */
  updateProgressRing(direction, progress) {
    const indicator = this.directionIndicators[direction];
    if (!indicator) return;

    const ring = indicator.querySelector('.progress-ring');
    if (!ring) return;

    const angle = progress * 360;
    ring.setAttribute('theta-length', angle.toString());
    ring.setAttribute('opacity', progress > 0 ? '0.9' : '0');
  }

  /**
   * Confirm and execute move
   * @param {string} direction
   */
  confirmMove(direction) {
    Utils.logInfo(`🎯 confirmMove called: ${direction}`);
    
    if (!this.gameState.gameStarted) {
      Utils.logWarn("⚠️ Game not started yet!");
      return;
    }

    const now = Date.now();
    const cooldownRemaining = this.moveCooldown - (now - this.lastMoveTime);
    
    if (cooldownRemaining > 0) {
      Utils.logWarn(`⏳ Cooldown active: ${cooldownRemaining}ms remaining`);
      return;
    }

    Utils.logInfo(`✅ Attempting move: ${direction}`);

    // Execute movement
    const success = this.movementController.movePlayer(direction);

    Utils.logInfo(`📊 Move result: ${success ? 'SUCCESS' : 'FAILED'}`);

    if (success) {
      // Visual feedback
      this.showMoveConfirmation(direction);
      
      // Play haptic feedback if available
      this.triggerHaptic();
    } else {
      Utils.logWarn(`❌ Move blocked or failed: ${direction}`);
    }

    // Reset for next move
    this.resetIndicator(direction);
    this.gazeStartTime = Date.now();
    this.lastMoveTime = Date.now();
  }

  /**
   * Show visual confirmation of movement
   * @param {string} direction
   */
  showMoveConfirmation(direction) {
    const indicator = this.directionIndicators[direction];
    if (!indicator) return;

    const circle = indicator.querySelector('a-circle');
    if (circle) {
      // Flash effect
      circle.setAttribute('animation__flash', {
        property: 'opacity',
        from: '1',
        to: '0.3',
        dur: 200,
        easing: 'easeOutQuad'
      });
    }
  }

  /**
   * Trigger haptic feedback (if supported)
   */
  triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  /**
   * Toggle indicators visibility
   * @param {boolean} visible
   */
  setIndicatorsVisible(visible) {
    const container = document.getElementById('direction-indicators');
    if (container) {
      container.setAttribute('visible', visible.toString());
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    const container = document.getElementById('direction-indicators');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    
    this.directionIndicators = {};
    Utils.logInfo("🗑️ VR Movement Controller destroyed");
  }
}

// ========================================
// ALTERNATIVE: BUTTON-BASED MOVEMENT
// For devices without reliable gaze detection
// ========================================

class VRButtonMovement {
  constructor(movementController) {
    this.movementController = movementController;
    this.buttons = {};
  }

  /**
   * Create movement buttons in VR space
   */
  createButtons() {
    const rig = document.getElementById('rig');
    if (!rig) return;

    const buttonContainer = document.createElement('a-entity');
    buttonContainer.setAttribute('id', 'vr-buttons');
    buttonContainer.setAttribute('position', '0 -0.5 -1.5');
    rig.appendChild(buttonContainer);

    const configs = [
      { dir: 'north', pos: '0 0.3 0', label: '↑' },
      { dir: 'south', pos: '0 -0.3 0', label: '↓' },
      { dir: 'east', pos: '0.3 0 0', label: '→' },
      { dir: 'west', pos: '-0.3 0 0', label: '←' }
    ];

    configs.forEach(cfg => {
      const btn = document.createElement('a-entity');
      btn.setAttribute('geometry', 'primitive: circle; radius: 0.1');
      btn.setAttribute('material', 'color: #4ECDC4; opacity: 0.8');
      btn.setAttribute('position', cfg.pos);
      btn.setAttribute('class', 'clickable vr-move-button');
      btn.setAttribute('data-direction', cfg.dir);

      const text = document.createElement('a-text');
      text.setAttribute('value', cfg.label);
      text.setAttribute('align', 'center');
      text.setAttribute('color', '#FFFFFF');
      text.setAttribute('width', '2');
      text.setAttribute('position', '0 0 0.01');
      btn.appendChild(text);

      btn.addEventListener('click', () => {
        this.movementController.movePlayer(cfg.dir);
      });

      buttonContainer.appendChild(btn);
      this.buttons[cfg.dir] = btn;
    });

    Utils.logInfo("✅ VR buttons created");
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VRMovementController, VRButtonMovement };
}

window.VRMovementController = VRMovementController;
window.VRButtonMovement = VRButtonMovement;