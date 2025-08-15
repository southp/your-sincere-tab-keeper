# 🎨 Icon Generation Guide

## About the Icon Design

The "Your Sincere Tab Keeper" icon features:

- **Gradient background** - Purple to blue gradient representing the digital browser environment
- **Tab representations** - Four browser tabs at the top, with three normal tabs (green dots) and one highlighted "new tab" with a lightning bolt
- **Central maze element** - Green maze pattern representing the puzzle/game aspect
- **Player position** - Yellow dot at start position
- **Goal indicator** - Yellow square at finish position  
- **Keeper shield** - Subtle shield with checkmark representing the "keeper" guardian role
- **Decorative elements** - Small white dots for visual polish

## Design Philosophy

The icon conveys:
1. **Tab management** - Browser tabs prominently displayed
2. **Playful gaming** - Maze puzzle in vibrant green
3. **Protective oversight** - Shield symbol suggesting guardianship
4. **Modern aesthetic** - Gradients, shadows, and clean lines
5. **Brand consistency** - Matches the extension's friendly yet functional tone

## How to Generate PNG Icons

### Option 1: Using the HTML Generator (Recommended)

1. Open `scripts/generate-icons.html` in your browser
2. The script will automatically render the SVG at different sizes
3. Right-click each rendered icon and select "Save image as..."
4. Save with these exact filenames in the `assets/` directory:
   - `icon-16.png`
   - `icon-32.png` 
   - `icon-48.png`
   - `icon-128.png`

### Option 2: Using Online SVG to PNG Converter

1. Copy the contents of `assets/icon.svg`
2. Go to an online SVG to PNG converter (like convertio.co or online-convert.com)
3. Convert to PNG at these sizes: 16x16, 32x32, 48x48, 128x128
4. Download and rename files as above

### Option 3: Using Design Software

1. Open `assets/icon.svg` in:
   - **Inkscape** (free): File → Export PNG Image
   - **Adobe Illustrator**: File → Export → Export As → PNG  
   - **Figma**: Import SVG, resize artboard, export as PNG
   - **Sketch**: Import, resize, export

2. Export at the required sizes with the correct filenames

## Verification

After generating the icons:

1. Place all four PNG files in the `assets/` directory
2. Run `npm run build` to build the extension
3. Check `dist/assets/` to ensure icons are properly copied
4. Load the extension in Chrome to verify icons display correctly

The icons should appear:
- In the Chrome toolbar (16px, 32px)
- In Chrome's extension management page (48px)
- In the Chrome Web Store (128px)

## Color Palette Reference

- **Primary gradient**: `#667eea` to `#764ba2`
- **Tab background**: `#f8fafc` to `#e2e8f0`  
- **Tab accent**: `#10b981` (emerald green)
- **Maze gradient**: `#10b981` to `#059669` 
- **Highlight color**: `#fbbf24` (amber)
- **Alert/new tab**: `#f59e0b` (orange)