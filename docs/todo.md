## 🚧 Build Plan for "Your Sincere Tab Keeper"

This document provides a step-by-step roadmap to build the Chrome extension described in the PRD. It breaks the process into logically ordered, dependency-wired tasks and subtasks. Each task is marked with an ID for tracking and dependency resolution.

---

### Phase 0: 🧱 Project Setup

#### 0.1 Initialize Project Repository

* [ ] **0.1.1** Create a Git repository for the extension \[no deps]

  * Initialize `git`
  * Create remote repository (e.g., GitHub)
  * Add remote origin
* [ ] **0.1.2** Initialize with basic directory structure \[depends on 0.1.1]

  * Create folders: `/src`, `/assets`, `/scripts`
  * Add placeholder README files in each
* [ ] **0.1.3** Setup `.gitignore`, `README.md`, and MIT License \[depends on 0.1.1]

  * Add typical Node/Chrome extension ignores
  * Write a basic README with project goal
  * Add LICENSE file with MIT license text

#### 0.2 Setup Build Environment

* [ ] **0.2.1** Choose dev stack and dependencies \[no deps]

  * Use Vite + vanilla JS
  * Install `vite`, `vite-plugin-crx` if needed
* [ ] **0.2.2** Configure Vite for extension output \[depends on 0.2.1]

  * Setup input/output folders
  * Handle HTML input entries: `options.html`, `maze.html`
* [x] **0.2.3** ~~Enable live reload for development~~ \[removed - not applicable for browser extensions]

  * ~~Integrate Vite dev server~~ - Removed as dev servers don't apply to browser extensions
  * ~~Setup HMR for popup and options~~ - Extensions require manual reload in browser

---

### Phase 1: ⚙️ Basic Extension Framework

#### 1.1 Setup Chrome Extension Scaffold

* [ ] **1.1.1** Create `manifest.json` \[depends on 0.1.2]

  * Include `background.service_worker`, `action`, `permissions`, `host_permissions`
  * Add `options_page`, `icons`, `default_popup`
* [ ] **1.1.2** Create `background.js` \[depends on 1.1.1]

  * Add event listener scaffolds for `tabs.onCreated`, `runtime.onInstalled`
* [ ] **1.1.3** Create extension popup UI \[depends on 1.1.1]

  * Build basic HTML shell with action buttons
  * Style with CSS
* [ ] **1.1.4** Create options/settings page \[depends on 1.1.1]

  * Include a placeholder for stats and future controls

#### 1.2 Tab Counting & Blocking Logic

* [ ] **1.2.1** Detect new tab creation via `chrome.tabs.onCreated` \[depends on 1.1.2]

  * Log tab object and ID
  * Check if `url` is blank or default
* [ ] **1.2.2** Implement total tab count calculation \[depends on 1.2.1]

  * Use `chrome.tabs.query({})`
  * Filter out maze tabs via URL pattern
* [ ] **1.2.3** Redirect blocked tab to maze if count ≥ limit \[depends on 1.2.2]

  * Store intended URL in background state
  * Redirect tab to `maze.html?tabId=XXX`
* [ ] **1.2.4** Maintain a map of tabId → blocked URL \[depends on 1.2.3]

  * Use in-memory structure (reset on restart)
  * Clean up on tab close

---

### Phase 2: 🧩 Maze Game Implementation

#### 2.1 Setup Game Shell

* [ ] **2.1.1** Create `maze.html` + `maze.js` \[depends on 1.2.3]

  * Load canvas context
  * Layout grid logic (2D array)
* [ ] **2.1.2** Implement maze generation algorithm \[depends on 2.1.1]

  * Use depth-first or Prim’s algorithm
  * Render tiles using canvas
* [ ] **2.1.3** Add player entity and movement \[depends on 2.1.2]

  * Handle key presses (arrow keys / WASD)
  * Prevent illegal moves (walls)

#### 2.2 Game Logic & Completion

* [ ] **2.2.1** Detect goal reached condition \[depends on 2.1.3]

  * Mark goal tile visually
  * Check player collision with goal
* [ ] **2.2.2** Load original blocked URL from background \[depends on 2.2.1, 1.2.4]

  * Send message to background with `tabId`
  * Use `chrome.scripting.executeScript` or tab update to load URL
