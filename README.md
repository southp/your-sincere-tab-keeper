# Your Sincere Tab Keeper

A Chrome extension that limits open tabs to a user-defined cap (1 ≤ C ≤ 10). When the user exceeds this limit, the new tab is replaced with a playful maze. The user must solve the maze to load the intended URL.

## Goal

Help users reflect on why they hoard tabs and encourage mindful tab usage through playful friction, forming better habits in a fun but firm way.

## Key Features

- **Tab Limit Enforcement**: User-defined tab limit with maze game when exceeded
- **Maze Game**: Chrome Dino aesthetic with progressive difficulty
- **Limit Update Flow**: Solve a maze to change your tab limit
- **Stats & Insights**: Track your tab usage patterns
- **No Escape Hatches**: Only uninstalling disables enforcement

## Development

This extension is built with:
- Vite + Vanilla JavaScript
- Chrome Extension Manifest V3
- Canvas-based maze game

### Setup

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Installation

1. Build the extension or download from Chrome Web Store
2. Load unpacked extension in Chrome Developer Mode
3. Set your initial tab limit (1-10)
4. Start your mindful browsing journey!

## Philosophy

> A quirky, loyal assistant helping you live your best tab life — one maze at a time.

## License

MIT License - see LICENSE file for details.

