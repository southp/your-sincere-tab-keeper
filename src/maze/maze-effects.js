/**
 * Maze Effects System
 * Handles visual effects: celebration sparkles, wall pushing easter egg, sleep particles
 */

// Celebration state
export let celebrationState = {
  active: false,
  startTime: 0,
  duration: 2000, // 2 seconds
  sparkles: []
};

// Wall pushing state for easter egg
export let wallPushingState = {
  active: false,
  startTime: 0,
  direction: { x: 0, y: 0 },
  sweatDrops: [],
  gasping: false,
  gaspStartTime: 0,
  gaspDuration: 3000, // 3 seconds of gasping
  breathOffset: 0
};

// Idle timing configuration
export const IDLE_CONFIG = {
  blinkStartDelay: 5000,    // 5 seconds before blinking starts
  lookingStartDelay: 10000, // 10 seconds before looking around starts
  nappingStartDelay: 20000, // 20 seconds before napping starts
  sleepingStartDelay: 25000, // 25 seconds before ZZZ appears
  blinkInterval: 3000,      // Blink every 3 seconds when idle
  lookInterval: 2000,       // Change look direction every 2 seconds
  zzzInterval: 1500,        // New ZZZ every 1.5 seconds
  maxZzzParticles: 3        // Maximum ZZZ particles at any time
};

// Idle state
export let idleState = {
  currentState: 'awake', // 'awake', 'blinking', 'looking', 'napping', 'sleeping'
  lastMovementTime: 0,
  blinkTimer: 0,
  lookTimer: 0,
  lookDirection: { x: 0, y: 0 },
  sleepParticles: []
};

/**
 * Start celebration animation when goal is reached
 */
export function startCelebration(goalPos = { x: 0, y: 0 }) {
  celebrationState.active = true;
  celebrationState.startTime = performance.now();
  celebrationState.sparkles = [];

  // Create initial sparkles around the goal
  for (let i = 0; i < 20; i++) {
    celebrationState.sparkles.push(createSparkle(goalPos));
  }
}

/**
 * Create a sparkle particle for celebration
 */
function createSparkle(goalPos = { x: 0, y: 0 }) {
  const goalX = goalPos.x;
  const goalY = goalPos.y;

  return {
    x: goalX + (Math.random() - 0.5) * 2,
    y: goalY + (Math.random() - 0.5) * 2,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4 - 2, // Bias upward
    life: 1.0,
    decay: 0.015 + Math.random() * 0.01,
    size: 2 + Math.random() * 3,
    color: ['#FFD700', '#FF6B35', '#FF8A65', '#FFE0B2'][Math.floor(Math.random() * 4)]
  };
}

/**
 * Update celebration animation
 */
export function updateCelebration(deltaTime, goalPos = { x: 0, y: 0 }) {
  if (!celebrationState.active) return;

  const elapsed = performance.now() - celebrationState.startTime;
  const dt = deltaTime / 1000;

  // Update sparkles
  celebrationState.sparkles = celebrationState.sparkles.filter(sparkle => {
    // Update position
    sparkle.x += sparkle.vx * dt;
    sparkle.y += sparkle.vy * dt;
    sparkle.vy += 3 * dt; // Gravity

    // Update life
    sparkle.life -= sparkle.decay;

    return sparkle.life > 0;
  });

  // Add more sparkles periodically
  if (elapsed < celebrationState.duration * 0.7 && Math.random() < 0.1) {
    celebrationState.sparkles.push(createSparkle(goalPos));
  }

  // End celebration
  if (elapsed >= celebrationState.duration) {
    celebrationState.active = false;
    celebrationState.sparkles = [];
  }
}

/**
 * Get player hop offset for celebration animation
 */
export function getPlayerHopOffset() {
  if (!celebrationState.active) return 0;

  const elapsed = performance.now() - celebrationState.startTime;
  const hopFreq = 1; // hops per second - much slower for better visibility
  const hopHeight = 0.15; // maximum hop height in cells

  // Create a bouncing animation
  const phase = (elapsed / 1000) * hopFreq * Math.PI * 2;
  const bounce = Math.abs(Math.sin(phase));

  return -bounce * hopHeight; // Negative Y means upward
}

/**
 * Update wall pushing state (easter egg)
 */
