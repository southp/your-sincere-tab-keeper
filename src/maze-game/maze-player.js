/**
 * Maze Player System
 * Handles player avatar rendering, eye behaviors, movement validation, and position management
 */

// Player state
export let playerVisualPos = { x: 1, y: 1 }; // Smooth interpolated position for rendering
export let eyeDirection = { x: 0, y: 0 }; // Current eye look direction
export let lastMovementDirection = { x: 0, y: 0 }; // Last significant movement direction

// Player colors
export const PLAYER_COLORS = {
  player: '#ff6b6b'
};

/**
 * Initialize player position
 */
export function initializePlayer(startPos) {
  playerVisualPos.x = startPos.x;
  playerVisualPos.y = startPos.y;
}

/**
 * Check if player can move to a specific position
 */
export function canMoveTo(x, y, mazeModel, WALL) {
  return x >= 0 && x < mazeModel.size &&
         y >= 0 && y < mazeModel.size &&
         mazeModel.grid[y] && mazeModel.grid[y][x] !== WALL;
}

/**
 * Update eye direction based on movement
 */
export function updateEyeDirection(velocity, deltaTime) {
  // Normalize velocity for eye direction (max strength of 1.0)
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
  if (speed < 0.5) return; // Don't update for very slow movement

  const normalizedX = velocity.x / speed;
  const normalizedY = velocity.y / speed;

  // Smoothly interpolate eye direction toward movement direction
  const lerpSpeed = 8.0; // How quickly eyes follow movement direction
  const targetX = normalizedX * 1.0; // Max eye offset (100% for obvious movement)
  const targetY = normalizedY * 1.0;

  eyeDirection.x += (targetX - eyeDirection.x) * lerpSpeed * deltaTime;
  eyeDirection.y += (targetY - eyeDirection.y) * lerpSpeed * deltaTime;

  // Update last movement direction for reference
  lastMovementDirection.x = normalizedX;
  lastMovementDirection.y = normalizedY;
}

/**
 * Render the player avatar with eyes and all behavioral states
 */
export function renderPlayer(ctx, cellSize, getPlayerHopOffset, celebrationState, wallPushingState, idleState, isBlinking) {
  // Draw player using smooth visual position with celebration hopping
  ctx.fillStyle = PLAYER_COLORS.player;
  const hopOffset = getPlayerHopOffset();
  
  // Calculate player size and centering for better alignment
  const playerSize = Math.max(2, Math.floor(cellSize * 0.9)); // 90% of cell size, minimum 2px
  const centerOffset = (cellSize - playerSize) / 2; // Center the player in the cell
  
  const playerX = playerVisualPos.x * cellSize + centerOffset;
  const playerY = playerVisualPos.y * cellSize + centerOffset + (hopOffset * cellSize);

  ctx.fillRect(playerX, playerY, playerSize, playerSize);

  // Add player eyes with different states - only if cell is big enough
  if (cellSize >= 4) { // Lower threshold for smaller mazes
    renderPlayerEyes(ctx, cellSize, playerSize, playerX, playerY, hopOffset, celebrationState, wallPushingState, idleState, isBlinking);
  }
}

/**
 * Render player eyes with various emotional states
 */
