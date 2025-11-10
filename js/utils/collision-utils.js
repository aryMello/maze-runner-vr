// ========================================
// COLLISION UTILITIES
// Handles all collision detection logic
// ========================================

class CollisionUtils {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Check if position collides with wall
   * @param {number} x - Grid X coordinate
   * @param {number} z - Grid Z coordinate
   * @returns {boolean} - True if collision detected
   */
  checkWallCollision(x, z) {
    const maze = this.gameState.maze;
    
    if (!maze || maze.length === 0) {
      return false;
    }

    const cellSize = this.gameState.cellSize;
    const mazeWidth = maze[0].length;
    const mazeHeight = maze.length;
    const offsetX = (mazeWidth * cellSize) / 2;
    const offsetZ = (mazeHeight * cellSize) / 2;

    // Convert grid to world coordinates
    const worldX = x * cellSize - offsetX;
    const worldZ = z * cellSize - offsetZ;
    
    // Get grid cell
    const gridX = Math.floor((worldX + offsetX) / cellSize);
    const gridZ = Math.floor((worldZ + offsetZ) / cellSize);

    // Check bounds
    if (gridZ < 0 || gridZ >= mazeHeight || gridX < 0 || gridX >= mazeWidth) {
      Utils.logDebug(`🚫 Out of bounds: (${gridX}, ${gridZ})`);
      return true;
    }

    // Check if wall
    const isWall = maze[gridZ][gridX] === 1;
    
    if (isWall) {
      Utils.logDebug(`🧱 Wall at (${gridX}, ${gridZ})`);
    }
    
    return isWall;
  }

  /**
   * Check collision with player radius (smoother collision)
   * @param {number} x - Grid X coordinate
   * @param {number} z - Grid Z coordinate
   * @param {number} radius - Player radius
   * @returns {boolean} - True if collision detected
   */
  checkWallCollisionWithRadius(x, z, radius = 0.25) {
    // Check center
    if (this.checkWallCollision(x, z)) {
      return true;
    }
    
    // Check corners
    const offsets = [
      { dx: radius, dz: radius },
      { dx: radius, dz: -radius },
      { dx: -radius, dz: radius },
      { dx: -radius, dz: -radius }
    ];
    
    for (const offset of offsets) {
      if (this.checkWallCollision(x + offset.dx, z + offset.dz)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if position is within maze bounds
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @returns {boolean} - True if within bounds
   */
  isWithinBounds(x, z) {
    const maze = this.gameState.maze;
    
    if (!maze || maze.length === 0) {
      return false;
    }

    const cellSize = this.gameState.cellSize;
    const mazeWidth = maze[0].length;
    const mazeHeight = maze.length;
    
    const gridX = Math.floor(x);
    const gridZ = Math.floor(z);
    
    return gridX >= 0 && gridX < mazeWidth && gridZ >= 0 && gridZ < mazeHeight;
  }

  /**
   * Get cell type at position
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @returns {number|null} - Cell value (0=path, 1=wall) or null if invalid
   */
  getCellAt(x, z) {
    const maze = this.gameState.maze;
    
    if (!maze || maze.length === 0) {
      return null;
    }

    const cellSize = this.gameState.cellSize;
    const mazeWidth = maze[0].length;
    const mazeHeight = maze.length;
    const offsetX = (mazeWidth * cellSize) / 2;
    const offsetZ = (mazeHeight * cellSize) / 2;

    const worldX = x * cellSize - offsetX;
    const worldZ = z * cellSize - offsetZ;
    
    const gridX = Math.floor((worldX + offsetX) / cellSize);
    const gridZ = Math.floor((worldZ + offsetZ) / cellSize);

    if (gridZ < 0 || gridZ >= mazeHeight || gridX < 0 || gridX >= mazeWidth) {
      return null;
    }

    return maze[gridZ][gridX];
  }

  /**
   * Check distance between two points
   * @param {object} pos1 - {x, z}
   * @param {object} pos2 - {x, z}
   * @returns {number} - Distance
   */
  getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Check if position is near treasure
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {number} radius - Detection radius
   * @returns {object|null} - Treasure object if found
   */
  findNearbyTreasure(x, z, radius = 1.5) {
    const treasures = this.gameState.treasures;
    
    if (!treasures || treasures.length === 0) {
      return null;
    }

    for (const treasure of treasures) {
      if (treasure.collected) continue;
      
      const distance = this.getDistance({ x, z }, treasure);
      
      if (distance < radius) {
        return treasure;
      }
    }
    
    return null;
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CollisionUtils;
}

// Global instance
window.CollisionUtils = CollisionUtils;