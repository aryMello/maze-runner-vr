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

    this.mazeContainer.innerHTML = "";

    if (!gameState.maze || gameState.maze.length === 0) {
      Utils.logWarn("Maze não carregado ainda");
      return;
    }

    const walls = this.convertMazeToWalls(gameState.maze);

    walls.forEach((wall) => {
      const wallEl = document.createElement("a-box");
      wallEl.setAttribute("position", `${wall.x} 1.5 ${wall.z}`);
      wallEl.setAttribute("width", gameState.cellSize.toString());
      wallEl.setAttribute("height", "3");
      wallEl.setAttribute("depth", gameState.cellSize.toString());
      wallEl.setAttribute("src", "#wall-texture");
      wallEl.setAttribute("shadow", "cast: true; receive: true");
      wallEl.setAttribute("class", "wall");
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

    this.treasuresContainer.innerHTML = "";

    if (!gameState.treasures || gameState.treasures.length === 0) {
      Utils.logWarn("Tesouros não carregados ainda");
      return;
    }

    gameState.treasures.forEach((treasure) => {
      if (!treasure.collected) {
        const treasureEl = document.createElement("a-octahedron");
        treasureEl.setAttribute("id", `treasure-${treasure.id}`);
        treasureEl.setAttribute("position", `${treasure.x} 1 ${treasure.z}`);
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
          `property: position; to: ${treasure.x} 1.5 ${treasure.z}; dir: alternate; loop: true; dur: 1000; easing: easeInOutSine`
        );
        treasureEl.setAttribute("class", "treasure");
        treasureEl.setAttribute("shadow", "cast: true");
        this.treasuresContainer.appendChild(treasureEl);
      }
    });

    Utils.logInfo(
      `Renderizados ${
        gameState.treasures.filter((t) => !t.collected).length
      } tesouros`
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
