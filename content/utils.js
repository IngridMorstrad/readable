/**
 * Shared utility functions
 */

var Utils = (function() {
  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format word count for display (e.g., 1500 -> "1.5K")
   */
  function formatWordCount(count) {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  /**
   * Send message to background with retry (handles service worker wake-up)
   */
  async function sendMessage(message, retries) {
    retries = typeof retries === 'number' ? retries : 1;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (retries > 0 && error.message && error.message.includes('Receiving end does not exist')) {
        await new Promise(function(r) { setTimeout(r, 100); });
        return sendMessage(message, retries - 1);
      }
      throw error;
    }
  }

  return {
    escapeHtml: escapeHtml,
    formatWordCount: formatWordCount,
    sendMessage: sendMessage
  };
})();

if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
