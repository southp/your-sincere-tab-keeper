/**
 * Maze Input System
 * Handles keyboard input, movement state management, and smooth movement physics
 */

// Movement state
export let movementState = {
  up: { pressed: false, timePressed: 0 },
  down: { pressed: false, timePressed: 0 },
  left: { pressed: false, timePressed: 0 },
  right: { pressed: false, timePressed: 0 }
};

export let currentVelocity = { x: 0, y: 0 };
export let isMoving = false;

// Movement configuration
export const MOVEMENT_CONFIG = {
  baseSpeed: 4.0,          // Base movement speed (cells per second)
  maxSpeed: 16.0,           // Maximum movement speed (cells per second)
  acceleration: 6.0,       // Acceleration rate (cells/s² per second)
  smoothingFactor: 0.85,   // Position interpolation smoothing (0-1)
  keyRepeatDelay: 150      // ms before acceleration starts
};

/**
 * Setup keyboard event listeners for smooth movement
 */
export function setupEventListeners() {
  // State-based keyboard controls for smooth movement
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Ignore auto-repeat events

    const currentTime = performance.now();

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        if (!movementState.up.pressed) {
          movementState.up.pressed = true;
          movementState.up.timePressed = currentTime;
        }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        if (!movementState.down.pressed) {
          movementState.down.pressed = true;
          movementState.down.timePressed = currentTime;
        }
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        if (!movementState.left.pressed) {
          movementState.left.pressed = true;
          movementState.left.timePressed = currentTime;
        }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        if (!movementState.right.pressed) {
          movementState.right.pressed = true;
          movementState.right.timePressed = currentTime;
        }
        break;
    }
  });

  // Handle key releases
  document.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        movementState.up.pressed = false;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        movementState.down.pressed = false;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        movementState.left.pressed = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        movementState.right.pressed = false;
        break;
    }
  });
}

/**
 * Update movement physics based on input state
 */
