/**
 * KeyTerms - Auto-detect and define jargon/technical terms
 */

var KeyTerms = (function() {
  var definitionCache = new Map();
  var aiProvider = 'gemini';
  var apiKey = '';
  var pendingDefinitions = new Map(); // Track in-flight requests

  // Common words to exclude from key term detection
  var commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can',
    'will', 'just', 'should', 'now', 'also', 'like', 'new', 'first', 'last',
    'long', 'great', 'little', 'own', 'other', 'old', 'right', 'big', 'high',
    'different', 'small', 'large', 'next', 'early', 'young', 'important',
    'public', 'bad', 'same', 'able', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
    'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
    'whom', 'whose', 'have', 'has', 'had', 'do', 'does', 'did', 'be', 'is',
    'am', 'are', 'was', 'were', 'been', 'being', 'would', 'could', 'may',
    'might', 'must', 'shall', 'need', 'get', 'got', 'make', 'made', 'say',
    'said', 'see', 'saw', 'go', 'went', 'come', 'came', 'take', 'took',
    'know', 'knew', 'think', 'thought', 'look', 'want', 'give', 'use',
    'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call'
  ]);

  // Patterns that suggest technical terms
  var technicalPatterns = [
    /^[A-Z][a-z]+[A-Z]/, // CamelCase
    /^[A-Z]{2,}$/, // ALL CAPS acronyms
    /^[A-Z][a-z]*[A-Z][a-z]*$/, // Mixed case like iOS
    /-based$/, // X-based
    /-driven$/, // X-driven
    /^(?:pre|post|anti|multi|non|sub|super|meta|micro|macro)/i // Common prefixes
  ];

  /**
   * Configure the module
   */
  function configure(options) {
    if (options.apiKey) apiKey = options.apiKey;
    if (options.provider) aiProvider = options.provider;
  }

  /**
   * Detect potential key terms in text
   * Returns array of { term, start, end }
   */
  function detectTerms(text) {
    var terms = [];
    var seen = new Set();

    // Split into words while tracking positions
    var wordRegex = /\b([A-Za-z][A-Za-z0-9-]*(?:'[a-z]+)?)\b/g;
    var match;

    while ((match = wordRegex.exec(text)) !== null) {
      var word = match[1];
      var lowerWord = word.toLowerCase();

      // Skip common words
      if (commonWords.has(lowerWord)) continue;

      // Skip very short words
      if (word.length < 3) continue;

      // Skip if already seen this term
      if (seen.has(lowerWord)) continue;

      // Check if it's likely a key term
      if (isLikelyKeyTerm(word)) {
        seen.add(lowerWord);
        terms.push({
          term: word,
          start: match.index,
          end: match.index + word.length
        });
      }
    }

    return terms;
  }

  /**
   * Check if a word is likely a key term
   */
  function isLikelyKeyTerm(word) {
    // Check technical patterns
    for (var i = 0; i < technicalPatterns.length; i++) {
      if (technicalPatterns[i].test(word)) return true;
    }

    // Capitalized word in the middle of text (likely proper noun/term)
    if (/^[A-Z][a-z]{2,}$/.test(word)) return true;

    // Words with numbers
    if (/[a-z]\d|\d[a-z]/i.test(word)) return true;

    // Hyphenated technical terms
    if (word.includes('-') && word.length > 5) return true;

    return false;
  }

  /**
   * Wrap detected terms in HTML with data attributes
   */
  function markTermsInHtml(html, terms) {
    if (!terms || terms.length === 0) return html;

    // Create a temporary div to work with
    var temp = document.createElement('div');
    temp.innerHTML = html;

    // Walk text nodes and wrap terms
    walkTextNodes(temp, function(textNode) {
      var text = textNode.textContent;
      var detectedInNode = detectTerms(text);

      if (detectedInNode.length === 0) return;

      // Sort by position descending to replace from end
      detectedInNode.sort(function(a, b) { return b.start - a.start; });

      var newHtml = text;
      detectedInNode.forEach(function(t) {
        var before = newHtml.substring(0, t.start);
        var term = newHtml.substring(t.start, t.end);
        var after = newHtml.substring(t.end);
        newHtml = before +
          '<span class="readable-key-term" data-term="' + escapeHtml(term.toLowerCase()) + '">' +
          term + '</span>' + after;
      });

      var span = document.createElement('span');
      span.innerHTML = newHtml;

      textNode.parentNode.replaceChild(span, textNode);
    });

    return temp.innerHTML;
  }

  /**
   * Walk all text nodes in an element
   */
  function walkTextNodes(element, callback) {
    var walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    var nodes = [];
    var node;
    while (node = walker.nextNode()) {
      // Skip text nodes inside code blocks, links, or already marked terms
      var parent = node.parentNode;
      if (parent.closest('code, pre, a, .readable-key-term')) continue;
      if (node.textContent.trim().length > 0) {
        nodes.push(node);
      }
    }

    // Process in reverse to avoid position issues
    nodes.forEach(callback);
  }

  /**
   * Get definition for a term (from cache or AI)
   */
  async function getDefinition(term) {
    var lowerTerm = term.toLowerCase();

    // Check cache
    if (definitionCache.has(lowerTerm)) {
      return definitionCache.get(lowerTerm);
    }

    // Check if request is pending
    if (pendingDefinitions.has(lowerTerm)) {
      return pendingDefinitions.get(lowerTerm);
    }

    // If no API key, return a placeholder
    if (!apiKey) {
      return {
        term: term,
        definition: 'Definition not available (no API key configured)',
        source: 'none'
      };
    }

    // Generate definition via AI
    var promise = generateDefinition(term);
    pendingDefinitions.set(lowerTerm, promise);

    try {
      var result = await promise;
      definitionCache.set(lowerTerm, result);
      return result;
    } finally {
      pendingDefinitions.delete(lowerTerm);
    }
  }

  /**
   * Generate definition using AI
   */
  async function generateDefinition(term) {
    var prompt = 'Define the term "' + term + '" in 1-2 concise sentences. ' +
      'Focus on technical or domain-specific meaning if applicable. ' +
      'Return ONLY the definition, no prefix like "Definition:" or quotes.';

    try {
      var response = await chrome.runtime.sendMessage({
        action: 'generateQuiz',
        apiKey: apiKey,
        provider: aiProvider,
        prompt: prompt
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return {
        term: term,
        definition: response.text.trim(),
        source: 'ai'
      };
    } catch (error) {
      console.error('Definition generation error:', error);
      return {
        term: term,
        definition: 'Could not generate definition',
        source: 'error'
      };
    }
  }

  /**
   * Create and show tooltip for a term element
   */
  function showTooltip(termElement) {
    var term = termElement.dataset.term || termElement.textContent;

    // Remove any existing tooltip
    hideTooltip();

    // Create tooltip
    var tooltip = document.createElement('div');
    tooltip.className = 'readable-term-tooltip';
    tooltip.innerHTML = '<div class="readable-tooltip-loading">Loading...</div>';

    // Position tooltip
    var rect = termElement.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.bottom + 8) + 'px';

    document.body.appendChild(tooltip);

    // Store reference on element
    termElement._tooltip = tooltip;

    // Fetch definition
    getDefinition(term).then(function(result) {
      if (tooltip.parentNode) {
        tooltip.innerHTML =
          '<div class="readable-tooltip-term">' + escapeHtml(result.term) + '</div>' +
          '<div class="readable-tooltip-definition">' + escapeHtml(result.definition) + '</div>';

        // Reposition if needed (check if off-screen)
        var tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
          tooltip.style.left = (window.innerWidth - tooltipRect.width - 10) + 'px';
        }
        if (tooltipRect.bottom > window.innerHeight) {
          tooltip.style.top = (rect.top - tooltipRect.height - 8) + 'px';
        }
      }
    });
  }

  /**
   * Hide tooltip
   */
  function hideTooltip() {
    var existing = document.querySelector('.readable-term-tooltip');
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Initialize event listeners for term highlighting
   */
  function initializeListeners(container) {
    container.addEventListener('mouseenter', function(e) {
      if (e.target.classList.contains('readable-key-term')) {
        showTooltip(e.target);
      }
    }, true);

    container.addEventListener('mouseleave', function(e) {
      if (e.target.classList.contains('readable-key-term')) {
        hideTooltip();
      }
    }, true);
  }

  // Use shared utility
  var escapeHtml = Utils.escapeHtml;

  /**
   * Clear definition cache
   */
  function clearCache() {
    definitionCache.clear();
  }

  // Public API
  return {
    configure: configure,
    detectTerms: detectTerms,
    markTermsInHtml: markTermsInHtml,
    getDefinition: getDefinition,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
    initializeListeners: initializeListeners,
    clearCache: clearCache
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.KeyTerms = KeyTerms;
}