export function updateWallPushing(currentTime, intendedVelocity, positionChanged) {
  // Check if player is trying to move but position didn't change (blocked by wall)
  const isBlocked = (intendedVelocity.x !== 0 || intendedVelocity.y !== 0) && !positionChanged;

  if (isBlocked) {
    const direction = { x: Math.sign(intendedVelocity.x), y: Math.sign(intendedVelocity.y) };

    // Check if this is the same direction as before
    if (wallPushingState.active &&
        wallPushingState.direction.x === direction.x &&
        wallPushingState.direction.y === direction.y) {
      // Continue pushing in same direction - update sweat
      updateSweat(currentTime);
    } else {
      // Start new wall pushing session
      wallPushingState.active = true;
      wallPushingState.startTime = currentTime;
      wallPushingState.direction = direction;
      wallPushingState.sweatDrops = [];
      wallPushingState.gasping = false;
    }
  } else {
    wallPushingState.active = false;
  }
}

/**
 * Handle wall pushing release (easter egg)
 */
export function handleWallPushingRelease(currentTime) {
  if (wallPushingState.active) {
    const pushingDuration = currentTime - wallPushingState.startTime;

    // If was pushing for more than 10 seconds, trigger gasping
    if (pushingDuration > 10000) {
      wallPushingState.gasping = true;
      wallPushingState.gaspStartTime = currentTime;
    }

    wallPushingState.active = false;
  }
}

/**
 * Update sweat drops during wall pushing
 */
export function updateSweat(currentTime, playerVisualPos = { x: 0, y: 0 }) {
  // Only create new sweat drops if actively pushing against wall
  if (wallPushingState.active) {
    const pushingDuration = currentTime - wallPushingState.startTime;

    // Start sweating after 13 seconds (10 + 3)
    if (pushingDuration > 13000) {
      // Add new sweat drop occasionally
      if (Math.random() < 0.05) { // 5% chance per frame
        wallPushingState.sweatDrops.push({
          x: playerVisualPos.x + (Math.random() - 0.5) * 0.3,
          y: playerVisualPos.y - 0.1,
          life: 1.0,
          speed: 0.5 + Math.random() * 0.3
        });
      }
    }
  }

  // Always update existing sweat drops (so they fade out naturally)
  const dt = 16 / 1000; // Approximate deltaTime
  wallPushingState.sweatDrops = wallPushingState.sweatDrops.filter(drop => {
    drop.y += drop.speed * dt;
    drop.life -= dt;
    return drop.life > 0 && drop.y < playerVisualPos.y + 1;
  });
}

/**
 * Update idle behavior system
 */
export function updateIdleBehavior(currentTime, deltaTime, playerVisualPos = { x: 0, y: 0 }, eyeDirection = { x: 0, y: 0 }) {
  const idleTime = currentTime - idleState.lastMovementTime;

  // Update idle state based on time
  if (idleTime > IDLE_CONFIG.sleepingStartDelay) {
    if (idleState.currentState !== 'sleeping') {
      idleState.currentState = 'sleeping';
      idleState.sleepParticles = [];
    }
  } else if (idleTime > IDLE_CONFIG.nappingStartDelay) {
    if (idleState.currentState !== 'napping') {
      idleState.currentState = 'napping';
      idleState.sleepParticles = [];
    }
  } else if (idleTime > IDLE_CONFIG.lookingStartDelay) {
    if (idleState.currentState !== 'looking') {
      idleState.currentState = 'looking';
      idleState.lookTimer = 0;
    }
  } else if (idleTime > IDLE_CONFIG.blinkStartDelay) {
    if (idleState.currentState !== 'blinking') {
      idleState.currentState = 'blinking';
      idleState.blinkTimer = 0;
    }
  }

  // Handle state-specific behavior
  switch (idleState.currentState) {
    case 'blinking':
      updateBlinkingBehavior(currentTime, eyeDirection);
      break;
    case 'looking':
      updateLookingBehavior(currentTime, eyeDirection);
      break;
    case 'napping':
    case 'sleeping':
      updateSleepingBehavior(currentTime, deltaTime, playerVisualPos);
      break;
  }
}

/**
 * Update blinking behavior
 */
function updateBlinkingBehavior(currentTime, eyeDirection = { x: 0, y: 0 }) {
  // Gradually return eyes to center and trigger periodic blinks
  eyeDirection.x = eyeDirection.x * 0.95;
  eyeDirection.y = eyeDirection.y * 0.95;

  // Snap to zero if very close
  if (Math.abs(eyeDirection.x) < 0.01) eyeDirection.x = 0;
  if (Math.abs(eyeDirection.y) < 0.01) eyeDirection.y = 0;

  // Update blink timer for periodic blinking (handled in rendering)
  idleState.blinkTimer = currentTime;
}

