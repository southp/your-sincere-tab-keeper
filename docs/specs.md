# PRD: Your Sincere Tab Keeper

## Overview
A Chrome extension that limits open tabs to a user-defined cap (1 ≤ C ≤ 10). When the user exceeds this limit, the new tab is replaced with a playful maze. The user must solve the maze to load the intended URL. The extension is designed to inspire reflection and support better tab habits, with no escape hatches.

---

## Goals
- Help users reflect on why they hoard tabs
- Encourage mindful tab usage
- Provide playful friction to form better habits
- Do so in a fun but firm way

---

## Key Features

### Tab Limit Enforcement
- User-defined tab limit `C` set during install (default UI allows 1–10)
- Applies to all tabs: manual, middle-click, startup, programmatic
- If a new tab exceeds the cap:
  - A maze game opens instead of the original URL
  - Solving the maze loads the original URL in that same tab
  - Closing the maze discards the attempt

### Maze Game
- Style: Chrome Dino aesthetic
- Difficulty: Starts above average (1–3 mins solve time)
- Progressively harder with each solved maze (per session)
- Difficulty resets on browser restart
- Fully bundled in extension (no network dependency)

### Limit Update Flow
- Browser action > “Update Tab Limit” button
- Triggers another maze
- After solving, user can set a new limit
- Browser **restarts with 0 tabs**, ignoring session restore

### Multiple Tabs & Edge Cases
- Only one maze tab allowed at a time
- Further tab attempts:
  - Flash the current maze tab (no auto-focus)
  - Show playful blob: “You already have a maze to solve!”
- Maze tabs opened in background stay there until clicked
- If URL fails after solving: show default error page

### UX Constraints
- No “disable temporarily” option
- No hidden keyboard shortcuts or bypasses
- Only uninstalling disables enforcement

---

## Stats & Feedback

### Insights Page (v1)
- Plain text display of:
  - Total mazes solved
  - Total tabs blocked
  - Average daily/weekly tab count
  - Peak tab overload time
- Available via popup or settings

---

## Incognito Mode
- Off by default
- Fully supported if user enables it manually
- Enforces tab limits same as normal mode

---

## Sync & Storage
- All data is local per device
- No syncing or cloud storage in v1

---

## Name
**Your Sincere Tab Keeper**  
> A quirky, loyal assistant helping you live your best tab life — one maze at a time.

---
