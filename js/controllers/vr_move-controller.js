// ========================================
// VR AUTO-WALK CONTROLLER
// Handles automatic forward movement in VR mode
// ========================================

class VRAutoWalkController {
  constructor(movementController, cameraController) {
    this.movementController = movementController;
    this.cameraController = cameraController;
    
    // VR state
    this.isVRMode = false;
    this.isAutoWalking = false;
    this.lastLookDirection = 0;
    this.directionChangeThreshold = 15; // degrees to trigger stop
    
    // Check interval
    this.checkInterval = null;
    this.checkFrequency = 100; // Check every 100ms
    
    Utils.logInfo("🥽 VRAutoWalkController created");
  }

  /**
   * Initialize VR controller
   */
  init() {
    this.setupVRDetection();
    Utils.logInfo("✅ VRAutoWalkController initialized");
  }

  /**
   * Setup VR mode detection
   */
  setupVRDetection() {
    const scene = document.querySelector('a-scene');
    
    if (!scene) {
      Utils.logWarn("⚠️ A-Frame scene not found");
      return;
    }

    // Listen for VR mode enter
    scene.addEventListener('enter-vr', () => {
      Utils.logInfo("🥽 Entered VR mode - starting auto-walk");
      this.enterVRMode();
    });

    // Listen for VR mode exit
    scene.addEventListener('exit-vr', () => {
      Utils.logInfo("🖥️ Exited VR mode - stopping auto-walk");
      this.exitVRMode();
    });

    // Check if already in VR
    if (scene.is('vr-mode')) {
      this.enterVRMode();
    }

    Utils.logInfo("✅ VR detection setup complete");
  }

  /**
   * Enter VR mode - start auto-walking
   */
  enterVRMode() {
    this.isVRMode = true;
    
    // Get initial camera direction
    this.lastLookDirection = this.getCurrentCameraYaw();
    
    // Start auto-walking forward
    this.startAutoWalk();
    
    // Start monitoring camera direction
    this.startDirectionMonitoring();
    
    Utils.logInfo("🥽 VR mode activated - auto-walk started");
  }

  /**
   * Exit VR mode - stop auto-walking
   */
  exitVRMode() {
    this.isVRMode = false;
    
    // Stop auto-walk
    this.stopAutoWalk();
    
    // Stop monitoring
    this.stopDirectionMonitoring();
    
    Utils.logInfo("🖥️ VR mode deactivated");
  }

  /**
   * Start automatic forward movement
   */
  startAutoWalk() {
    if (!this.isVRMode || this.isAutoWalking) return;
    
    this.isAutoWalking = true;
    
    // Tell movement controller to move forward continuously
    this.movementController.setMovementDirection("north");
    
    Utils.logInfo("🚶 Auto-walk started");
  }

  /**
   * Stop automatic movement
   */
  stopAutoWalk() {
    if (!this.isAutoWalking) return;
    
    this.isAutoWalking = false;
    
    // Stop movement
    this.movementController.stopMovement();
    
    Utils.logInfo("⏸️ Auto-walk stopped");
  }

  /**
   * Start monitoring camera direction changes
   */
  startDirectionMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkCameraDirection();
    }, this.checkFrequency);

    Utils.logInfo("👁️ Direction monitoring started");
  }

  /**
   * Stop direction monitoring
   */
  stopDirectionMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    Utils.logInfo("👁️ Direction monitoring stopped");
  }

  /**
   * Check if camera direction has changed significantly
   */
  checkCameraDirection() {
    if (!this.isVRMode || !gameState.gameStarted) return;

    const currentYaw = this.getCurrentCameraYaw();
    const angleDiff = this.getAngleDifference(this.lastLookDirection, currentYaw);

    // If direction changed significantly
    if (Math.abs(angleDiff) > this.directionChangeThreshold) {
      Utils.logDebug(`📐 Direction changed by ${angleDiff.toFixed(1)}° - stopping`);
      
      // Stop current movement
      this.stopAutoWalk();
      
      // Update last direction
      this.lastLookDirection = currentYaw;
      
      // Brief pause before starting again
      setTimeout(() => {
        if (this.isVRMode && gameState.gameStarted) {
          this.startAutoWalk();
        }
      }, 200);
    }
  }

  /**
   * Get current camera yaw (horizontal rotation)
   * @returns {number} - Yaw in degrees
   */
  getCurrentCameraYaw() {
    if (!this.cameraController || !this.cameraController.camera) {
      return 0;
    }

    const cameraEl = this.cameraController.camera.object3D;
    const forwardVector = new THREE.Vector3(0, 0, -1);
    forwardVector.applyQuaternion(cameraEl.quaternion);
    
    // Project to horizontal plane
    forwardVector.y = 0;
    forwardVector.normalize();
    
    // Calculate yaw
    const yaw = Math.atan2(forwardVector.x, -forwardVector.z) * (180 / Math.PI);
    return yaw;
  }

  /**
   * Calculate angle difference (shortest path)
   * @param {number} angle1 - First angle in degrees
   * @param {number} angle2 - Second angle in degrees
   * @returns {number} - Difference in degrees (-180 to 180)
   */
  getAngleDifference(angle1, angle2) {
    let diff = angle2 - angle1;
    
    // Normalize to -180 to 180
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    
    return diff;
  }

  /**
   * Handle collision - stop auto-walk
   */
  onCollision() {
    if (this.isAutoWalking) {
      Utils.logInfo("💥 Collision detected - stopping auto-walk");
      this.stopAutoWalk();
      
      // Restart after a moment
      setTimeout(() => {
        if (this.isVRMode && gameState.gameStarted) {
          Utils.logInfo("🔄 Restarting auto-walk after collision");
          this.startAutoWalk();
        }
      }, 500);
    }
  }

  /**
   * Set direction change sensitivity
   * @param {number} degrees - Threshold in degrees
   */
  setSensitivity(degrees) {
    this.directionChangeThreshold = Math.max(5, Math.min(45, degrees));
    Utils.logInfo(`📐 Direction threshold set to ${this.directionChangeThreshold}°`);
  }

  /**
   * Check if currently in VR mode
   * @returns {boolean}
   */
  isInVRMode() {
    return this.isVRMode;
  }

  /**
   * Check if currently auto-walking
   * @returns {boolean}
   */
  isWalking() {
    return this.isAutoWalking;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopAutoWalk();
    this.stopDirectionMonitoring();
    Utils.logInfo("🗑️ VRAutoWalkController destroyed");
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRAutoWalkController;
}

window.VRAutoWalkController = VRAutoWalkController;