function renderPlayerEyes(ctx, cellSize, playerSize, playerX, playerY, hopOffset, celebrationState, wallPushingState, idleState, isBlinking) {
  let eyeSize = Math.max(1, Math.floor(cellSize / 10)); // Size relative to cell (original sizing)
  const baseEyeOffset = Math.floor(playerSize * 0.25); // Offset relative to player size

  // Wall pushing effects (easter egg)
  let eyeSizeMultiplier = 1.0;
  let isGaspingNow = false;

  if (wallPushingState.active) {
    const pushingDuration = performance.now() - wallPushingState.startTime;
    // Eyes grow bigger after 10 seconds
    if (pushingDuration > 10000) {
      const growthTime = Math.min((pushingDuration - 10000) / 3000, 1); // Grow over 3 seconds
      // Use smooth easing function for natural growth
      const smoothGrowth = Math.sin(growthTime * Math.PI * 0.5); // Sine easing
      eyeSizeMultiplier = 1.0 + (smoothGrowth * 1.0); // Up to 2x size (more reasonable)
    }
  } else if (wallPushingState.gasping) {
    const gaspingDuration = performance.now() - wallPushingState.gaspStartTime;
    if (gaspingDuration < wallPushingState.gaspDuration) {
      isGaspingNow = true;
      // Breathing rhythm - slower and more natural (800ms per breath cycle)
      const breathCycle = (gaspingDuration / 800) * Math.PI * 2;
      const breathIntensity = Math.sin(breathCycle) * 0.4 + 1.0; // 40% variation
      eyeSizeMultiplier = breathIntensity;

      // Add vertical breathing movement
      const breathOffset = Math.sin(breathCycle) * 2; // 2 pixels up/down
      wallPushingState.breathOffset = breathOffset;
    } else {
      // Stop gasping
      wallPushingState.gasping = false;
      wallPushingState.breathOffset = 0;
    }
  }

  eyeSize = Math.floor(eyeSize * eyeSizeMultiplier);

  // Calculate eye positions with directional offset (use original eye size for positioning)
  const originalEyeSize = Math.max(1, Math.floor(cellSize / 10));
  const eyeShiftX = eyeDirection.x * (originalEyeSize * 1.5);
  const eyeShiftY = eyeDirection.y * (originalEyeSize * 1.5);

  // Center the grown eyes properly
  const eyeGrowthOffset = (eyeSize - originalEyeSize) / 2;
  const breathingOffset = wallPushingState.breathOffset || 0;
  const leftEyeX = playerX + baseEyeOffset + eyeShiftX - eyeGrowthOffset;
  const rightEyeX = playerX + playerSize - baseEyeOffset - eyeSize + eyeShiftX - eyeGrowthOffset;
  const eyeY = playerY + baseEyeOffset + (hopOffset * cellSize) + eyeShiftY - eyeGrowthOffset + breathingOffset;

  // Draw eyes based on current state
  if (isGaspingNow) {
    // Draw gasping eyes (wide open white rectangles, pulsing with breathing)
    ctx.fillStyle = '#fff';

    // Left gasping eye (white rectangle, no pupils to match avatar style)
    ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
    // Right gasping eye
    ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

  } else if (celebrationState.active) {
    // Draw happy celebration eyes as hyphens (like ^_^)
    ctx.fillStyle = '#000';
    const hyphenWidth = eyeSize * 2; // Make them bigger than normal sleepy eyes
    const hyphenHeight = Math.max(2, eyeSize / 3); // Thick enough to be visible

    // Left happy hyphen eye
    ctx.fillRect(leftEyeX - eyeSize/4, eyeY + eyeSize/2, hyphenWidth, hyphenHeight);
    // Right happy hyphen eye
    ctx.fillRect(rightEyeX - eyeSize/4, eyeY + eyeSize/2, hyphenWidth, hyphenHeight);

  } else if (idleState.currentState === 'napping' || idleState.currentState === 'sleeping') {
    // Draw sleepy hyphen-shaped eyes
    ctx.fillStyle = '#000';
    const hyphenWidth = eyeSize * 1.5;
    const hyphenHeight = Math.max(1, eyeSize / 3);

    // Left sleepy eye
    ctx.fillRect(leftEyeX - eyeSize/4, eyeY + eyeSize/3, hyphenWidth, hyphenHeight);
    // Right sleepy eye
    ctx.fillRect(rightEyeX - eyeSize/4, eyeY + eyeSize/3, hyphenWidth, hyphenHeight);

  } else if (idleState.currentState === 'blinking' && isBlinking()) {
    // Draw closed eyes (thin horizontal lines)
    ctx.fillStyle = '#000';
    const blinkHeight = Math.max(1, eyeSize / 4);

    // Left closed eye
    ctx.fillRect(leftEyeX, eyeY + eyeSize/2, eyeSize, blinkHeight);
    // Right closed eye
    ctx.fillRect(rightEyeX, eyeY + eyeSize/2, eyeSize, blinkHeight);

  } else {
    // Draw normal white eyes
    ctx.fillStyle = '#fff';

    // Left eye
    ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
    // Right eye
    ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);
  }
}