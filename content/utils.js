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

  return {
    escapeHtml: escapeHtml,
    formatWordCount: formatWordCount
  };
})();

if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
