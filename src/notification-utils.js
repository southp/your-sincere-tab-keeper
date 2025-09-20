/**
 * Shared notification utility for consistent notifications across the extension
 */

/**
 * Show a notification with consistent styling
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info', 'warning')
 */
export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    max-width: 350px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;

  // Set colors based on type
  let colors = {};
  switch (type) {
    case 'success':
      colors = {
        background: '#d4edda',
        color: '#155724',
        border: '1px solid #c3e6cb'
      };
      break;
    case 'error':
      colors = {
        background: '#f8d7da',
        color: '#721c24',
        border: '1px solid #f5c6cb'
      };
      break;
    case 'warning':
      colors = {
        background: '#fff3cd',
        color: '#856404',
        border: '1px solid #ffeaa7'
      };
      break;
    default:
      colors = {
        background: '#d1ecf1',
        color: '#0c5460',
        border: '1px solid #bee5eb'
      };
  }

  notification.style.background = colors.background;
  notification.style.color = colors.color;
  notification.style.border = colors.border;

  // Create message element
  const messageElement = document.createElement('span');
  messageElement.textContent = message;
  messageElement.style.flex = '1';

  // Create dismiss button
  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  dismissButton.style.cssText = `
    background: none;
    border: none;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    padding: 0;
    margin: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s ease;
    color: inherit;
    opacity: 0.7;
  `;

  // Add hover effect to dismiss button
  dismissButton.addEventListener('mouseenter', () => {
    dismissButton.style.opacity = '1';
    dismissButton.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  });

  dismissButton.addEventListener('mouseleave', () => {
    dismissButton.style.opacity = '0.7';
    dismissButton.style.backgroundColor = 'transparent';
  });

  // Add click handler to dismiss button
  dismissButton.addEventListener('click', () => {
    dismissNotification(notification);
  });

  // Assemble notification
  notification.appendChild(messageElement);
  notification.appendChild(dismissButton);
  document.body.appendChild(notification);

  // Remove after 5 seconds (shorter for maze notifications)
  const timeoutId = setTimeout(() => {
    dismissNotification(notification);
  }, 5000);

  // Store timeout ID so we can cancel it if manually dismissed
  notification._timeoutId = timeoutId;

  // Add animation CSS if not already present
  if (!document.getElementById('notificationStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Dismiss a notification with animation
 * @param {HTMLElement} notification - The notification element to dismiss
 */
function dismissNotification(notification) {
  if (!notification || !notification.parentNode) return;

  // Cancel auto-dismiss timeout
  if (notification._timeoutId) {
    clearTimeout(notification._timeoutId);
  }

  // Animate out
  notification.style.animation = 'slideOut 0.3s ease-in-out';

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}
