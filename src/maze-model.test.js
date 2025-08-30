/**
 * Unit tests for MazeModel using Jest
 * Run with: npm test
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MazeModel, WALL, PATH, GOAL } from './maze-model.js';

describe('MazeModel', () => {
  let maze;

  beforeEach(() => {
    maze = new MazeModel();
    // Mock Date.now for deterministic testing
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  describe('Constructor', () => {
    test('initializes with default values', () => {
      expect(maze.grid).toEqual([]);
      expect(maze.size).toBe(15);
      expect(maze.playerPos).toEqual({ x: 1, y: 1 });
      expect(maze.goalPos).toEqual({ x: 0, y: 0 });
      expect(maze.difficulty).toBe(0);
      expect(maze.isComplete).toBe(false);
      expect(maze.startTime).toBeNull();
    });
  });

  describe('ensureOddSize', () => {
    test('returns odd numbers unchanged', () => {
      expect(maze.ensureOddSize(5)).toBe(5);
      expect(maze.ensureOddSize(7)).toBe(7);
      expect(maze.ensureOddSize(15)).toBe(15);
    });

    test('converts even numbers to odd', () => {
      expect(maze.ensureOddSize(4)).toBe(5);
      expect(maze.ensureOddSize(6)).toBe(7);
      expect(maze.ensureOddSize(14)).toBe(15);
    });
  });

  describe('initialize', () => {
    test('sets up maze correctly', () => {
      const difficulty = { size: 7, name: 'Test' };

      maze.initialize(difficulty);

      expect(maze.size).toBe(7);
      expect(maze.difficulty).toBe(difficulty);
      expect(maze.isComplete).toBe(false);
      expect(maze.startTime).toBe(1000);
      expect(maze.grid.length).toBeGreaterThan(0);
    });

    test('ensures odd size', () => {
      const difficulty = { size: 8, name: 'Test' };

      maze.initialize(difficulty);

      expect(maze.size).toBe(9); // 8 -> 9 (odd)
    });
  });

  describe('generate', () => {
    beforeEach(() => {
      maze.size = 5;
    });

    test('creates grid with correct dimensions', () => {
      maze.generate();

      expect(maze.grid).toHaveLength(5);
      expect(maze.grid[0]).toHaveLength(5);
    });

    test('sets start position as PATH', () => {
      maze.generate();

      expect(maze.grid[1][1]).toBe(PATH);
    });

    test('sets player position correctly', () => {
      maze.generate();

      expect(maze.playerPos).toEqual({ x: 1, y: 1 });
    });

    test('places goal at different position from start', () => {
      maze.generate();

      expect(maze.goalPos.x !== 1 || maze.goalPos.y !== 1).toBe(true);
    });

    test('marks goal position correctly in grid', () => {
      maze.generate();

      expect(maze.grid[maze.goalPos.y][maze.goalPos.x]).toBe(GOAL);
    });
  });

  describe('getUnvisitedNeighbors', () => {
    beforeEach(() => {
      maze.size = 7;
      maze.grid = Array(7).fill().map(() => Array(7).fill(WALL));
    });

    test('returns valid neighbors', () => {
      const neighbors = maze.getUnvisitedNeighbors(3, 3);

      expect(neighbors.length).toBeLessThanOrEqual(4);

      neighbors.forEach(neighbor => {
        expect(neighbor.x).toBeGreaterThan(0);
        expect(neighbor.x).toBeLessThan(6);
        expect(neighbor.y).toBeGreaterThan(0);
        expect(neighbor.y).toBeLessThan(6);
        expect(maze.grid[neighbor.y][neighbor.x]).toBe(WALL);
      });
    });

    test('returns empty array when all neighbors visited', () => {
      maze.grid = Array(7).fill().map(() => Array(7).fill(PATH));

      const neighbors = maze.getUnvisitedNeighbors(3, 3);

      expect(neighbors).toEqual([]);
    });
  });

  describe('movePlayer', () => {
    beforeEach(() => {
      maze.size = 5;
      maze.isComplete = false;
    });

    test('moves within bounds successfully', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(PATH));
      maze.playerPos = { x: 2, y: 2 };
      maze.goalPos = { x: 4, y: 4 }; // Different from move target

      const result = maze.movePlayer(1, 0); // Move right

      expect(maze.playerPos).toEqual({ x: 3, y: 2 });
      expect(result).toBe(false);
    });

    test('is blocked by walls', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(WALL));
      maze.grid[2][2] = PATH; // Only current position is path
      maze.playerPos = { x: 2, y: 2 };

      const result = maze.movePlayer(1, 0); // Try to move right into wall

      expect(maze.playerPos).toEqual({ x: 2, y: 2 });
      expect(result).toBe(false);
    });

    test('is blocked by boundaries', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(PATH));
      maze.playerPos = { x: 4, y: 2 }; // At right edge

      const result = maze.movePlayer(1, 0); // Try to move beyond boundary

      expect(maze.playerPos).toEqual({ x: 4, y: 2 });
      expect(result).toBe(false);
    });

    test('detects goal reached', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(PATH));
      maze.playerPos = { x: 2, y: 2 };
      maze.goalPos = { x: 3, y: 2 };

      const result = maze.movePlayer(1, 0); // Move to goal

      expect(maze.playerPos).toEqual({ x: 3, y: 2 });
      expect(maze.isComplete).toBe(true);
      expect(result).toBe(true);
    });

    test('is blocked when maze complete', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(PATH));
      maze.playerPos = { x: 2, y: 2 };
      maze.isComplete = true;

      const result = maze.movePlayer(1, 0);

      expect(maze.playerPos).toEqual({ x: 2, y: 2 });
      expect(result).toBe(false);
    });
  });

  describe('getElapsedTime', () => {
    test('returns 0 when no start time', () => {
      maze.startTime = null;

      expect(maze.getElapsedTime()).toBe(0);
    });

    test('calculates time correctly', () => {
      maze.startTime = 1000;
      jest.spyOn(Date, 'now').mockReturnValue(1500);

      expect(maze.getElapsedTime()).toBe(500);
    });
  });

  describe('isValidPosition', () => {
    beforeEach(() => {
      maze.size = 5;
    });

    test('returns true for valid path position', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(PATH));

      expect(maze.isValidPosition(2, 2)).toBe(true);
    });

    test('returns false for wall position', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(WALL));

      expect(maze.isValidPosition(2, 2)).toBe(false);
    });

    test('returns false for out-of-bounds positions', () => {
      maze.grid = Array(5).fill().map(() => Array(5).fill(PATH));

      expect(maze.isValidPosition(-1, 2)).toBe(false);
      expect(maze.isValidPosition(5, 2)).toBe(false);
      expect(maze.isValidPosition(2, -1)).toBe(false);
      expect(maze.isValidPosition(2, 5)).toBe(false);
    });
  });

  describe('isValidMaze', () => {
    test('returns false for empty grid', () => {
      maze.grid = [];

      expect(maze.isValidMaze()).toBe(false);
    });

    test('returns true for solvable maze', () => {
      maze.size = 5;
      maze.grid = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PATH, PATH, PATH, WALL],
        [WALL, PATH, WALL, PATH, WALL],
        [WALL, PATH, PATH, GOAL, WALL],
        [WALL, WALL, WALL, WALL, WALL]
      ];
      maze.goalPos = { x: 3, y: 3 };

      expect(maze.isValidMaze()).toBe(true);
    });

    test('returns false for unsolvable maze', () => {
      maze.size = 5;
      maze.grid = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PATH, WALL, GOAL, WALL],
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, WALL, WALL, WALL, WALL]
      ];
      maze.goalPos = { x: 3, y: 1 };

      expect(maze.isValidMaze()).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('full maze generation creates valid solvable maze', () => {
      const difficulty = { size: 9, name: 'Test' };

      maze.initialize(difficulty);

      // Basic structure tests
      expect(maze.size).toBe(9);
      expect(maze.grid).toHaveLength(9);
      expect(maze.grid[0]).toHaveLength(9);

      // Start position should be correct
      expect(maze.playerPos).toEqual({ x: 1, y: 1 });
      expect(maze.grid[1][1]).toBe(PATH);

      // Goal should be placed and different from start
      expect(maze.goalPos.x !== 1 || maze.goalPos.y !== 1).toBe(true);
      expect(maze.grid[maze.goalPos.y][maze.goalPos.x]).toBe(GOAL);

      // Maze should be solvable
      expect(maze.isValidMaze()).toBe(true);
    });

    test('can solve maze by moving player step by step', () => {
      maze.size = 5;
      maze.grid = [
        [WALL, WALL, WALL, WALL, WALL],
        [WALL, PATH, PATH, PATH, WALL],
        [WALL, WALL, WALL, PATH, WALL],
        [WALL, WALL, WALL, GOAL, WALL],
        [WALL, WALL, WALL, WALL, WALL]
      ];
      maze.playerPos = { x: 1, y: 1 };
      maze.goalPos = { x: 3, y: 3 };
      maze.isComplete = false;

      // Move right twice
      expect(maze.movePlayer(1, 0)).toBe(false);
      expect(maze.playerPos).toEqual({ x: 2, y: 1 });

      expect(maze.movePlayer(1, 0)).toBe(false);
      expect(maze.playerPos).toEqual({ x: 3, y: 1 });

      // Move down twice
      expect(maze.movePlayer(0, 1)).toBe(false);
      expect(maze.playerPos).toEqual({ x: 3, y: 2 });

      expect(maze.movePlayer(0, 1)).toBe(true); // Reach goal
      expect(maze.playerPos).toEqual({ x: 3, y: 3 });
      expect(maze.isComplete).toBe(true);
    });
  });
});