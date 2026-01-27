/**
 * SelectionPrompt - Send selected text to LLM with preset prompts
 */

var SelectionPrompt = (function() {
  var apiKey = '';
  var aiProvider = 'gemini';
  var menu = null;
  var responsePanels = [];  // Stack of panels for recursive selection
  var currentSelection = '';
  var baseZIndex = 2147483600;  // Leave room for stacking

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
    // Ignore if clicking on menu buttons
    if (e.target.closest('.readable-selection-menu')) {
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
   * Handle document mousedown to close menu/panels
   */
  function handleDocumentMouseDown(e) {
    // Always hide menu when clicking outside it
    if (!e.target.closest('.readable-selection-menu')) {
      hideMenu();
    }
    // Only close panels when clicking completely outside all panels
    if (!e.target.closest('.readable-selection-menu, .readable-selection-panel')) {
      hideAllPanels();
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

    // Position menu above selection with highest z-index
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.top - 45) + 'px';
    menu.style.zIndex = baseZIndex + 100 + responsePanels.length;

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
      explain: 'Explain the following in simple terms, as briefly as possible:\n\n"' + text + '"',
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

    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    var rect = range.getBoundingClientRect();

    var panel = document.createElement('div');
    panel.className = 'readable-selection-panel';
    panel.innerHTML =
      '<div class="readable-selection-panel-header">' +
        '<span>Custom Prompt</span>' +
        '<button class="readable-selection-close">&times;</button>' +
      '</div>' +
      '<div class="readable-selection-custom-input">' +
        '<textarea placeholder="Enter your prompt..."></textarea>' +
        '<button class="readable-selection-send">Send</button>' +
      '</div>';

    // Set z-index based on stack depth
    panel.style.zIndex = baseZIndex + responsePanels.length;

    positionPanel(panel, rect);
    document.body.appendChild(panel);
    responsePanels.push(panel);

    // Focus textarea
    var textarea = panel.querySelector('textarea');
    textarea.focus();

    // Bind close button to remove this specific panel
    panel.querySelector('.readable-selection-close').addEventListener('click', function() {
      removePanel(panel);
    });

    // Bind send button
    panel.querySelector('.readable-selection-send').addEventListener('click', function() {
      var customPrompt = textarea.value.trim();
      if (customPrompt) {
        var fullPrompt = customPrompt + '\n\nContext:\n"' + currentSelection + '"';
        removePanel(panel);
        sendToLLM(fullPrompt);
      }
    });

    // Allow Enter+Ctrl to send
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        panel.querySelector('.readable-selection-send').click();
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

    showResponse('Thinking...', false, true);

    try {
      var response = await Utils.sendMessage({
        action: 'generateQuiz',
        apiKey: apiKey,
        provider: aiProvider,
        prompt: prompt
      });

      if (response && response.error) {
        throw new Error(response.error);
      }

      showResponse(response && response.text ? response.text : 'No response');
    } catch (error) {
      showResponse('Error: ' + error.message, true);
    }
  }

  /**
   * Show response panel
   */
  function showResponse(content, isError, isLoading) {
    var selection = window.getSelection();
    var rect;
    try {
      var range = selection.getRangeAt(0);
      rect = range.getBoundingClientRect();
    } catch (e) {
      // Selection may be gone, use center of screen
      rect = { left: window.innerWidth / 2 - 150, top: window.innerHeight / 2, bottom: window.innerHeight / 2 };
    }

    var panel = document.createElement('div');
    panel.className = 'readable-selection-panel';

    var contentClass = isLoading ? 'readable-selection-loading' :
                       isError ? 'readable-selection-error' : 'readable-selection-response';

    var displayContent = isLoading || isError ? escapeHtml(content) : Utils.renderMarkdown(content);

    // Add depth indicator for nested panels
    var depthLabel = responsePanels.length > 0 ? ' (Level ' + (responsePanels.length + 1) + ')' : '';

    panel.innerHTML =
      '<div class="readable-selection-panel-header">' +
        '<span>Response' + depthLabel + '</span>' +
        '<button class="readable-selection-close">&times;</button>' +
      '</div>' +
      '<div class="' + contentClass + '">' + displayContent + '</div>';

    // Set z-index based on stack depth
    panel.style.zIndex = baseZIndex + responsePanels.length;

    // Add visual distinction for nested panels
    if (responsePanels.length > 0) {
      panel.classList.add('readable-selection-panel-nested');
      panel.dataset.depth = responsePanels.length;
    }

    positionPanel(panel, rect, responsePanels.length);
    document.body.appendChild(panel);
    responsePanels.push(panel);

    // Bind close button to remove this specific panel
    panel.querySelector('.readable-selection-close').addEventListener('click', function() {
      removePanel(panel);
    });

    // Enable recursive selection on non-loading response content
    if (!isLoading && !isError) {
      var responseContent = panel.querySelector('.readable-selection-response');
      if (responseContent) {
        responseContent.addEventListener('mouseup', handleMouseUp);
      }
    }
  }

  /**
   * Position panel near selection, ensuring it fits on screen
   */
  function positionPanel(panel, rect, depth) {
    depth = depth || 0;
    // Offset nested panels to cascade visually
    var offset = depth * 20;

    panel.style.left = Math.max(10, rect.left + offset) + 'px';
    panel.style.top = (rect.bottom + 10 + offset) + 'px';

    // Reposition after render to fit on screen
    requestAnimationFrame(function() {
      var panelRect = panel.getBoundingClientRect();
      var maxHeight = window.innerHeight - 20;

      // Constrain width
      if (panelRect.right > window.innerWidth - 10) {
        panel.style.left = (window.innerWidth - panelRect.width - 10) + 'px';
      }

      // If panel is taller than viewport, constrain height and position at top
      if (panelRect.height > maxHeight) {
        panel.style.maxHeight = maxHeight + 'px';
        panel.style.top = (10 + offset) + 'px';
      } else if (panelRect.bottom > window.innerHeight - 10) {
        // Try positioning above selection
        var topPos = rect.top - panelRect.height - 10;
        if (topPos < 10) {
          // Not enough room above, position at top of viewport
          panel.style.top = (10 + offset) + 'px';
        } else {
          panel.style.top = topPos + 'px';
        }
      }

      // Final bounds check
      panelRect = panel.getBoundingClientRect();
      if (panelRect.top < 10) {
        panel.style.top = (10 + offset) + 'px';
      }
    });

    // Make panel draggable
    makeDraggable(panel);
  }

  /**
   * Make panel draggable by its header
   */
  function makeDraggable(panel) {
    var header = panel.querySelector('.readable-selection-panel-header');
    if (!header) return;

    header.style.cursor = 'move';
    var isDragging = false;
    var startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', function(e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = panel.offsetLeft;
      startTop = panel.offsetTop;
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, startLeft + dx));
      var newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, startTop + dy));
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
    });
  }

  /**
   * Remove a specific panel from the stack
   */
  function removePanel(panel) {
    var index = responsePanels.indexOf(panel);
    if (index !== -1) {
      panel.remove();
      responsePanels.splice(index, 1);
    }
  }

  /**
   * Hide all response panels
   */
  function hideAllPanels() {
    responsePanels.forEach(function(panel) {
      panel.remove();
    });
    responsePanels = [];
  }

  /**
   * Hide top panel only (for backwards compatibility)
   */
  function hidePanel() {
    if (responsePanels.length > 0) {
      var panel = responsePanels.pop();
      panel.remove();
    }
  }

  // Use shared utility
  var escapeHtml = Utils.escapeHtml;

  // Public API
  return {
    configure: configure,
    initializeListeners: initializeListeners,
    hideMenu: hideMenu,
    hidePanel: hidePanel,
    hideAllPanels: hideAllPanels
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.SelectionPrompt = SelectionPrompt;
}
