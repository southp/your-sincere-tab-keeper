/**
 * MazeModel - Encapsulates maze data and generation logic
 *
 * This module provides a clean separation between maze logic and UI rendering.
 * The MazeModel handles all maze-related data (grid, positions, state) and
 * operations (generation, movement, completion detection).
 */

// Maze cell constants
export const WALL = 1;
export const PATH = 0;
export const PLAYER = 2;
export const GOAL = 3;

/**
 * MazeModel - Encapsulates all maze data and logic
 */
export class MazeModel {
  constructor() {
    this.grid = [];
    this.size = 15;
    this.playerPos = { x: 1, y: 1 };
    this.goalPos = { x: 0, y: 0 };
    this.difficulty = 0;
    this.isComplete = false;
    this.startTime = null;
  }

  /**
   * Initialize maze with given difficulty settings
   */
  initialize(difficultySettings) {
    this.size = this.ensureOddSize(difficultySettings.size);
    this.difficulty = difficultySettings;
    this.isComplete = false;
    this.startTime = Date.now();
    this.generate();
  }

  /**
   * Ensure maze size is odd for proper maze generation algorithm
   */
  ensureOddSize(size) {
    return size % 2 === 0 ? size + 1 : size;
  }

  /**
   * Generate maze using recursive backtracking algorithm
   */
  generate() {
    // Initialize maze with walls
    this.grid = Array(this.size).fill().map(() => Array(this.size).fill(WALL));

    // Starting position (always odd coordinates for proper maze generation)
    const startX = 1;
    const startY = 1;
    this.grid[startY][startX] = PATH;

    // Stack for backtracking
    const stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = this.getUnvisitedNeighbors(current.x, current.y);

      if (neighbors.length > 0) {
        // Choose random neighbor
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];

        // Remove wall between current and next
        const wallX = current.x + (next.x - current.x) / 2;
        const wallY = current.y + (next.y - current.y) / 2;
        this.grid[wallY][wallX] = PATH;
        this.grid[next.y][next.x] = PATH;

        stack.push(next);
      } else {
        stack.pop();
      }
    }

    // Set player and goal positions
    this.playerPos = { x: startX, y: startY };
    this.goalPos = this.findFarthestPosition(startX, startY);
    this.grid[this.goalPos.y][this.goalPos.x] = GOAL;
  }

  /**
   * Get unvisited neighbors for maze generation
   */
  getUnvisitedNeighbors(x, y) {
    const neighbors = [];
    const directions = [
      { x: 0, y: -2 }, // Up
      { x: 2, y: 0 },  // Right
      { x: 0, y: 2 },  // Down
      { x: -2, y: 0 }  // Left
    ];

    for (const dir of directions) {
      const newX = x + dir.x;
      const newY = y + dir.y;

      if (newX > 0 && newX < this.size - 1 &&
          newY > 0 && newY < this.size - 1 &&
          this.grid[newY][newX] === WALL) {
        neighbors.push({ x: newX, y: newY });
      }
    }

    return neighbors;
  }

  /**
   * Find the farthest reachable position from start using BFS
   */
  findFarthestPosition(startX, startY) {
    const visited = Array(this.size).fill().map(() => Array(this.size).fill(false));
    const queue = [{ x: startX, y: startY, distance: 0 }];
    visited[startY][startX] = true;

    let farthest = { x: startX, y: startY };
    let maxDistance = 0;

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.distance > maxDistance) {
        maxDistance = current.distance;
        farthest = { x: current.x, y: current.y };
      }

      // Check all 4 directions
      const directions = [
        { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
      ];

      for (const dir of directions) {
        const newX = current.x + dir.x;
        const newY = current.y + dir.y;

        if (newX >= 0 && newX < this.size &&
            newY >= 0 && newY < this.size &&
            !visited[newY][newX] &&
            this.grid[newY][newX] === PATH) {
          visited[newY][newX] = true;
          queue.push({ x: newX, y: newY, distance: current.distance + 1 });
        }
      }
    }

    return farthest;
  }

  /**
   * Attempt to move player in given direction
   * @param {number} dx - X direction (-1, 0, 1)
   * @param {number} dy - Y direction (-1, 0, 1)
   * @returns {boolean} - True if move was successful and goal reached
   */
  movePlayer(dx, dy) {
    if (this.isComplete) return false;

    const newX = this.playerPos.x + dx;
    const newY = this.playerPos.y + dy;

    // Check bounds and walls
    if (newX >= 0 && newX < this.size &&
        newY >= 0 && newY < this.size &&
        this.grid[newY][newX] !== WALL) {

      this.playerPos.x = newX;
      this.playerPos.y = newY;

      // Check if goal reached
      if (newX === this.goalPos.x && newY === this.goalPos.y) {
        this.isComplete = true;
        return true;
      }
    }

    return false;
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedTime() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  /**
   * Check if a position is valid (within bounds and not a wall)
   */
  isValidPosition(x, y) {
    return x >= 0 && x < this.size &&
           y >= 0 && y < this.size &&
           this.grid[y][x] !== WALL;
  }

  /**
   * Check if the maze has a valid solution (path from start to goal)
   */
  isValidMaze() {
    if (!this.grid.length) return false;

    const startX = 1, startY = 1;
    const visited = Array(this.size).fill().map(() => Array(this.size).fill(false));
    const queue = [{ x: startX, y: startY }];
    visited[startY][startX] = true;

    while (queue.length > 0) {
      const current = queue.shift();

      // Check if we reached the goal
      if (current.x === this.goalPos.x && current.y === this.goalPos.y) {
        return true;
      }

      // Check all 4 directions
      const directions = [
        { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
      ];

      for (const dir of directions) {
        const newX = current.x + dir.x;
        const newY = current.y + dir.y;

        if (this.isValidPosition(newX, newY) && !visited[newY][newX]) {
          visited[newY][newX] = true;
          queue.push({ x: newX, y: newY });
        }
      }
    }

    return false;
  }
}
