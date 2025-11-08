// ========================================
// CAMERA CONTROLLER
// Handles camera positioning and movement
// ========================================

class CameraController {
  constructor(gameState, coordinateUtils) {
    this.gameState = gameState;
    this.coordinateUtils = coordinateUtils;
    this.camera = null;
    this.cameraRig = null;
  }

  /**
   * Initialize camera controller
   * @param {HTMLElement} camera - A-Frame camera element
   */
  init(camera) {
    this.camera = camera;
    this.cameraRig = camera.parentElement;
    
    // Disable A-Frame WASD controls
    this.disableDefaultControls();
    
    Utils.logInfo("📹 CameraController initialized");
  }

  /**
   * Disable A-Frame's default WASD controls
   */
  disableDefaultControls() {
    if (this.camera.hasAttribute('wasd-controls')) {
      this.camera.setAttribute('wasd-controls', 'enabled: false');
      Utils.logInfo("🚫 Disabled camera WASD controls");
    }
    
    if (this.cameraRig && this.cameraRig.id === 'rig') {
      if (this.cameraRig.hasAttribute('wasd-controls')) {
        this.cameraRig.setAttribute('wasd-controls', 'enabled: false');
        Utils.logInfo("🚫 Disabled rig WASD controls");
      }
    }
  }

  /**
   * Position camera at player location (instant)
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridZ - Grid Z coordinate
   */
  positionAtPlayer(gridX, gridZ) {
    if (!this.camera) {
      Utils.logError("❌ Camera not initialized");
      return;
    }

    const { worldX, worldZ } = this.coordinateUtils.gridToWorld(gridX, gridZ);
    const cameraHeight = CONFIG.CAMERA_HEIGHT || 1.6;
    
    const target = this.getTargetElement();
    target.setAttribute('position', `${worldX} ${cameraHeight} ${worldZ}`);
    
    Utils.logDebug(`📹 Camera positioned at (${worldX}, ${cameraHeight}, ${worldZ})`);
  }

  /**
   * Smoothly move camera to player position
   * @param {number} oldX - Old grid X
   * @param {number} oldZ - Old grid Z
   * @param {number} newX - New grid X
   * @param {number} newZ - New grid Z
   */
  smoothMoveTo(oldX, oldZ, newX, newZ) {
    if (!this.camera) return;

    const oldWorld = this.coordinateUtils.gridToWorld(oldX, oldZ);
    const newWorld = this.coordinateUtils.gridToWorld(newX, newZ);
    const cameraHeight = CONFIG.CAMERA_HEIGHT || 1.6;
    
    const target = this.getTargetElement();
    
    // Animate position only (no rotation)
    target.setAttribute('animation__move', {
      property: 'position',
      from: `${oldWorld.worldX} ${cameraHeight} ${oldWorld.worldZ}`,
      to: `${newWorld.worldX} ${cameraHeight} ${newWorld.worldZ}`,
      dur: CONFIG.CAMERA_SMOOTH_TIME || 150,
      easing: 'easeOutQuad'
    });
    
    // Remove any rotation animation
    target.removeAttribute('animation__rotate');
    
    Utils.logDebug(`📹 Camera moving to (${newWorld.worldX.toFixed(1)}, ${cameraHeight}, ${newWorld.worldZ.toFixed(1)})`);
  }

  /**
   * Get camera rotation (yaw only)
   * @returns {number} - Camera yaw in degrees
   */
  getRotation() {
    if (!this.camera) return 0;
    
    const rotation = this.camera.getAttribute('rotation');
    return rotation ? rotation.y : 0;
  }

  /**
   * Set camera rotation
   * @param {number} yaw - Yaw angle in degrees
   */
  setRotation(yaw) {
    if (!this.camera) return;
    
    const rotation = this.camera.getAttribute('rotation');
    this.camera.setAttribute('rotation', `${rotation.x} ${yaw} ${rotation.z}`);
  }

  /**
   * Get camera position
   * @returns {object} - {x, y, z}
   */
  getPosition() {
    if (!this.camera) return { x: 0, y: 0, z: 0 };
    
    const target = this.getTargetElement();
    const pos = target.getAttribute('position');
    return pos ? { x: pos.x, y: pos.y, z: pos.z } : { x: 0, y: 0, z: 0 };
  }

  /**
   * Get target element (rig or camera)
   * @returns {HTMLElement}
   */
  getTargetElement() {
    return (this.cameraRig && this.cameraRig.id === 'rig') 
      ? this.cameraRig 
      : this.camera;
  }

  /**
   * Look at position
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} z - World Z
   */
  lookAt(x, y, z) {
    if (!this.camera) return;
    
    const cameraPos = this.getPosition();
    const dx = x - cameraPos.x;
    const dz = z - cameraPos.z;
    
    const angle = Math.atan2(dx, -dz) * (180 / Math.PI);
    this.setRotation(angle);
  }

  /**
   * Shake camera effect (for impacts, etc)
   * @param {number} intensity - Shake intensity (0-1)
   * @param {number} duration - Duration in ms
   */
  shake(intensity = 0.5, duration = 300) {
    if (!this.camera) return;
    
    const target = this.getTargetElement();
    const currentPos = this.getPosition();
    
    target.setAttribute('animation__shake', {
      property: 'position',
      from: `${currentPos.x} ${currentPos.y} ${currentPos.z}`,
      to: `${currentPos.x + (Math.random() - 0.5) * intensity} ${currentPos.y} ${currentPos.z + (Math.random() - 0.5) * intensity}`,
      dur: duration / 4,
      dir: 'alternate',
      loop: 3,
      easing: 'easeInOutQuad'
    });
    
    setTimeout(() => {
      target.removeAttribute('animation__shake');
      target.setAttribute('position', `${currentPos.x} ${currentPos.y} ${currentPos.z}`);
    }, duration);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CameraController;
}

window.CameraController = CameraController;