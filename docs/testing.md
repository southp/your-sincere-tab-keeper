# Testing Guide - Your Sincere Tab Keeper

## 🚀 **Quick Start (5 minutes)**

### **Step 1: Load Extension**
1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle "Developer mode" ON (top-right corner)
3. Click "Load unpacked" button
4. Navigate to your project folder and select the `src/` directory
5. Click "Select Folder"
6. Extension icon should appear in your Chrome toolbar

### **Step 2: Initial Setup**
1. Onboarding page should automatically open in a new tab
2. Choose your tab limit (recommend starting with 3 for testing)
3. Click "Start My Tab Journey"
4. You should see the main options page with your settings

### **Step 3: Basic Functionality Test**
1. Open new tabs until you exceed your chosen limit
2. The next new tab should display a maze game instead of your intended page
3. Use arrow keys or WASD to navigate through the maze
4. After solving the maze, your original intended page should load

## 🎯 **Comprehensive Testing Checklist**

### **Core Functionality Tests**

#### **Test 1: Basic Tab Limiting** 🎯
- [ ] **Tab Count Enforcement**: Open tabs normally until you exceed your limit
- [ ] **Maze Appearance**: New tab should show maze instead of intended page  
- [ ] **Maze Controls**: Arrow keys and WASD should move the player
- [ ] **Goal Detection**: Reaching the goal should trigger completion
- [ ] **URL Loading**: Original page loads after maze completion

#### **Test 2: Multiple Tab Opening Methods** 📑
Test each of these methods to ensure universal coverage:
- [ ] `Ctrl+T` (new empty tab)
- [ ] `Ctrl+Click` on links (open in new tab)
- [ ] `Middle-click` on links
- [ ] Right-click → "Open link in new tab"
- [ ] Bookmarks → "Open in new tab"
- [ ] Address bar with `Ctrl+Enter`
- [ ] JavaScript `window.open()` calls

**Expected**: All methods should trigger the maze when limit is exceeded

#### **Test 3: Popup Interface** 🎮
- [ ] **Extension Icon**: Click the extension icon in toolbar
- [ ] **Current Stats**: Verify display of current tab limit and open tab count
- [ ] **Statistics**: Check mazes solved and tabs blocked counters
- [ ] **Update Button**: "Update Tab Limit" button should be functional
- [ ] **Stats Button**: "View Full Stats" should open options page
- [ ] **Visual Feedback**: Tab count should turn red when over limit

#### **Test 4: Maze Game Mechanics** 🧩
- [ ] **Player Movement**: Smooth movement with keyboard controls
- [ ] **Wall Collision**: Player cannot move through walls
- [ ] **Visual Design**: Chrome Dino aesthetic with clean graphics
- [ ] **Goal Visibility**: Goal should be clearly marked (different color)
- [ ] **Completion Animation**: Success overlay should appear on completion
- [ ] **Timer Function**: Timer should count up during gameplay

### **Advanced Feature Tests**

#### **Test 5: Progressive Difficulty** 📈
- [ ] **First Maze**: Should be beginner difficulty
- [ ] **Subsequent Mazes**: Each maze in same session should be larger
- [ ] **Session Tracking**: Difficulty should increase up to 6 levels
- [ ] **Difficulty Reset**: Difficulty should reset to beginner on a new day
- [ ] **Visual Indication**: Difficulty level should be displayed in maze UI

#### **Test 6: Duplicate Maze Handling** 🚫
- [ ] **Active Maze Detection**: Try opening new tab while maze is open
- [ ] **Blob Page**: Should open up the blob page indicating there is an existing maze.
- [ ] **No New Maze**: Should not create multiple maze tabs simultaneously

#### **Test 7: Tab Limit Updates** ⚙️
- [ ] **Update Button**: Click "Update Tab Limit" in popup
- [ ] **Special Maze**: Should open maze with "updateLimit" action
- [ ] **Limit Selection**: After solving, should show limit selection modal
- [ ] **Confirmation**: Should update limit and show confirmation

#### **Test 8: Statistics Tracking** 📊
- [ ] **Real-time Updates**: Statistics should update immediately after actions
- [ ] **Persistent Storage**: Stats should persist after browser restart
- [ ] **Options Page**: Full statistics should display in options page
- [ ] **Insights Generation**: Should show personalized insights based on usage
- [ ] **Export Function**: Should be able to export data as JSON
- [ ] **Reset Function**: Should be able to reset all statistics

### **User Experience Tests**

