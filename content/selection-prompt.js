/**
 * SelectionPrompt - Send selected text to LLM with preset prompts
 */

var SelectionPrompt = (function() {
  var apiKey = '';
  var aiProvider = 'gemini';
  var menu = null;
  var responsePanel = null;
  var currentSelection = '';

  /**
   * Configure the module
   */
  function configure(options) {
    if (options.apiKey) apiKey = options.apiKey;
    if (options.provider) aiProvider = options.provider;
  }

  /**
   * Initialize listeners on the container
   */
  function initializeListeners(container) {
    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleDocumentMouseDown);
  }

  /**
   * Handle mouseup to check for text selection
   */
  function handleMouseUp(e) {
    // Ignore if clicking on menu/panel
    if (e.target.closest('.readable-selection-menu, .readable-selection-panel')) {
      return;
    }

    var selection = window.getSelection();
    var text = selection.toString().trim();

    if (text.length > 3 && text.length < 2000) {
      currentSelection = text;
      showMenu(selection);
    }
  }

  /**
   * Handle document mousedown to close menu
   */
  function handleDocumentMouseDown(e) {
    if (!e.target.closest('.readable-selection-menu, .readable-selection-panel')) {
      hideMenu();
      hidePanel();
    }
  }

  /**
   * Show the selection menu near the selected text
   */
  function showMenu(selection) {
    hideMenu();

    var range = selection.getRangeAt(0);
    var rect = range.getBoundingClientRect();

    menu = document.createElement('div');
    menu.className = 'readable-selection-menu';
    menu.innerHTML =
      '<button data-prompt="explain">Explain</button>' +
      '<button data-prompt="how">How?</button>' +
      '<button data-prompt="why">Why?</button>' +
      '<button data-prompt="custom">Custom</button>';

    // Position menu above selection
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.top - 45) + 'px';

    document.body.appendChild(menu);

    // Bind button clicks
    menu.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        handlePromptClick(btn.dataset.prompt);
      });
    });

    // Reposition if off-screen
    var menuRect = menu.getBoundingClientRect();
    if (menuRect.top < 0) {
      menu.style.top = (rect.bottom + 8) + 'px';
    }
    if (menuRect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
    }
  }

  /**
   * Hide the selection menu
   */
  function hideMenu() {
    if (menu) {
      menu.remove();
      menu = null;
    }
  }

  /**
   * Handle prompt button click
   */
  function handlePromptClick(promptType) {
    if (promptType === 'custom') {
      showCustomPromptInput();
    } else {
      var prompt = buildPrompt(promptType, currentSelection);
      sendToLLM(prompt);
    }
  }

  /**
   * Build prompt based on type
   */
  function buildPrompt(type, text) {
    var prompts = {
      explain: 'Explain the following in simple terms:\n\n"' + text + '"',
      how: 'How does this work or how is this done?\n\n"' + text + '"',
      why: 'Why is this the case? What is the reasoning behind this?\n\n"' + text + '"'
    };
    return prompts[type] || text;
  }

  /**
   * Show custom prompt input
   */
  function showCustomPromptInput() {
    hideMenu();
    hidePanel();

    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    var rect = range.getBoundingClientRect();

    responsePanel = document.createElement('div');
    responsePanel.className = 'readable-selection-panel';
    responsePanel.innerHTML =
      '<div class="readable-selection-panel-header">' +
        '<span>Custom Prompt</span>' +
        '<button class="readable-selection-close">&times;</button>' +
      '</div>' +
      '<div class="readable-selection-custom-input">' +
        '<textarea placeholder="Enter your prompt..."></textarea>' +
        '<button class="readable-selection-send">Send</button>' +
      '</div>';

    positionPanel(responsePanel, rect);
    document.body.appendChild(responsePanel);

    // Focus textarea
    var textarea = responsePanel.querySelector('textarea');
    textarea.focus();

    // Bind close button
    responsePanel.querySelector('.readable-selection-close').addEventListener('click', hidePanel);

    // Bind send button
    responsePanel.querySelector('.readable-selection-send').addEventListener('click', function() {
      var customPrompt = textarea.value.trim();
      if (customPrompt) {
        var fullPrompt = customPrompt + '\n\nContext:\n"' + currentSelection + '"';
        hidePanel();
        sendToLLM(fullPrompt);
      }
    });

    // Allow Enter+Ctrl to send
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        responsePanel.querySelector('.readable-selection-send').click();
      }
    });
  }

  /**
   * Send prompt to LLM and show response
   */
  async function sendToLLM(prompt) {
    if (!apiKey) {
      showResponse('API key not configured. Set it in the extension popup.', true);
      return;
    }

    showResponse('<div class="readable-selection-loading">Thinking...</div>');

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

      showResponse(response.text);
    } catch (error) {
      showResponse('Error: ' + error.message, true);
    }
  }

  /**
   * Show response panel
   */
  function showResponse(content, isError) {
    hidePanel();

    var selection = window.getSelection();
    var rect;
    try {
      var range = selection.getRangeAt(0);
      rect = range.getBoundingClientRect();
    } catch (e) {
      // Selection may be gone, use center of screen
      rect = { left: window.innerWidth / 2 - 150, top: window.innerHeight / 2, bottom: window.innerHeight / 2 };
    }

    responsePanel = document.createElement('div');
    responsePanel.className = 'readable-selection-panel';

    var contentClass = isError ? 'readable-selection-error' : 'readable-selection-response';

    responsePanel.innerHTML =
      '<div class="readable-selection-panel-header">' +
        '<span>Response</span>' +
        '<button class="readable-selection-close">&times;</button>' +
      '</div>' +
      '<div class="' + contentClass + '">' + escapeHtml(content) + '</div>';

    positionPanel(responsePanel, rect);
    document.body.appendChild(responsePanel);

    // Bind close button
    responsePanel.querySelector('.readable-selection-close').addEventListener('click', hidePanel);
  }

  /**
   * Position panel near selection
   */
  function positionPanel(panel, rect) {
    panel.style.left = Math.max(10, rect.left) + 'px';
    panel.style.top = (rect.bottom + 10) + 'px';

    // Will reposition after render if needed
    requestAnimationFrame(function() {
      var panelRect = panel.getBoundingClientRect();
      if (panelRect.right > window.innerWidth - 10) {
        panel.style.left = (window.innerWidth - panelRect.width - 10) + 'px';
      }
      if (panelRect.bottom > window.innerHeight - 10) {
        panel.style.top = (rect.top - panelRect.height - 10) + 'px';
      }
    });
  }

  /**
   * Hide response panel
   */
  function hidePanel() {
    if (responsePanel) {
      responsePanel.remove();
      responsePanel = null;
    }
  }

  // Use shared utility
  var escapeHtml = Utils.escapeHtml;

  // Public API
  return {
    configure: configure,
    initializeListeners: initializeListeners,
    hideMenu: hideMenu,
    hidePanel: hidePanel
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.SelectionPrompt = SelectionPrompt;
}
