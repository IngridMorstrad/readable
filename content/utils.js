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
   * Convert markdown to HTML (safe - escapes input first)
   */
  function renderMarkdown(text) {
    if (!text) return '';

    // Escape HTML first to prevent XSS
    var html = escapeHtml(text);

    // Code blocks (``` ... ```) - must be before other transforms
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });

    // Inline code (`code`)
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Headers (### then ## then #)
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_) - must be after bold
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, '<em>$1</em>');

    // Bullet lists (- or * at start of line)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');

    // Numbered lists (1. 2. etc)
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> items in <ul>
    html = html.replace(/(<li>[\s\S]*?<\/li>)(\n*(?:<li>[\s\S]*?<\/li>)*)/g, function(match) {
      return '<ul>' + match + '</ul>';
    });

    // Paragraphs - convert double newlines to paragraph breaks
    html = html.replace(/\n\n+/g, '</p><p>');

    // Single newlines to <br> (but not inside pre/code or after block elements)
    html = html.replace(/([^>])\n([^<])/g, '$1<br>$2');

    // Wrap in paragraph if not starting with block element
    if (!/^<(h[2-4]|ul|ol|pre|p)/.test(html)) {
      html = '<p>' + html + '</p>';
    }

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
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
    renderMarkdown: renderMarkdown,
    formatWordCount: formatWordCount,
    sendMessage: sendMessage
  };
})();

if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