/**
 * Update looking around behavior
 */
function updateLookingBehavior(currentTime, eyeDirection = { x: 0, y: 0 }) {
  // Change look direction periodically
  if (currentTime - idleState.lookTimer > IDLE_CONFIG.lookInterval) {
    // Pick a new random direction to look
    const directions = [
      { x: -0.8, y: 0 },    // Left
      { x: 0.8, y: 0 },     // Right
      { x: 0, y: -0.8 },    // Up
      { x: 0, y: 0.8 },     // Down
      { x: -0.6, y: -0.6 }, // Up-left
      { x: 0.6, y: -0.6 },  // Up-right
      { x: 0, y: 0 }        // Center (rest)
    ];

    idleState.lookDirection = directions[Math.floor(Math.random() * directions.length)];
    idleState.lookTimer = currentTime;
  }

  // Smoothly interpolate to look direction
  const lerpSpeed = 3.0;
  const dt = 1/60; // Approximate delta time
  eyeDirection.x += (idleState.lookDirection.x - eyeDirection.x) * lerpSpeed * dt;
  eyeDirection.y += (idleState.lookDirection.y - eyeDirection.y) * lerpSpeed * dt;
}

/**
 * Update sleeping behavior with ZZZ particles
 */
function updateSleepingBehavior(currentTime, deltaTime, playerVisualPos = { x: 0, y: 0 }) {
  // Ensure minimum deltaTime to prevent particles getting stuck
  const dt = Math.max(deltaTime, 16) / 1000; // Minimum 16ms (60fps)

  // Update existing ZZZ particles
  idleState.sleepParticles = idleState.sleepParticles.filter(particle => {
    particle.age += dt;

    // Smooth fade in during first 0.3 seconds
    if (particle.age < 0.3) {
      particle.alpha = particle.age / 0.3;
    }
    // Fade out during last 0.3 seconds (faster fade-out)
    else if (particle.age > 2.7) {
      particle.alpha = Math.max(0, (3 - particle.age) / 0.3);
    }
    // Full opacity in middle phase
    else {
      particle.alpha = 1.0;
    }

    // Float upward with slight deceleration
    particle.y -= (0.8 - (particle.age * 0.1)) * dt;
    // Gentle horizontal drift
    particle.x += particle.drift * dt;

    return particle.age < 3; // Remove after 3 seconds
  });

  // Add new ZZZ particle if under limit and enough time has passed
  if (idleState.sleepParticles.length < IDLE_CONFIG.maxZzzParticles) {
    const lastParticle = idleState.sleepParticles[idleState.sleepParticles.length - 1];
    const shouldSpawn = idleState.sleepParticles.length === 0 ||
      (lastParticle && currentTime - lastParticle.birthTime > IDLE_CONFIG.zzzInterval);

    if (shouldSpawn) {
      // Create predefined spawn positions to avoid overlapping
      const spawnPositions = [
        { x: 0.1, y: -0.1 },    // Left position - very close to avatar
        { x: 0.25, y: -0.12 },  // Center position - slightly higher
        { x: 0.4, y: -0.1 }     // Right position - very close to avatar
      ];

      const positionIndex = idleState.sleepParticles.length % spawnPositions.length;
      const basePos = spawnPositions[positionIndex];

      const newParticle = {
        x: playerVisualPos.x + basePos.x + (Math.random() - 0.5) * 0.1, // Small random variation
        y: playerVisualPos.y + basePos.y + (Math.random() - 0.5) * 0.05,
        age: 0,
        birthTime: currentTime,
        drift: (Math.random() - 0.5) * 0.3, // Reduced drift for less chaos
        size: 0.9 + Math.random() * 0.2, // More consistent sizing
        alpha: 0 // Start transparent
      };

      idleState.sleepParticles.push(newParticle);
    }
  }
}

/**
 * Check if avatar is currently blinking
 */
export function isBlinking() {
  if (idleState.currentState !== 'blinking') return false;

  const timeSinceLastBlink = performance.now() - idleState.blinkTimer;
  const blinkCycle = timeSinceLastBlink % IDLE_CONFIG.blinkInterval;

  // Blink for 200ms every blinkInterval
  return blinkCycle < 200;
}

/**
 * Reset idle state (called when player moves)
 */
export function resetIdleState() {
  idleState.lastMovementTime = performance.now();
  idleState.currentState = 'awake';
  idleState.sleepParticles = [];
}
