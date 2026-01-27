/**
 * Summarize - Article summarization with AI
 */

var Summarize = (function() {
  var settings = {
    apiKey: '',
    aiProvider: 'gemini'
  };

  /**
   * Generate summary of article content
   */
  async function generateSummary(textContent, title) {
    var prompt = `Summarize the following article in 3-5 concise bullet points. Focus on the key takeaways and main arguments. Be brief but comprehensive.

Title: ${title || 'Article'}

Article:
${textContent.substring(0, 8000)}

Return the summary as bullet points, each starting with "• ".`;

    try {
      var response = await Utils.sendMessage({
        action: 'generateQuiz',
        apiKey: settings.apiKey,
        provider: settings.aiProvider,
        prompt: prompt
      });

      if (response && response.error) {
        throw new Error(response.error);
      }

      if (!response || !response.text) {
        throw new Error('No response from AI provider');
      }

      return response.text;
    } catch (error) {
      console.error('Summary generation error:', error);
      throw error;
    }
  }

  /**
   * Show summary overlay
   */
  function showSummaryOverlay(title, summary, isLoading) {
    // Remove existing overlay if present
    var existing = document.querySelector('.readable-summary-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'readable-summary-overlay';
    overlay.innerHTML = `
      <div class="readable-summary-container">
        <div class="readable-summary-header">
          <h2>Summary</h2>
          <button class="readable-summary-close">&times;</button>
        </div>
        <h3 class="readable-summary-title">${Utils.escapeHtml(title)}</h3>
        <div class="readable-summary-content">
          ${isLoading ? '<div class="readable-summary-loading"><div class="readable-loading-spinner"></div><span>Generating summary...</span></div>' : formatSummary(summary)}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('.readable-summary-close').addEventListener('click', function() {
      overlay.remove();
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Escape key to close
    var escHandler = function(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return overlay;
  }

  /**
   * Update overlay with summary content
   */
  function updateSummaryContent(overlay, summary) {
    var content = overlay.querySelector('.readable-summary-content');
    if (content) {
      content.innerHTML = formatSummary(summary);
    }
  }

  /**
   * Show error in overlay
   */
  function showSummaryError(overlay, errorMsg) {
    var content = overlay.querySelector('.readable-summary-content');
    if (content) {
      content.innerHTML = `<div class="readable-summary-error">${Utils.escapeHtml(errorMsg)}</div>`;
    }
  }

  /**
   * Format summary text with proper styling
   */
  function formatSummary(text) {
    // Split by bullet points or newlines
    var lines = text.split(/\n/).filter(function(line) {
      return line.trim().length > 0;
    });

    var html = '<ul class="readable-summary-list">';
    lines.forEach(function(line) {
      // Remove leading bullet characters
      var cleanLine = line.replace(/^[\s•\-\*]+/, '').trim();
      if (cleanLine) {
        html += '<li>' + Utils.escapeHtml(cleanLine) + '</li>';
      }
    });
    html += '</ul>';

    return html;
  }

  /**
   * Start summarization
   */
  async function start(options) {
    settings = Object.assign(settings, options);

    try {
      var article;
      var textContent;

      // Check for Twitter/X thread
      if (typeof TwitterParser !== 'undefined' && TwitterParser.isTwitterThread()) {
        var thread = TwitterParser.extractThread();
        if (!thread) {
          alert('Could not extract thread content.');
          return;
        }
        article = { title: thread.title };
        textContent = thread.blocks.map(function(b) {
          return b.content;
        }).join('\n\n');
      } else {
        // Extract article using Readability
        article = Reader.extractArticle();
        if (!article) {
          alert('Could not extract article content from this page.');
          return;
        }
        textContent = article.textContent || article.content.replace(/<[^>]+>/g, ' ');
      }

      // Show loading overlay
      var overlay = showSummaryOverlay(article.title, '', true);

      // Generate summary
      var summary = await generateSummary(textContent, article.title);
      updateSummaryContent(overlay, summary);

    } catch (error) {
      console.error('Summarize error:', error);
      var existingOverlay = document.querySelector('.readable-summary-overlay');
      if (existingOverlay) {
        showSummaryError(existingOverlay, error.message);
      } else {
        alert('Error: ' + error.message);
      }
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'summarize') {
      start(request.settings);
      sendResponse({ success: true });
    }
    return true;
  });

  return {
    start: start,
    generateSummary: generateSummary
  };
})();
