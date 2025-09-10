# Development Guide

## Project Structure

```
your-sincere-tab-keeper/
├── manifest.json              # Chrome extension manifest (project root)
├── src/                      # Source code
│   ├── background.js         # Service worker and core extension logic
│   ├── popup.*               # Extension popup interface
│   ├── options.*             # Settings and onboarding pages
│   ├── maze.*                # Interactive maze game
│   ├── blob.*                # Fun blocking page
│   └── *.js                  # Utility modules and shared components
├── assets/                   # Icons and static resources
│   └── icon.*                # Extension icons (various formats)
├── scripts/                  # Build tools and automation
│   └── *.js                  # Build scripts, validation, packaging
├── docs/                     # Documentation
│   └── *.md                  # Development guides and specifications
└── _locales/                 # Internationalization
```

## Loading the Extension for Development

### Unpacked Extension (Development)
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. **Select the project root directory** (`your-sincere-tab-keeper/`)
   - This will load `manifest.json` from the root
   - All paths in manifest point to `src/` and `assets/` directories

### Built Extension (Production)
1. Run `npm run build` to create `dist/` directory
2. Load `dist/` as unpacked extension for testing
3. Or zip `dist/` contents for Chrome Web Store

## Development Workflow

1. **Make changes** in `src/` directory
2. **Reload extension** in Chrome (click refresh icon in chrome://extensions)
3. **Test changes** - no build step needed for development
4. **Run linting**: `npm run lint` or `npm run lint:fix`
5. **Run tests**: `npm test`, `npm run test:watch`, or `npm run test:coverage`
6. **Validate extension**: `npm run validate`
7. **Build for production**: `npm run build` when ready

## Key Files

- **`manifest.json`** - Extension configuration (in project root)
- **`src/background.js`** - Service worker (main extension logic)
- **`src/tab-manager.js`** - Core tab management business logic
- **`src/maze.js`** - Maze game implementation
- **`assets/icon-*.png`** - Extension icons (generated from `icon.svg`)

## Important Path Considerations

**For Development (Unpacked Extension):**
- All source files are in `src/` directory relative to manifest
- JavaScript code uses `chrome.runtime.getURL('src/filename.html')`
- This allows loading unpacked extension from project root

**For Production (Built Extension):**
- Build process flattens HTML files to `dist/` root
- Build process automatically updates all `src/` references in JS files
- Final extension has flat structure for Chrome Web Store

## Build Process

The build process:
1. Syncs version numbers across package.json and manifest.json
2. Vite processes source files from `src/`
3. Copies `manifest.json` from project root
4. Copies `assets/` to `dist/assets/`
5. Outputs flat structure to `dist/` for Chrome Web Store

### Available Build Commands

- `npm run build` - Standard build with version sync
- `npm run build:clean` - Clean build (removes dist/ first)
- `npm run pack` - Build and create distributable packages
- `npm run pack:clean` - Clean pack (removes dist/ and packages/ first)
- `npm run zip` - Create extension.zip from dist/ folder
- `npm run validate` - Validate extension structure
- `npm run sync-version` - Sync versions between package.json and manifest.json

## Icon Generation

If you need to regenerate icons:
1. Edit `assets/icon.svg` 
2. Open `scripts/generate-icons.html` in browser
3. Download PNG files and save to `assets/`

## QA Tools & Debugging

The extension includes debugging utilities for development and testing:

### Tab Keeper Debug Tools (`debugTabKeeper`)

Available in the browser console when the extension is loaded:

```javascript
// Core state inspection
debugTabKeeper.getState()              // Get current state snapshot
debugTabKeeper.getAllTabs()            // Get all tabs with keeper status
debugTabKeeper.getStats()              // Get extension statistics
debugTabKeeper.getMazeSession()        // Get current maze session data

// Testing helpers
debugTabKeeper.simulateTabLimit(3)     // Set tab limit for testing
debugTabKeeper.setDailyMazeCount(120)  // Test difficulty levels
debugTabKeeper.forceBlock(url)         // Check if URL would be blocked

// Localization testing
debugTabKeeper.setLocale('zh_TW')      // Test Traditional Chinese
debugTabKeeper.setLocale('en')         // Test English
debugTabKeeper.setLocale()             // Reset to browser default

// Component testing
debugTabKeeper.openTrendGraphTestPage() // Open trend graph test page

// State management
debugTabKeeper.clearUnblockedTabs()    // Clear unblocked tabs set
debugTabKeeper.resetState()            // Reset all tab manager state
```

### Maze Debug Tools (`debugMaze`)

Available in the browser console when on the maze page:

```javascript
// Difficulty control
debugMaze.setDifficulty(0-6)          // Set difficulty (0=Beginner, 6=Insane)
debugMaze.getCurrentDifficulty()      // Get current difficulty level

// Maze completion
debugMaze.solveInstantly()            // Teleport to goal and finish

// Maze inspection
debugMaze.gameState()                 // Get current game state
debugMaze.getMazeGrid()               // Get maze grid (2D array)
debugMaze.getPlayerPos()              // Get player position {x, y}
debugMaze.getGoalPos()                // Get goal position {x, y}

// Pathfinding & hints
debugMaze.findPath()                  // Find solution path to goal
debugMaze.highlightPath()             // Visually highlight solution path
debugMaze.clearHighlight()            // Clear path highlighting

// Visual & testing
debugMaze.rerender()                  // Re-render maze canvas
debugMaze.regenerate()                // Generate new maze (same difficulty)
debugMaze.resetTimer()                // Reset timer to current time
```

### Getting Help

Both debug tools include built-in help:
- `debugTabKeeper.help()` - Show tab keeper debug commands
- `debugMaze.help()` - Show maze debug commands

### Usage Examples

```javascript
// Test tab limit behavior
debugTabKeeper.simulateTabLimit(3)
debugTabKeeper.getAllTabs().then(console.table)

// Test localization
debugTabKeeper.setLocale('zh_TW')

// Test maze difficulty progression
debugMaze.setDifficulty(3)  // Hard difficulty
debugMaze.highlightPath()   // Show solution
debugMaze.solveInstantly()  // Skip to completion

// Test insane difficulty with visual theme
debugTabKeeper.setDailyMazeCount(120)  // Triggers inferno theme
```
