// ========================================
// TREASURE MANAGER
// Manages all treasure-related functionality
// ========================================
class TreasureManager {
  constructor() {
    this.treasures = [];
    this.myTreasureCount = 0;
    this.collectRadius = 0.5; // Distance to auto-collect
    this.checkInterval = 1000; // Check every 100ms
    this.intervalId = null;
    this.lastCollectTime = 0;
    this.collectCooldown = 500; // Prevent double-collect
    this.treasuresContainer = null;
    this.collectSound = null;
    
    Utils.logInfo("💎 TreasureManager initialized");
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize treasure manager
   * Should be called after A-Frame scene is loaded
   */
  init() {
    Utils.logInfo("🎬 Initializing TreasureManager...");
    
    // Get references to DOM elements
    this.treasuresContainer = document.getElementById('treasures');
    this.collectSound = document.querySelector('#collect-sound');
    
    if (!this.treasuresContainer) {
      Utils.logWarn("⚠️ Treasures container not found in init, will create when needed");
    } else {
      Utils.logInfo("✅ Treasures container found in init");
    }
    
    Utils.logInfo("✅ TreasureManager initialized successfully");
  }

  /**
   * Create treasures container if it doesn't exist
   */
  createTreasuresContainer() {
    Utils.logInfo("🏗️ Creating treasures container...");
    
    const scene = document.querySelector('a-scene');
    if (!scene) {
      Utils.logError("❌ A-Frame scene not found!");
      return;
    }
    
    // Verifica se já existe (por segurança)
    let existing = document.getElementById('treasures');
    if (existing) {
      Utils.logInfo("✅ Treasures container already exists");
      this.treasuresContainer = existing;
      return;
    }
    
    // Cria novo container
    this.treasuresContainer = document.createElement('a-entity');
    this.treasuresContainer.setAttribute('id', 'treasures');
    scene.appendChild(this.treasuresContainer);
    
    Utils.logInfo("✅ Treasures container created and added to scene");
  }

  /**
   * Start automatic proximity checking
   */
  startProximityCheck() {
    if (this.intervalId) {
      Utils.logWarn("⚠️ Proximity check already running");
      return;
    }
    
    Utils.logInfo("🔄 Starting treasure proximity check...");
    
    this.intervalId = setInterval(() => {
      this.checkProximity();
    }, this.checkInterval);
    
    Utils.logInfo("✅ Proximity check started");
  }

  /**
   * Stop automatic proximity checking
   */
  stopProximityCheck() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      Utils.logInfo("⏹️ Proximity check stopped");
    }
  }

  // ========================================
  // TREASURE DATA MANAGEMENT
  // ========================================

  /**
   * Set treasures data from server
   * @param {Array} treasuresData - Array of treasure objects
   */
  setTreasures(treasuresData) {
    if (!treasuresData || !Array.isArray(treasuresData)) {
      Utils.logError("❌ Invalid treasures data:", treasuresData);
      return;
    }
    
    Utils.logInfo(`💎 Setting ${treasuresData.length} treasures`);
    this.treasures = treasuresData;
    
    // Count how many are already collected
    const collectedCount = this.treasures.filter(t => t.collected).length;
    const availableCount = this.treasures.length - collectedCount;
    
    Utils.logInfo(`📊 Treasures: ${availableCount} available, ${collectedCount} collected`);
  }

  /**
   * Get treasure by ID
   * @param {string} treasureId
   * @returns {object|null}
   */
  getTreasure(treasureId) {
    return this.treasures.find(t => t.id === treasureId) || null;
  }

  /**
   * Get all uncollected treasures
   * @returns {Array}
   */
  getAvailableTreasures() {
    return this.treasures.filter(t => !t.collected);
  }

  /**
   * Mark treasure as collected
   * @param {string} treasureId
   * @param {string} playerId
   */
  markAsCollected(treasureId, playerId) {
    const treasure = this.getTreasure(treasureId);
    
    if (!treasure) {
      Utils.logWarn(`⚠️ Treasure ${treasureId} not found`);
      return false;
    }
    
    if (treasure.collected) {
      Utils.logWarn(`⚠️ Treasure ${treasureId} already collected`);
      return false;
    }
    
    treasure.collected = true;
    treasure.collectedBy = playerId;
    
    Utils.logInfo(`✅ Treasure ${treasureId} marked as collected by ${playerId}`);
    return true;
  }

  // ========================================
  // RENDERING
  // ========================================

  /**
   * Render all treasures in the scene
   */
  renderTreasures() {
    Utils.logInfo("🎨 Starting treasure rendering...");
    
    // Tenta obter o container existente
    if (!this.treasuresContainer) {
      this.treasuresContainer = document.getElementById('treasures');
      Utils.logDebug("📦 Tried to get existing treasures container:", !!this.treasuresContainer);
    }
    
    // Se não existe, cria um novo
    if (!this.treasuresContainer) {
      Utils.logWarn("⚠️ Treasures container not found, creating one...");
      this.createTreasuresContainer();
    }
    
    // Verifica se conseguiu criar/obter
    if (!this.treasuresContainer) {
      Utils.logError("❌ Failed to create/get treasures container");
      return;
    }
    
    Utils.logInfo("✅ Treasures container ready");
    
    // Clear existing treasures
    this.treasuresContainer.innerHTML = '';
    
    if (!this.treasures || this.treasures.length === 0) {
      Utils.logWarn("⚠️ No treasures to render");
      return;
    }
    
    Utils.logInfo(`🎨 Rendering ${this.treasures.length} treasures...`);
    
    let renderedCount = 0;
    
    this.treasures.forEach(treasure => {
      if (!treasure.collected) {
        this.renderTreasure(treasure);
        renderedCount++;
      }
    });
    
    Utils.logInfo(`✅ Rendered ${renderedCount} treasures`);
  }

  /**
   * Render a single treasure
   * @param {object} treasure
   */
  renderTreasure(treasure) {
    const treasureEl = document.createElement('a-octahedron');
    
    treasureEl.setAttribute('id', treasure.id);
    treasureEl.setAttribute('position', `${treasure.x} 1 ${treasure.z}`);
    treasureEl.setAttribute('radius', '0.5');
    treasureEl.setAttribute('color', '#FFD700');
    treasureEl.setAttribute('metalness', '0.8');
    treasureEl.setAttribute('roughness', '0.2');
    treasureEl.setAttribute('class', 'treasure');
    treasureEl.setAttribute('shadow', 'cast: true');
    
    // Rotation animation
    treasureEl.setAttribute('animation', {
      property: 'rotation',
      to: '0 360 0',
      loop: true,
      dur: 3000,
      easing: 'linear'
    });
    
    // Hover animation (up and down)
    treasureEl.setAttribute('animation__hover', {
      property: 'position',
      to: `${treasure.x} 1.5 ${treasure.z}`,
      dir: 'alternate',
      loop: true,
      dur: 1000,
      easing: 'easeInOutSine'
    });
    
    this.treasuresContainer.appendChild(treasureEl);
    
    Utils.logDebug(`✨ Rendered treasure ${treasure.id} at (${treasure.x}, ${treasure.z})`);
  }

  /**
   * Remove treasure from scene
   * @param {string} treasureId
   */
  removeTreasureFromScene(treasureId) {
    const treasureEl = document.getElementById(treasureId);
    
    if (!treasureEl) {
      Utils.logDebug(`⚠️ Treasure element ${treasureId} not found in DOM`);
      return;
    }
    
    Utils.logInfo(`🗑️ Removing treasure ${treasureId} from scene`);
    
    // Play collection animation
    treasureEl.setAttribute('animation__collect', {
      property: 'scale',
      to: '0 0 0',
      dur: 300,
      easing: 'easeInBack'
    });
    
    treasureEl.setAttribute('animation__spin', {
      property: 'rotation',
      to: '0 720 0',
      dur: 300,
      easing: 'easeInBack'
    });
    
    // Remove after animation
    setTimeout(() => {
      if (treasureEl.parentNode) {
        treasureEl.parentNode.removeChild(treasureEl);
        Utils.logDebug(`✅ Treasure ${treasureId} removed from DOM`);
      }
    }, 300);
  }

  // ========================================
  // COLLECTION LOGIC
  // ========================================

  /**
 * Check proximity to treasures and auto-collect
 */
  checkProximity() {
    if (!gameState.gameStarted) return;
    if (!gameState.myPlayerId) return;
    
    const myPlayer = gameState.players[gameState.myPlayerId];
    if (!myPlayer) return;
    
    // Check cooldown
    const now = Date.now();
    if (now - this.lastCollectTime < this.collectCooldown) {
      return;
    }
    
    // Find closest uncollected treasure
    let closestTreasure = null;
    let closestDistance = Infinity;
    
    this.treasures.forEach(treasure => {
      if (treasure.collected) return;
      
      const distance = this.calculateDistance(myPlayer, treasure);
      
      if (distance < this.collectRadius && distance < closestDistance) {
        closestDistance = distance;
        closestTreasure = treasure;
      }
    });
    
    // Collect only the closest one
    if (closestTreasure) {
      this.collectTreasure(closestTreasure.id);
    }
  }

  /**
   * Calculate distance between player and treasure
   * @param {object} player - Player with x, z coordinates
   * @param {object} treasure - Treasure with x, z coordinates
   * @returns {number}
   */
  calculateDistance(player, treasure) {
    const dx = Math.abs(player.x - treasure.x);
    const dz = Math.abs(player.z - treasure.z);
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
 * Attempt to collect a treasure
 * @param {string} treasureId
 */
  collectTreasure(treasureId) {
    const treasure = this.getTreasure(treasureId);
    
    if (!treasure) {
      Utils.logWarn(`⚠️ Treasure ${treasureId} not found`);
      return;
    }
    
    if (treasure.collected) {
      Utils.logDebug(`⏭️ Treasure ${treasureId} already collected, skipping`);
      return;
    }
    
    Utils.logInfo(`💎 Attempting to collect treasure ${treasureId}`);
    
    // MARQUE COMO COLETADO IMEDIATAMENTE para evitar spam
    treasure.collected = true;
    
    // Check if socket is connected - TENTE MÚLTIPLAS FORMAS
    const socket = window.socket || window.gameController?.socket || gameController?.socket;
    
    if (!socket) {
      Utils.logError("❌ Cannot collect - socket not found");
      treasure.collected = false; // Reverte
      return;
    }
    
    if (!socket.isConnected || !socket.isConnected()) {
      Utils.logError("❌ Cannot collect - not connected to server");
      treasure.collected = false; // Reverte
      return;
    }
    
    // Send collection event to server
    const sent = socket.emit("collect_treasure", {
      playerId: gameState.myPlayerId,
      treasureId: treasureId
    });
    
    if (!sent) {
      Utils.logError("❌ Failed to send collect_treasure message");
      treasure.collected = false; // Reverte
      return;
    }
    
    Utils.logInfo(`✅ Collection request sent for ${treasureId}`);
    
    // Remove do DOM imediatamente
    this.removeTreasureFromScene(treasureId);
    
    // Update last collect time (cooldown)
    this.lastCollectTime = Date.now();
  }

  /**
 * Handle treasure collection confirmation from server
 * @param {object} data - Server response {treasureId, playerId, treasures}
 */
  handleTreasureCollected(data) {
    Utils.logInfo("💎 Treasure collected event received:", data);
    
    const treasureId = data.treasureId;
    const playerId = data.playerId;
    
    // Mark as collected locally
    const treasure = this.getTreasure(treasureId);
    if (treasure) {
      treasure.collected = true;
      treasure.collectedBy = playerId;
    }
    
    // Remove from scene (se ainda não foi removido)
    this.removeTreasureFromScene(treasureId);
    
    // If I collected it
    if (playerId === gameState.myPlayerId) {
      this.myTreasureCount++;
      
      Utils.logInfo(`📊 My treasure count: ${this.myTreasureCount}/${this.treasures.length}`);
      
      // Update UI
      this.updateTreasureCountUI();
      
      // Show feedback
      this.showCollectionFeedback();
      
      // Play sound
      this.playCollectSound();
    }
    
    // Update player's treasure count
    if (gameState.players[playerId]) {
      const newCount = data.treasures !== undefined ? data.treasures : (gameState.players[playerId].treasures || 0) + 1;
      gameState.players[playerId].treasures = newCount;
      
      Utils.logInfo(`📊 ${gameState.players[playerId].name} now has ${newCount} treasures`);
    }
    
    // ATUALIZAR LEADERBOARD (CRÍTICO!)
    if (window.uiManager) {
      uiManager.updateLeaderboard();
      Utils.logInfo("✅ Leaderboard updated");
    }
  }

  // ========================================
  // UI & FEEDBACK
  // ========================================

  /**
   * Update treasure count in UI
   */
  updateTreasureCountUI() {
    const treasureCountEl = document.getElementById('treasureCount');
    
    if (treasureCountEl) {
      const totalTreasures = this.treasures.length;
      treasureCountEl.textContent = `${this.myTreasureCount}/${totalTreasures}`;
      Utils.logDebug(`✅ Treasure count UI updated: ${this.myTreasureCount}/${totalTreasures}`);
    } else {
      Utils.logWarn("⚠️ Treasure count element not found");
    }
  }

  /**
   * Show visual feedback when collecting treasure
   */
  showCollectionFeedback() {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 48px;
      font-weight: bold;
      color: #FFD700;
      text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
      animation: collectFeedback 1s ease-out;
      pointer-events: none;
      z-index: 10000;
    `;
    feedback.textContent = '💎 +1 Tesouro!';
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      if (feedback.parentNode) {
        document.body.removeChild(feedback);
      }
    }, 1000);
    
    Utils.logDebug("✨ Collection feedback shown");
  }

  /**
   * Play collection sound
   */
  playCollectSound() {
    if (!this.collectSound) {
      this.collectSound = document.querySelector('#collect-sound');
    }
    
    if (this.collectSound && this.collectSound.components && this.collectSound.components.sound) {
      try {
        this.collectSound.components.sound.playSound();
        Utils.logDebug("🔊 Collect sound played");
      } catch (e) {
        Utils.logDebug("⚠️ Could not play collect sound:", e.message);
      }
    }
  }

  // ========================================
  // CLICK-TO-COLLECT (ALTERNATIVE METHOD)
  // ========================================

  /**
   * Setup click-to-collect instead of proximity
   * Alternative to automatic proximity checking
   */
  setupClickToCollect() {
    Utils.logInfo("🖱️ Setting up click-to-collect...");
    
    const scene = document.querySelector('a-scene');
    
    if (!scene) {
      Utils.logError("❌ A-Frame scene not found");
      return;
    }
    
    scene.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked on a treasure
      if (target && target.classList && target.classList.contains('treasure')) {
        const treasureId = target.id;
        
        Utils.logInfo(`🖱️ Clicked on treasure: ${treasureId}`);
        
        // Check if treasure is still available
        const treasure = this.getTreasure(treasureId);
        
        if (!treasure || treasure.collected) {
          Utils.logWarn(`⚠️ Treasure ${treasureId} not available`);
          return;
        }
        
        // Check distance (optional - prevent collecting from too far)
        const myPlayer = gameState.players[gameState.myPlayerId];
        
        if (myPlayer) {
          const distance = this.calculateDistance(myPlayer, treasure);
          const maxClickDistance = 3.0;
          
          if (distance < maxClickDistance) {
            Utils.logInfo(`✅ Distance OK (${distance.toFixed(2)}), collecting...`);
            this.collectTreasure(treasureId);
          } else {
            Utils.logWarn(`⚠️ Too far to collect (${distance.toFixed(2)})`);
            alert('Você está muito longe! Aproxime-se do tesouro.');
          }
        }
      }
    });
    
    Utils.logInfo("✅ Click-to-collect enabled");
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Reset treasure manager state
   */
  reset() {
    Utils.logInfo("🔄 Resetting TreasureManager...");
    
    this.stopProximityCheck();
    this.treasures = [];
    this.myTreasureCount = 0;
    this.lastCollectTime = 0;
    
    if (this.treasuresContainer) {
      this.treasuresContainer.innerHTML = '';
    }
    
    Utils.logInfo("✅ TreasureManager reset");
  }

  /**
   * Get statistics
   * @returns {object}
   */
  getStats() {
    const total = this.treasures.length;
    const collected = this.treasures.filter(t => t.collected).length;
    const available = total - collected;
    
    return {
      total,
      collected,
      available,
      myCount: this.myTreasureCount,
      collectionRate: total > 0 ? (collected / total * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Log current state (for debugging)
   */
  logState() {
    const stats = this.getStats();
    
    console.group("💎 TreasureManager State");
    console.log("Total treasures:", stats.total);
    console.log("Collected:", stats.collected);
    console.log("Available:", stats.available);
    console.log("My count:", stats.myCount);
    console.log("Collection rate:", stats.collectionRate);
    console.log("Proximity check active:", !!this.intervalId);
    console.groupEnd();
  }
}

// ========================================
// GLOBAL INSTANCE
// ========================================

// Create global instance
const treasureManager = new TreasureManager();

// Expose globally
window.treasureManager = treasureManager;

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TreasureManager;
}