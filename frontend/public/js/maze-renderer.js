// Maze and Treasure Rendering
class MazeRenderer {
  constructor() {
    this.mazeContainer = document.getElementById("maze");
    this.treasuresContainer = document.getElementById("treasures");
    this.rendered = false;
  }

  convertMazeToWalls(mazeGrid) {
    const walls = [];
    const cellSize = gameState.cellSize;

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

  renderMaze() {
    if (!this.mazeContainer) {
      this.mazeContainer = document.getElementById("maze");
      if (!this.mazeContainer) {
        Utils.logWarn("⚠️ Maze container not ready yet");
        return;
      }
    }

    Utils.logInfo("🎨 Starting maze rendering...");
    this.mazeContainer.innerHTML = "";

    if (!gameState.maze || gameState.maze.length === 0) {
      Utils.logWarn("Maze não carregado ainda");
      return;
    }

    const walls = this.convertMazeToWalls(gameState.maze);

    // Log example of wall calculation for debugging
    if (walls.length > 0) {
      const cellSize = gameState.cellSize;
      const mazeSize = gameState.maze.length;
      const offsetX = (mazeSize * cellSize) / 2;
      const offsetZ = (mazeSize * cellSize) / 2;
      Utils.logDebug(
        `📐 Wall calculation example: cellSize=${cellSize}, mazeSize=${mazeSize}, offsetX=${offsetX}, offsetZ=${offsetZ}`
      );
      Utils.logDebug(`📐 First wall position: (${walls[0].x}, ${walls[0].z})`);
    }

    walls.forEach((wall) => {
      const wallEl = document.createElement("a-box");
      wallEl.setAttribute("position", `${wall.x} 1.5 ${wall.z}`);
      wallEl.setAttribute("width", gameState.cellSize.toString());
      wallEl.setAttribute("height", "3");
      wallEl.setAttribute("depth", gameState.cellSize.toString());
      wallEl.setAttribute("src", "#wall-texture");
      wallEl.setAttribute("shadow", "cast: true; receive: true");
      wallEl.setAttribute("class", "wall");
      wallEl.setAttribute("static-body", "");
      this.mazeContainer.appendChild(wallEl);
    });

    this.rendered = true;
    Utils.logInfo(`Renderizadas ${walls.length} paredes`);
  }

  renderTreasures() {
    if (!this.treasuresContainer) {
      this.treasuresContainer = document.getElementById("treasures");
      if (!this.treasuresContainer) {
        Utils.logWarn("⚠️ Treasures container not ready yet");
        return;
      }
    }

    Utils.logInfo("🎨 Starting treasure rendering...");
    this.treasuresContainer.innerHTML = "";

    if (!gameState.treasures || gameState.treasures.length === 0) {
      Utils.logWarn("⚠️ Tesouros não carregados ainda");
      return;
    }

    Utils.logInfo(
      `📊 Total treasures to render: ${gameState.treasures.length}`
    );

    // Use EXACT SAME calculation as walls
    const cellSize = gameState.cellSize;
    const mazeSize = gameState.maze ? gameState.maze.length : 25;
    const offsetX = (mazeSize * cellSize) / 2;
    const offsetZ = (mazeSize * cellSize) / 2;

    let renderedCount = 0;
    gameState.treasures.forEach((treasure) => {
      Utils.logDebug(
        `Processing treasure ${treasure.id} at server coords (${treasure.x}, ${treasure.z}) - collected: ${treasure.collected}`
      );

      if (!treasure.collected) {
        // Treasures come as grid coordinates (e.g., 7.5 means between cells 7 and 8)
        // Apply EXACT SAME formula as walls: position = coord * cellSize - offset + cellSize/2
        // But treasures already have the .5, so we treat them as col/row directly
        const worldX = treasure.x * cellSize - offsetX;
        const worldZ = treasure.z * cellSize - offsetZ;

        Utils.logDebug(
          `World position after centering: (${worldX}, ${worldZ})`
        );

        const treasureEl = document.createElement("a-octahedron");
        treasureEl.setAttribute("id", `treasure-${treasure.id}`);
        treasureEl.setAttribute("position", `${worldX} 1 ${worldZ}`);
        treasureEl.setAttribute("radius", "0.5");
        treasureEl.setAttribute("color", "#FFD700");
        treasureEl.setAttribute("metalness", "0.8");
        treasureEl.setAttribute("roughness", "0.2");
        treasureEl.setAttribute(
          "animation",
          "property: rotation; to: 0 360 0; loop: true; dur: 3000; easing: linear"
        );
        treasureEl.setAttribute(
          "animation__hover",
          `property: position; to: ${worldX} 1.5 ${worldZ}; dir: alternate; loop: true; dur: 1000; easing: easeInOutSine`
        );
        treasureEl.setAttribute("class", "treasure");
        treasureEl.setAttribute("shadow", "cast: true");
        this.treasuresContainer.appendChild(treasureEl);
        renderedCount++;
        Utils.logDebug(
          `✅ Treasure ${treasure.id} added to scene at world (${worldX}, ${worldZ})`
        );
      }
    });

    Utils.logInfo(
      `✅ Renderizados ${renderedCount} tesouros de ${gameState.treasures.length} total`
    );
  }

  removeTreasure(treasureId) {
    const treasureEl = document.getElementById(`treasure-${treasureId}`);
    if (treasureEl) {
      treasureEl.setAttribute(
        "animation__collect",
        "property: scale; to: 0 0 0; dur: 300; easing: easeInBack"
      );
      treasureEl.setAttribute(
        "animation__spin",
        "property: rotation; to: 0 720 0; dur: 300; easing: easeInBack"
      );

      setTimeout(() => {
        treasureEl.parentNode.removeChild(treasureEl);
      }, 300);
    }
  }
}

// Create singleton instance
const mazeRenderer = new MazeRenderer();

// Expose globally
window.mazeRenderer = mazeRenderer;
window.MazeRenderer = MazeRenderer;
