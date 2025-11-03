// ========================================
// COORDINATE UTILITIES
// Handles coordinate conversions and transformations
// ========================================

class CoordinateUtils {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Calculate offset for centering maze
   * @returns {object} - {offsetX, offsetZ}
   */
  calculateOffset() {
    const cellSize = this.gameState.cellSize;
    const mazeSize = this.gameState.maze ? this.gameState.maze.length : 25;
    
    return {
      offsetX: (mazeSize * cellSize) / 2,
      offsetZ: (mazeSize * cellSize) / 2
    };
  }

  /**
   * Convert grid coordinates to world coordinates
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridZ - Grid Z coordinate
   * @returns {object} - {worldX, worldZ}
   */
  gridToWorld(gridX, gridZ) {
    const cellSize = this.gameState.cellSize;
    const { offsetX, offsetZ } = this.calculateOffset();
    
    return {
      worldX: gridX * cellSize - offsetX,
      worldZ: gridZ * cellSize - offsetZ
    };
  }

  /**
   * Convert world coordinates to grid coordinates
   * @param {number} worldX - World X coordinate
   * @param {number} worldZ - World Z coordinate
   * @returns {object} - {gridX, gridZ}
   */
  worldToGrid(worldX, worldZ) {
    const cellSize = this.gameState.cellSize;
    const { offsetX, offsetZ } = this.calculateOffset();
    
    return {
      gridX: Math.floor((worldX + offsetX) / cellSize),
      gridZ: Math.floor((worldZ + offsetZ) / cellSize)
    };
  }

  /**
   * Normalize angle to 0-360 range
   * @param {number} angle - Angle in degrees
   * @returns {number} - Normalized angle
   */
  normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Angle in degrees
   * @returns {number} - Angle in radians
   */
  degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert radians to degrees
   * @param {number} radians - Angle in radians
   * @returns {number} - Angle in degrees
   */
  radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
  }

  /**
   * Round coordinate to grid precision
   * @param {number} value - Coordinate value
   * @param {number} precision - Decimal places (default 1)
   * @returns {number} - Rounded value
   */
  roundToGrid(value, precision = 1) {
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Get maze dimensions
   * @returns {object} - {width, height}
   */
  getMazeDimensions() {
    const maze = this.gameState.maze;
    
    if (!maze || maze.length === 0) {
      return { width: 0, height: 0 };
    }
    
    return {
      width: maze[0].length,
      height: maze.length
    };
  }

  /**
   * Check if grid coordinates are within maze bounds
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridZ - Grid Z coordinate
   * @returns {boolean}
   */
  isInBounds(gridX, gridZ) {
    const { width, height } = this.getMazeDimensions();
    return gridX >= 0 && gridX < width && gridZ >= 0 && gridZ < height;
  }

  /**
   * Calculate distance between two points
   * @param {object} pos1 - {x, z}
   * @param {object} pos2 - {x, z}
   * @returns {number} - Distance
   */
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Calculate direction angle between two points
   * @param {object} from - {x, z}
   * @param {object} to - {x, z}
   * @returns {number} - Angle in degrees
   */
  calculateDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const radians = Math.atan2(dx, -dz);
    return this.normalizeAngle(this.radiansToDegrees(radians));
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CoordinateUtils;
}

window.CoordinateUtils = CoordinateUtils;