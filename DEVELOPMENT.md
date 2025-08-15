# Development Guide

## Project Structure

```
your-sincere-tab-keeper-claude/
├── manifest.json              # Chrome extension manifest (project root)
├── src/                      # Source code
│   ├── background.js         # Service worker
│   ├── popup.html/js/css     # Extension popup
│   ├── options.html/js/css   # Options page  
│   ├── maze.html/js/css      # Maze game
│   ├── blob.html/js          # Fun blocking page
│   └── *.js                  # Utility modules
├── assets/                   # Icons and static assets
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon.svg              # Master icon design
└── scripts/                  # Build and development tools
```

## Loading the Extension for Development

### Unpacked Extension (Development)
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. **Select the project root directory** (`your-sincere-tab-keeper-claude/`)
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
4. **Run tests**: `npm test` or `npm run test:coverage`
5. **Build for production**: `npm run build` when ready

## Key Files

- **`manifest.json`** - Extension configuration (in project root)
- **`src/background.js`** - Service worker (main extension logic)
- **`src/tab-manager.js`** - Core tab management business logic
- **`src/maze.js`** - Maze game implementation
- **`assets/icon-*.png`** - Extension icons (generated from `icon.svg`)

## Build Process

The build process:
1. Vite processes source files from `src/`
2. Copies `manifest.json` from project root
3. Copies `assets/` to `dist/assets/`
4. Outputs flat structure to `dist/` for Chrome Web Store

## Icon Generation

If you need to regenerate icons:
1. Edit `assets/icon.svg` 
2. Open `scripts/generate-icons.html` in browser
3. Download PNG files and save to `assets/`