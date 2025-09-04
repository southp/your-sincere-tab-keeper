/**
 * Maze Animation Framework
 * Handles the main animation loop, timing, and ambient animations
 */

// Animation state
let animationFrameId = null;
let lastFrameTime = 0;
export let ambientAnimationTime = 0; // Running time for ambient animations

/**
 * Start the animation loop
 */
export function startAnimationLoop(animateCallback) {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(animateCallback);
}

/**
 * Stop the animation loop
 */
export function stopAnimationLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Main animation loop function
 */
export function createAnimateFunction(
  canvas,
  updateMovement,
  updateCelebration,
  updateSweat,
  renderMaze,
  handleMazeComplete,
  // Dependencies
  celebrationState,
  playerVisualPos,
  mazeModel,
  WALL,
  canMoveTo,
  updateWallPushing,
  handleWallPushingRelease,
  resetIdleState,
  updateEyeDirection,
  updateIdleBehavior,
  eyeDirection,
  startCelebration,
  isHandlingCompletionRef
) {
  return function animate(currentTime) {
    if (!canvas) return;

    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Update movement physics
    const result = updateMovement(
      deltaTime,
      celebrationState,
      playerVisualPos,
      mazeModel,
      WALL,
      canMoveTo,
      updateWallPushing,
      handleWallPushingRelease,
      resetIdleState,
      updateEyeDirection,
      updateIdleBehavior,
      eyeDirection,
      startCelebration,
      isHandlingCompletionRef.current
    );

    if (result?.goalReached) {
      isHandlingCompletionRef.current = true;
      // Delay completion to show celebration animation
      setTimeout(() => {
        handleMazeComplete();
      }, celebrationState.duration);
    }

    // Update celebration animation
    updateCelebration(deltaTime, mazeModel.goalPos);

    // Update wall pushing effects (including sweat fade-out)
    updateSweat(currentTime, playerVisualPos);

    // Update ambient animation time
    ambientAnimationTime += deltaTime;

    // Always render to ensure consistent ambient animations (flag waving, etc.)
    renderMaze(mazeModel);

    // Continue animation loop
    animationFrameId = requestAnimationFrame(animate);
  };
}

/**
 * Get flag wave offset for goal animation using ambient animation time
 */
export function getFlagWaveOffset(position = 0.5) {
  const waveSpeed = 2.5; // Speed of wave traveling across flag
  const waveAmplitude = 0.08; // Gentler wave amplitude (in cells)

  // Create a traveling wave that flows from left to right
  // Position 0 = left edge (attached to pole), position 1 = right edge (free)
  const time = ambientAnimationTime / 1000;
  const wavePhase = (time * waveSpeed) - (position * Math.PI * 1.5);

  // The wave amplitude increases towards the free end of the flag
  // Attached edge (position=0) has no movement, free edge (position=1) has full movement
  const amplitudeMultiplier = position * position; // Quadratic increase towards free end

  // Simple sine wave that grows stronger towards the free end
  return Math.sin(wavePhase) * waveAmplitude * amplitudeMultiplier;
}

/**
 * Setup cleanup handler for animation on page unload
 */
export function setupAnimationCleanup() {
  window.addEventListener('beforeunload', () => {
    stopAnimationLoop();
  });
}

/**
 * Reset animation timing (useful when starting new games)
 */
export function resetAnimationTiming() {
  ambientAnimationTime = 0;
  lastFrameTime = performance.now();
}
