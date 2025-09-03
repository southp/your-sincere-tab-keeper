/**
 * Maze Rendering Engine
 * Handles all canvas rendering, visual effects, and drawing operations
 */

import { WALL, PATH, GOAL } from '../maze-model.js';

// Rendering state
let cellSize = 30;
let canvas = null;
let ctx = null;

/**
 * Initialize the renderer with canvas and context
 */
export function initializeRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

/**
 * Get current cell size
 */
export function getCellSize() {
  return cellSize;
}

/**
 * Update canvas size responsively based on container and screen size
 */
export function updateCanvasSize(mazeModel, renderMaze) {
  if (!canvas) return;

  const wrapper = document.querySelector('.maze-wrapper');
  if (!wrapper) return;

  // Get the container dimensions minus padding
  const wrapperStyle = getComputedStyle(wrapper);
  const wrapperPadding = parseInt(wrapperStyle.paddingLeft) + parseInt(wrapperStyle.paddingRight);
  const maxWidth = wrapper.clientWidth - wrapperPadding;
  const maxHeight = window.innerHeight * 0.6; // Max 60% of viewport height

  // Calculate the optimal canvas size (square)
  const maxCanvasSize = Math.min(maxWidth, maxHeight, 800); // Cap at 800px for very large screens
  const minCanvasSize = 200; // Minimum size for usability
  const canvasSize = Math.max(minCanvasSize, Math.min(maxCanvasSize, maxWidth));

  // Calculate cell size based on canvas size and maze size
  cellSize = Math.max(4, Math.floor(canvasSize / mazeModel.size));

  // Adjust canvas size to be exact multiple of cell size for crisp rendering
  const actualCanvasSize = mazeModel.size * cellSize;

  // Set canvas size (this automatically clears the canvas)
  canvas.width = actualCanvasSize;
  canvas.height = actualCanvasSize;

  // Set CSS size for proper scaling on high-DPI displays
  canvas.style.width = actualCanvasSize + 'px';
  canvas.style.height = actualCanvasSize + 'px';

  // Handle high-DPI displays for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  if (dpr > 1) {
    canvas.width = actualCanvasSize * dpr;
    canvas.height = actualCanvasSize * dpr;
    canvas.style.width = actualCanvasSize + 'px';
    canvas.style.height = actualCanvasSize + 'px';
    ctx.scale(dpr, dpr);
  }

  // Re-render if maze exists
  if (mazeModel.grid.length > 0) {
    renderMaze(mazeModel);
  }
}

/**
 * Create render maze function with all dependencies
 */
