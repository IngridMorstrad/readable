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
   * Sanitize HTML that originated from an untrusted page or API response.
   *
   * Removes script-capable elements, inline event handlers, and dangerous
   * URL schemes while preserving normal article markup (including MathML
   * and inline SVG used by KaTeX/MathJax).
   */
  function sanitizeHtml(html) {
    if (!html) return '';

    var template = document.createElement('template');
    template.innerHTML = String(html);

    var forbiddenTags = {
      SCRIPT: true,
      STYLE: true,
      IFRAME: true,
      FRAME: true,
      FRAMESET: true,
      OBJECT: true,
      EMBED: true,
      APPLET: true,
      LINK: true,
      META: true,
      BASE: true,
      FORM: true,
      INPUT: true,
      BUTTON: true,
      TEXTAREA: true,
      SELECT: true,
      OPTION: true,
      NOSCRIPT: true,
      TEMPLATE: true,
      // Active SVG/MathML elements can mutate attributes or load content.
      ANIMATE: true,
      ANIMATEMOTION: true,
      ANIMATETRANSFORM: true,
      SET: true,
      DISCARD: true,
      FOREIGNOBJECT: true
    };

    var urlAttrs = {
      href: true,
      src: true,
      action: true,
      formaction: true,
      poster: true,
      background: true,
      ping: true,
      srcset: true,
      'xlink:href': true
    };

    function isSafeUrl(value) {
      // Normalize before checking so obfuscated schemes (e.g. "java\nscript:")
      // are still caught.
      var normalized = String(value)
        .replace(/[\u0000-\u0020]+/g, '')
        .toLowerCase();
      if (/^(javascript|vbscript):/.test(normalized)) return false;
      // data: URLs are only safe for images; data:text/html is script-capable.
      if (/^data:/.test(normalized)) return /^data:image\//.test(normalized);
      return true;
    }

    // Collect first: removing nodes while walking mutates the live tree.
    var elements = Array.prototype.slice.call(
      template.content.querySelectorAll('*')
    );

    elements.forEach(function(el) {
      // SVG elements keep lowercase tagName values, so compare uppercased.
      if (forbiddenTags[el.tagName.toUpperCase()]) {
        el.remove();
        return;
      }

      Array.prototype.slice.call(el.attributes).forEach(function(attr) {
        var name = attr.name.toLowerCase();

        if (name.indexOf('on') === 0 || name === 'srcdoc') {
          el.removeAttribute(attr.name);
          return;
        }

        if (urlAttrs[name] && !isSafeUrl(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return template.innerHTML;
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
    sanitizeHtml: sanitizeHtml,
    renderMarkdown: renderMarkdown,
    formatWordCount: formatWordCount,
    sendMessage: sendMessage
  };
})();

if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
