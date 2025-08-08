/**
 * Blob page script - handles countdown and interactions
 */

// Countdown and auto-close
let timeLeft = 6;
const countdownEl = document.getElementById('countdown');

// Update countdown every second
const countdown = setInterval(() => {
    timeLeft--;
    countdownEl.textContent = timeLeft;
    
    if (timeLeft <= 0) {
        clearInterval(countdown);
        countdownEl.textContent = '0';
        
        // Try multiple methods to close the tab
        try {
            // Method 1: Use chrome.tabs API through background script
            chrome.runtime.sendMessage({ type: 'CLOSE_BLOB_TAB' });
        } catch (error) {
            console.log('Chrome API close failed, trying window.close()');
            // Method 2: Standard window.close()
            window.close();
        }
        
        // Method 3: Fallback - redirect to about:blank after a short delay
        setTimeout(() => {
            window.location.href = 'about:blank';
        }, 500);
    }
}, 1000);

// Add some interactive blob behavior
const blob = document.querySelector('.blob');

blob.addEventListener('mouseenter', () => {
    blob.style.transform = 'scale(1.1)';
});

blob.addEventListener('mouseleave', () => {
    blob.style.transform = 'scale(1)';
});

// Try to focus the maze tab when clicked
blob.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'FOCUS_MAZE_TAB' });
});

// Make the CTA button clickable
const mazeHint = document.querySelector('.maze-hint');
mazeHint.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'FOCUS_MAZE_TAB' });
});

// Also allow clicking anywhere else to focus maze
document.addEventListener('click', (e) => {
    if (e.target !== blob && !e.target.closest('.blob') && !e.target.closest('.maze-hint')) {
        chrome.runtime.sendMessage({ type: 'FOCUS_MAZE_TAB' });
    }
});