export function updateMovement(deltaTime, celebrationState, playerVisualPos, mazeModel, WALL, canMoveTo, updateWallPushing, handleWallPushingRelease, resetIdleState, updateEyeDirection, updateIdleBehavior, eyeDirection, startCelebration, isHandlingCompletion) {
  if (!deltaTime || deltaTime > 100) return; // Skip large time jumps or pauses

  const dt = deltaTime / 1000; // Convert to seconds
  const currentTime = performance.now();

  // Skip update if delta time is too small to prevent floating point precision issues
  if (dt < 0.001) return;

  // Stop all movement during celebration
  if (celebrationState.active) {
    currentVelocity.x = 0;
    currentVelocity.y = 0;
    isMoving = false;
    return;
  }

  // Calculate intended movement direction
  let intendedVelocity = { x: 0, y: 0 };
  let anyKeyPressed = false;

  // Check each direction and calculate velocity with acceleration
  Object.keys(movementState).forEach(direction => {
    const state = movementState[direction];
    if (!state.pressed) return;

    anyKeyPressed = true;
    const timeHeld = currentTime - state.timePressed;
    let speed = MOVEMENT_CONFIG.baseSpeed;

    // Apply smooth acceleration after initial delay
    if (timeHeld > MOVEMENT_CONFIG.keyRepeatDelay) {
      const accelerationTime = (timeHeld - MOVEMENT_CONFIG.keyRepeatDelay) / 1000;
      speed = Math.min(
        MOVEMENT_CONFIG.maxSpeed,
        MOVEMENT_CONFIG.baseSpeed + (MOVEMENT_CONFIG.acceleration * accelerationTime)
      );
    }

    // Apply direction
    switch (direction) {
      case 'up': intendedVelocity.y = -speed; break;
      case 'down': intendedVelocity.y = speed; break;
      case 'left': intendedVelocity.x = -speed; break;
      case 'right': intendedVelocity.x = speed; break;
    }
  });

  // Handle diagonal movement (normalize)
  if (intendedVelocity.x !== 0 && intendedVelocity.y !== 0) {
    const magnitude = Math.sqrt(intendedVelocity.x ** 2 + intendedVelocity.y ** 2);
    intendedVelocity.x = (intendedVelocity.x / magnitude) * Math.abs(intendedVelocity.x);
    intendedVelocity.y = (intendedVelocity.y / magnitude) * Math.abs(intendedVelocity.y);
  }

  // Smooth velocity changes
  if (anyKeyPressed) {
    currentVelocity.x = intendedVelocity.x;
    currentVelocity.y = intendedVelocity.y;
    isMoving = true;

    // Reset idle state when moving
    resetIdleState();

    // Update eye direction based on movement
    updateEyeDirection(intendedVelocity, dt);
  } else {
    currentVelocity.x = 0;
    currentVelocity.y = 0;
    isMoving = false;

    // Handle wall pushing release (easter egg)
    handleWallPushingRelease(currentTime);

    // Also reset wall pushing state when not moving
    updateWallPushing(currentTime, { x: 0, y: 0 }, false, playerVisualPos);

    // Update idle behavior
    updateIdleBehavior(currentTime, dt, playerVisualPos, eyeDirection);
  }

  // Update visual position with precise collision detection
  if (isMoving) {
    // Store previous position for wall pushing detection
    const prevX = playerVisualPos.x;
    const prevY = playerVisualPos.y;

    let newVisualX = playerVisualPos.x + (currentVelocity.x * dt);
    let newVisualY = playerVisualPos.y + (currentVelocity.y * dt);

    // Check X-axis movement separately to allow sliding along walls
    const targetLogicalX = Math.round(newVisualX);
    if (canMoveTo(targetLogicalX, Math.round(playerVisualPos.y), mazeModel, WALL)) {
      // Check if we're not going too far beyond the cell boundary
      const cellCenterX = Math.round(playerVisualPos.x);
      const maxDistance = 0.1; // Allow only 10% deviation from cell center

      if (Math.abs(newVisualX - cellCenterX) <= maxDistance ||
          canMoveTo(Math.floor(newVisualX), Math.round(playerVisualPos.y), mazeModel, WALL) &&
          canMoveTo(Math.ceil(newVisualX), Math.round(playerVisualPos.y), mazeModel, WALL)) {
        playerVisualPos.x = newVisualX;
      } else {
        // Stop at the boundary
        playerVisualPos.x = cellCenterX + Math.sign(newVisualX - cellCenterX) * maxDistance;
      }
    }

    // Check Y-axis movement separately to allow sliding along walls
    const targetLogicalY = Math.round(newVisualY);
    if (canMoveTo(Math.round(playerVisualPos.x), targetLogicalY, mazeModel, WALL)) {
      // Check if we're not going too far beyond the cell boundary
      const cellCenterY = Math.round(playerVisualPos.y);
      const maxDistance = 0.1; // Allow only 10% deviation from cell center

      if (Math.abs(newVisualY - cellCenterY) <= maxDistance ||
          canMoveTo(Math.round(playerVisualPos.x), Math.floor(newVisualY), mazeModel, WALL) &&
          canMoveTo(Math.round(playerVisualPos.x), Math.ceil(newVisualY), mazeModel, WALL)) {
        playerVisualPos.y = newVisualY;
      } else {
        // Stop at the boundary
        playerVisualPos.y = cellCenterY + Math.sign(newVisualY - cellCenterY) * maxDistance;
      }
    }

    // Check for wall pushing (easter egg)
    const positionChanged = Math.abs(playerVisualPos.x - prevX) > 0.001 ||
                           Math.abs(playerVisualPos.y - prevY) > 0.001;
    updateWallPushing(currentTime, intendedVelocity, positionChanged, playerVisualPos);

    // Check for goal completion - trigger when avatar center is close to goal center
    const distanceToGoal = Math.sqrt(
      Math.pow(playerVisualPos.x - mazeModel.goalPos.x, 2) +
      Math.pow(playerVisualPos.y - mazeModel.goalPos.y, 2)
    );

    if (distanceToGoal < 0.3 && !celebrationState.active && !isHandlingCompletion) {
      // Goal reached! Trigger celebration immediately
      startCelebration(mazeModel.goalPos);

      // Update logical position to goal for consistency
      mazeModel.playerPos.x = mazeModel.goalPos.x;
      mazeModel.playerPos.y = mazeModel.goalPos.y;

      // Set completion handling flag to prevent multiple triggers
      return { goalReached: true };
    }

    // Update logical position if moved significantly
    if (Math.abs(playerVisualPos.x - mazeModel.playerPos.x) > 0.5 ||
        Math.abs(playerVisualPos.y - mazeModel.playerPos.y) > 0.5) {

      const currentLogicalX = Math.round(playerVisualPos.x);
      const currentLogicalY = Math.round(playerVisualPos.y);

      if (currentLogicalX !== mazeModel.playerPos.x || currentLogicalY !== mazeModel.playerPos.y) {
        // Double-check that the logical position is valid
        if (canMoveTo(currentLogicalX, currentLogicalY, mazeModel, WALL)) {
          mazeModel.movePlayer(
            currentLogicalX - mazeModel.playerPos.x,
            currentLogicalY - mazeModel.playerPos.y
          );
        }
      }
    }
  }

  return { goalReached: false };
}

/**
 * Legacy instant movement function for compatibility
 */
export function movePlayer(dx, dy, mazeModel, playerVisualPos, startCelebration, handleMazeComplete, celebrationState) {
  // This function is kept for compatibility but movement is now handled by the animation loop
  // We can still use it for instant movement in special cases (like debug commands)
  const goalReached = mazeModel.movePlayer(dx, dy);

  // Snap visual position to logical position for instant movement
  playerVisualPos.x = mazeModel.playerPos.x;
  playerVisualPos.y = mazeModel.playerPos.y;

  if (goalReached) {
    startCelebration(mazeModel.goalPos);
    // Delay completion to show celebration animation
    setTimeout(() => {
      handleMazeComplete();
    }, celebrationState.duration);
  }
}
