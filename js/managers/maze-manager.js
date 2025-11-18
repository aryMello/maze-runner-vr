// ========================================
// MAZE MANAGER (renamed from maze-renderer)
// Manages maze and treasure rendering
// ========================================

class MazeManager {
  constructor(gameState, coordinateUtils) {
    this.gameState = gameState;
    this.coordinateUtils = coordinateUtils;
    this.mazeContainer = null;
    this.treasuresContainer = null;
    this.rendered = false;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize maze manager
   */
  init() {
    this.mazeContainer = document.getElementById("maze");
    this.treasuresContainer = document.getElementById("treasures");
    
    if (!this.mazeContainer || !this.treasuresContainer) {
      Utils.logError("❌ Maze or treasures container not found");
      return;
    }
    
    Utils.logInfo("✅ MazeManager initialized");
  }

  // ========================================
  // MAZE RENDERING
  // ========================================

  /**
   * Convert maze grid to wall positions
   * @param {array} mazeGrid - 2D array
   * @returns {array} - Array of {x, z} positions
   */
  convertMazeToWalls(mazeGrid) {
    const walls = [];
    const cellSize = this.gameState.cellSize;

    for (let row = 0; row < mazeGrid.length; row++) {
      for (let col = 0; col < mazeGrid[row].length; col++) {
        if (mazeGrid[row][col] === 1) {
          const offsetX = (mazeGrid[0].length * cellSize) / 2;
          const offsetZ = (mazeGrid.length * cellSize) / 2;

          walls.push({
            x: col * cellSize - offsetX + cellSize / 2,
            z: row * cellSize - offsetZ + cellSize / 2,
          });
        }
      }
    }

    return walls;
  }

  /**
   * Render maze walls
   */
  renderMaze() {
    if (!this.mazeContainer) {
      this.init();
      if (!this.mazeContainer) return;
    }

    Utils.logInfo("🎨 Rendering maze...");
    this.mazeContainer.innerHTML = "";

    if (!this.gameState.maze || this.gameState.maze.length === 0) {
      Utils.logWarn("⚠️ Maze not loaded");
      return;
    }

    const walls = this.convertMazeToWalls(this.gameState.maze);

    walls.forEach((wall) => {
      const wallEl = document.createElement("a-box");
      wallEl.setAttribute("position", `${wall.x} 1.5 ${wall.z}`);
      wallEl.setAttribute("width", this.gameState.cellSize.toString());
      wallEl.setAttribute("height", "5");
      wallEl.setAttribute("depth", this.gameState.cellSize.toString());
      wallEl.setAttribute("src", "#wall-texture");
      wallEl.setAttribute("shadow", "cast: true; receive: true");
      wallEl.setAttribute("class", "wall");
      wallEl.setAttribute("static-body", "");
      this.mazeContainer.appendChild(wallEl);
    });

    this.rendered = true;
    Utils.logInfo(`✅ Rendered ${walls.length} walls`);
  }

  // ========================================
  // TREASURE RENDERING
  // ========================================

  /**
   * Render all treasures
   */
  renderTreasures() {
    if (!this.treasuresContainer) {
      this.init();
      if (!this.treasuresContainer) return;
    }

    Utils.logInfo("🎨 Rendering treasures...");
    this.treasuresContainer.innerHTML = "";

    if (!this.gameState.treasures || this.gameState.treasures.length === 0) {
      Utils.logWarn("⚠️ No treasures to render");
      return;
    }

    let renderedCount = 0;

    this.gameState.treasures.forEach((treasure) => {
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
    // Use EXACT SAME calculation as walls
    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;

    // Treasures come as grid coordinates
    const worldX = treasure.x * cellSize - offsetX;
    const worldZ = treasure.z * cellSize - offsetZ;

    const treasureEl = document.createElement('a-octahedron');
    
    treasureEl.setAttribute('id', treasure.id);
    treasureEl.setAttribute('position', `${worldX} 1.8 ${worldZ}`);
    treasureEl.setAttribute('radius', '0.5');
    treasureEl.setAttribute('color', '#FFFF00');
    treasureEl.setAttribute('metalness', '0.2');
    treasureEl.setAttribute('roughness', '0.8');
    treasureEl.setAttribute('emissive', '#FFFF00');
    treasureEl.setAttribute('emissiveIntensity', '0.8');
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
      to: `${worldX} 2.2 ${worldZ}`,
      dir: 'alternate',
      loop: true,
      dur: 1000,
      easing: 'easeInOutSine'
    });
    
    this.treasuresContainer.appendChild(treasureEl);
    
    Utils.logDebug(`✨ Rendered treasure ${treasure.id} at (${treasure.x}, ${treasure.z}) -> world (${worldX}, ${worldZ})`);
  }

  /**
   * Remove treasure from scene
   * @param {string} treasureId
   */
  removeTreasure(treasureId) {
    const treasureEl = document.getElementById(treasureId);

    if (!treasureEl) {
      Utils.logDebug(`⚠️ Treasure ${treasureId} not in DOM`);
      return;
    }

    Utils.logInfo(`🗑️ Removing treasure ${treasureId}`);

    // Animate collection
    treasureEl.setAttribute("animation__collect", {
      property: "scale",
      to: "0 0 0",
      dur: 300,
      easing: "easeInBack",
    });

    treasureEl.setAttribute("animation__spin", {
      property: "rotation",
      to: "0 720 0",
      dur: 300,
      easing: "easeInBack",
    });

    // Remove after animation
    setTimeout(() => {
      if (treasureEl.parentNode) {
        treasureEl.parentNode.removeChild(treasureEl);
      }
    }, 300);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Clear all rendered elements
   */
  clear() {
    if (this.mazeContainer) {
      this.mazeContainer.innerHTML = "";
    }
    if (this.treasuresContainer) {
      this.treasuresContainer.innerHTML = "";
    }
    this.rendered = false;
    Utils.logInfo("🗑️ Maze cleared");
  }

  /**
   * Get maze dimensions
   * @returns {object} - {width, height}
   */
  getDimensions() {
    return this.coordinateUtils.getMazeDimensions();
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MazeManager;
}

window.MazeManager = MazeManager;
// Alias for backwards compatibility
window.mazeRenderer = window.mazeManager;