#### **Test 9: Onboarding Flow** 🎓
- [ ] **First Install**: Onboarding should auto-open on first install
- [ ] **Limit Selection**: Should be able to select limit
- [ ] **Descriptions**: Each limit should show helpful description
- [ ] **Completion**: Should save settings and show main interface

#### **Test 10: Options Page** ⚙️
- [ ] **Settings Display**: Current tab limit should be clearly shown
- [ ] **Statistics Grid**: Should show comprehensive usage statistics
- [ ] **Insights Section**: Should generate meaningful insights
- [ ] **Change Limit**: Should trigger maze for limit changes
- [ ] **Data Management**: Reset and export functions should work

### **Edge Case & Error Testing**

#### **Test 11: Invalid URLs** 🔧
- [ ] **Malformed URLs**: Try opening invalid URLs that exceed limit
- [ ] **Network Errors**: Test with URLs that will fail to load
- [ ] **Expected Behavior**: Maze should appear, then show browser error page after solving

#### **Test 12: Extension Management** 🔄
- [ ] **Disable/Enable**: Disable and re-enable extension
- [ ] **Settings Persistence**: Settings should persist through disable/enable
- [ ] **Session Reset**: Session counters should reset appropriately
- [ ] **Clean State**: No leftover maze tabs after disable

#### **Test 13: Browser Edge Cases** 🌐
- [ ] **Startup Tabs**: Test with multiple startup tabs configured
- [ ] **Session Restore**: Test with session restore enabled
- [ ] **Pinned Tabs**: Verify pinned tabs don't interfere with counting
- [ ] **Multiple Windows**: Test tab counting across multiple browser windows

## 🛠️ **Troubleshooting Common Issues**

### **Extension Won't Load**
**Symptoms**: Extension doesn't appear in extensions list
**Solutions**:
- Ensure you selected the `src/` directory (not root project directory)
- Check for error messages in `chrome://extensions/`
- Verify all required files are present in `src/`
- Look for syntax errors in manifest.json

### **Maze Doesn't Appear**
**Symptoms**: New tabs load normally even when over limit
**Solutions**:
- Verify tab limit is set correctly (check popup)
- Count actual open tabs vs your limit (exclude special Chrome pages)
- Check browser console for JavaScript errors (`F12`)
- Try refreshing the extension (toggle off/on)

### **Popup Doesn't Work**
**Symptoms**: Clicking extension icon does nothing
**Solutions**:
- Right-click extension icon → "Inspect popup"
- Check for JavaScript errors in popup console
- Verify popup.html file is present and valid
- Check if popup is blocked by browser settings

### **Statistics Not Updating**
**Symptoms**: Numbers don't change after solving mazes
**Solutions**:
- Check Chrome storage permissions
- Verify no JavaScript errors in background script
- Try resetting statistics from options page
- Check if storage quota is exceeded

### **Performance Issues**
**Symptoms**: Browser becomes slow or unresponsive
**Solutions**:
- Check for infinite loops in background script
- Monitor memory usage in Chrome Task Manager
- Verify maze generation isn't too resource-intensive
- Check for memory leaks in game canvas

## 📋 **Testing Priority Order**

For efficient testing, follow this priority order:

### **High Priority (Must Work)**
1. **Basic tab limiting** - Core functionality
2. **Maze game mechanics** - User engagement
3. **Popup interface** - User interaction
4. **Settings persistence** - User experience

### **Medium Priority (Should Work)**
5. **Progressive difficulty** - Enhanced experience
6. **Statistics tracking** - User insights
7. **Limit update flow** - Advanced functionality
8. **Error handling** - Robustness

### **Low Priority (Nice to Have)**
9. **Edge case handling** - Polish
10. **Performance optimization** - User experience
11. **Visual polish** - Aesthetics

## 🎉 **Success Indicators**

### **Extension Working Correctly When:**
✅ **Seamless Integration**: Tab limiting feels natural and non-intrusive
✅ **Engaging Experience**: Mazes are fun and appropriately challenging  
✅ **Reliable Behavior**: Works consistently across all tab opening methods
✅ **Helpful Feedback**: Statistics provide meaningful insights about usage
✅ **Intuitive Interface**: Users can easily understand and control settings
✅ **Performance**: No noticeable impact on browser speed or responsiveness

## 🚀 **Ready for Production**

### **Pre-Submission Checklist**
- [ ] All high priority tests pass
- [ ] No console errors during normal usage
- [ ] Extension works in fresh Chrome profile
- [ ] Incognito mode functions properly (if enabled)
- [ ] Performance impact is minimal
- [ ] User interface is polished and intuitive