* [ ] **2.2.3** Scale maze difficulty by session counter \[depends on 2.2.1]

  * Track completions in local background state
  * Increase maze size or complexity accordingly
* [ ] **2.2.4** Reset difficulty on browser restart \[depends on 2.2.3]

  * Store difficulty in memory only (not persisted)

---

### Phase 3: 🔐 Tab Limit Settings

#### 3.1 Initial Limit Selection

* [ ] **3.1.1** Show setup screen on install (onboarding page) \[depends on 1.1.4]

  * Ask user to choose limit (1–10)
  * Explain consequences and philosophy
* [ ] **3.1.2** Store limit in `chrome.storage.local` \[depends on 3.1.1]

  * Validate number range
* [ ] **3.1.3** Enforce limit from storage in logic \[depends on 1.2.2, 3.1.2]

  * Fetch stored limit during background init

#### 3.2 Update Tab Limit Flow

* [ ] **3.2.1** Add "Update Limit" button to popup \[depends on 1.1.4]

  * Link to maze.html in new tab
* [ ] **3.2.2** Trigger maze tab for limit update \[depends on 3.2.1, 1.2.3]

  * Use special URL param to distinguish this case
* [ ] **3.2.3** After maze, show new limit prompt \[depends on 2.2.1, 3.2.2]

  * Let user pick new C value
  * Save to `chrome.storage.local`
* [ ] **3.2.4** Trigger browser restart without tabs \[depends on 3.2.3]

  * Use `chrome.runtime.restart()` if supported
  * Else display manual instruction page

---

### Phase 4: 💬 UX Enhancements

#### 4.1 Notification Bubble

* [ ] **4.1.1** Detect duplicate maze attempt \[depends on 1.2.2]

  * Check if maze tab already open
* [ ] **4.1.2** Flash existing maze tab \[depends on 4.1.1]

  * Use `chrome.tabs.update({ active: true })`
* [ ] **4.1.3** Show speech bubble UI from browser action \[depends on 4.1.1]

  * Use popup CSS to render floating message

#### 4.2 Incognito Support

* [ ] **4.2.1** Add incognito permission in manifest \[depends on 1.1.1]

  * Set `"incognito": "spanning"`
* [ ] **4.2.2** Extend tab logic to include incognito tabs \[depends on 1.2.2]

  * Respect per-window incognito detection

#### 4.3 Error Handling

* [ ] **4.3.1** Allow failed URLs to show browser default error \[depends on 2.2.2]

  * Let `chrome.tabs.update` load as-is

---

### Phase 5: 📊 Stats & Insights

#### 5.1 Tracking

* [ ] **5.1.1** Track maze completions in local storage \[depends on 2.2.1]

  * Increment count per success
* [ ] **5.1.2** Track total blocked tab attempts \[depends on 1.2.3]

  * Increment when tab gets redirected
* [ ] **5.1.3** Log timestamp when limit is hit \[depends on 1.2.3]

  * Use to infer peak time ranges

#### 5.2 Display

* [ ] **5.2.1** Create insights section in options.html \[depends on 1.1.4, 5.1.1–5.1.3]

  * Show plain text stats
  * Add date-based filters if needed

---

### Phase 6: 🧪 Testing & QA

#### 6.1 Manual Testing Checklist

* [ ] **6.1.1** Test all tab opening methods \[depends on 1.2.1]

  * Ctrl+T, middle-click, bookmarks, JS `window.open`
* [ ] **6.1.2** Verify maze overlay and completion \[depends on 2.2.1]

  * Solve and confirm intended URL loads
* [ ] **6.1.3** Check tab limit update + browser restart \[depends on 3.2.4]
* [ ] **6.1.4** Test incognito-specific behavior \[depends on 4.2.2]

#### 6.2 Polishing

* [ ] **6.2.1** Add extension icon and polish popup visuals \[depends on 2.1.1]

  * Use a fun but professional icon

---

### Phase 7: 🚀 Publish

#### 7.1 Release Process

* [ ] **7.1.1** Build final production bundle \[depends on all major tasks]

  * Remove debug logs
  * Verify manifest fields
* [ ] **7.1.2** Prepare store assets \[depends on 6.2.1]

  * Screenshot, banner, description, icon
* [ ] **7.1.3** Submit to Chrome Web Store \[depends on 7.1.1, 7.1.2]

  * Fill privacy and data use disclosures