export function createRenderMazeFunction(
  COLORS,
  getFlagWaveOffset,
  renderPlayer,
  getPlayerHopOffset,
  celebrationState,
  wallPushingState,
  idleState,
  isBlinking
) {
  return function renderMaze(model) {
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Batch drawing operations for better performance

    // Draw walls in one pass
    ctx.fillStyle = COLORS.wall;
    for (let y = 0; y < model.size; y++) {
      for (let x = 0; x < model.size; x++) {
        if (model.grid[y][x] === WALL) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw paths in one pass
    ctx.fillStyle = COLORS.path;
    for (let y = 0; y < model.size; y++) {
      for (let x = 0; x < model.size; x++) {
        if (model.grid[y][x] === PATH || model.grid[y][x] === GOAL) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Only draw borders for smaller mazes to avoid performance issues
    if (model.size <= 25) {
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();

      // Draw grid lines efficiently
      for (let i = 0; i <= model.size; i++) {
        // Vertical lines
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, model.size * cellSize);

        // Horizontal lines
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(model.size * cellSize, i * cellSize);
      }

      ctx.stroke();
    }

    // Draw goal with waving flag (after borders so flag appears on top)
    renderGoalFlag(model, COLORS, getFlagWaveOffset);

    // Draw player using the player rendering module
    renderPlayer(ctx, cellSize, getPlayerHopOffset, celebrationState, wallPushingState, idleState, isBlinking);

    // Draw celebration sparkles
    renderCelebrationSparkles(celebrationState);

    // Draw sweat drops (easter egg)
    renderSweatDrops(wallPushingState);

    // Draw ZZZ particles when sleeping
    renderSleepParticles(idleState);
  };
}

/**
 * Render the goal flag with waving animation
 */
function renderGoalFlag(model, COLORS, getFlagWaveOffset) {
  const goalCenterX = model.goalPos.x * cellSize + cellSize / 2;
  const goalCenterY = model.goalPos.y * cellSize + cellSize / 2;

  // Draw goal base (flagpole)
  ctx.fillStyle = '#8B4513'; // Brown flagpole
  const poleWidth = Math.max(1, cellSize / 12);
  const poleHeight = cellSize * 0.7;
  ctx.fillRect(
    goalCenterX - poleWidth / 2,
    goalCenterY - poleHeight / 2,
    poleWidth,
    poleHeight
  );

  // Draw waving flag with flowing motion
  ctx.fillStyle = COLORS.goal;
  const flagWidth = cellSize * 0.6;
  const flagHeight = cellSize * 0.25;
  const flagX = goalCenterX;
  const flagY = goalCenterY - poleHeight / 3;

  // Create simple waving flag effect with gentle curves
  ctx.beginPath();
  ctx.moveTo(flagX, flagY); // Left edge attached to pole - no movement

  // Top edge with gentle wave using quadratic curve
  const midWaveTop = getFlagWaveOffset(0.5);
  const endWaveTop = getFlagWaveOffset(1);
  ctx.quadraticCurveTo(
    flagX + flagWidth * 0.5,
    flagY + (midWaveTop * cellSize),
    flagX + flagWidth,
    flagY + (endWaveTop * cellSize)
  );

  // Right edge
  const endWaveBottom = getFlagWaveOffset(1);
  ctx.lineTo(flagX + flagWidth, flagY + flagHeight + (endWaveBottom * cellSize));

  // Bottom edge with matching gentle wave
  const midWaveBottom = getFlagWaveOffset(0.5);
  ctx.quadraticCurveTo(
    flagX + flagWidth * 0.5,
    flagY + flagHeight + (midWaveBottom * cellSize),
    flagX,
    flagY + flagHeight // Left edge attached to pole - no movement
  );

  ctx.closePath();
  ctx.fill();
}

/**
 * Render celebration sparkles
 */
function renderCelebrationSparkles(celebrationState) {
  if (celebrationState.active) {
    celebrationState.sparkles.forEach(sparkle => {
      ctx.fillStyle = sparkle.color;
      ctx.globalAlpha = sparkle.life;

      const sparkleX = sparkle.x * cellSize;
      const sparkleY = sparkle.y * cellSize;

      ctx.fillRect(
        sparkleX - sparkle.size / 2,
        sparkleY - sparkle.size / 2,
        sparkle.size,
        sparkle.size
      );
    });

    // Reset alpha
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Render sweat drops during wall pushing
 */
function renderSweatDrops(wallPushingState) {
  if (wallPushingState.sweatDrops.length > 0) {
    ctx.fillStyle = '#87CEEB'; // Sky blue for sweat
    wallPushingState.sweatDrops.forEach(drop => {
      ctx.globalAlpha = drop.life;
      const dropX = drop.x * cellSize;
      const dropY = drop.y * cellSize;
      const dropSize = Math.max(1, cellSize / 20);

      // Draw small oval for sweat drop
      ctx.beginPath();
      ctx.ellipse(dropX, dropY, dropSize, dropSize * 1.5, 0, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Reset alpha
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Render ZZZ particles when sleeping
 */
function renderSleepParticles(idleState) {
  if (idleState.currentState === 'sleeping' && idleState.sleepParticles.length > 0) {
    ctx.fillStyle = '#888'; // Gentle gray color
    ctx.font = `${Math.max(12, cellSize * 0.4)}px serif`; // Elegant serif font
    ctx.textAlign = 'center';

    idleState.sleepParticles.forEach(particle => {
      ctx.globalAlpha = particle.alpha; // Use the particle's computed alpha

      ctx.fillText(
        'z',
        particle.x * cellSize,
        particle.y * cellSize
      );
    });

    // Reset alpha and text properties
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
  }
}

/**
 * Get the current canvas and context
 */
export function getCanvasContext() {
  return { canvas, ctx };
}