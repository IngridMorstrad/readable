document.addEventListener('DOMContentLoaded', async () => {
  const chunkSizeSlider = document.getElementById('chunkSize');
  const chunkSizeValue = document.getElementById('chunkSizeValue');
  const questionIntervalSlider = document.getElementById('questionInterval');
  const questionIntervalValue = document.getElementById('questionIntervalValue');
  const aiProviderSelect = document.getElementById('aiProvider');
  const apiKeyInput = document.getElementById('apiKey');
  const apiKeyLabel = document.getElementById('apiKeyLabel');
  const startBtn = document.getElementById('startBtn');
  const status = document.getElementById('status');

  const providerNames = {
    gemini: 'Gemma 3 27B',
    openai: 'GPT-4o Mini',
    claude: 'Claude 3 Haiku'
  };

  // Load and display reading stats
  loadReadingStats();

  // Load and display read later queue
  loadReadLaterQueue();

  // Load saved settings
  const saved = await chrome.storage.local.get(['chunkSize', 'questionInterval', 'apiKey', 'aiProvider']);
  if (saved.chunkSize) {
    chunkSizeSlider.value = saved.chunkSize;
    chunkSizeValue.textContent = saved.chunkSize;
  }
  if (saved.questionInterval) {
    questionIntervalSlider.value = saved.questionInterval;
    questionIntervalValue.textContent = saved.questionInterval;
  }
  if (saved.aiProvider) {
    aiProviderSelect.value = saved.aiProvider;
    apiKeyLabel.textContent = providerNames[saved.aiProvider] || 'Gemini';
  }
  if (saved.apiKey) {
    apiKeyInput.value = saved.apiKey;
  }

  // Update API key label when provider changes
  aiProviderSelect.addEventListener('change', () => {
    apiKeyLabel.textContent = providerNames[aiProviderSelect.value] || 'Gemini';
    saveSettings();
  });

  // Update slider displays
  chunkSizeSlider.addEventListener('input', () => {
    chunkSizeValue.textContent = chunkSizeSlider.value;
  });

  questionIntervalSlider.addEventListener('input', () => {
    questionIntervalValue.textContent = questionIntervalSlider.value;
  });

  // Save settings on change
  const saveSettings = async () => {
    await chrome.storage.local.set({
      chunkSize: parseInt(chunkSizeSlider.value),
      questionInterval: parseInt(questionIntervalSlider.value),
      aiProvider: aiProviderSelect.value,
      apiKey: apiKeyInput.value
    });
  };

  chunkSizeSlider.addEventListener('change', saveSettings);
  questionIntervalSlider.addEventListener('change', saveSettings);
  apiKeyInput.addEventListener('change', saveSettings);

  // Save for later button
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const result = await ReadLater.addArticle({
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl || ''
      });

      if (result.success) {
        showStatus('Saved to queue', 'success');
        loadReadLaterQueue();
      } else {
        showStatus(result.message, 'error');
      }
    } catch (e) {
      showStatus('Failed to save', 'error');
    }
  });

  // Clear queue button
  const clearQueueBtn = document.getElementById('clearQueueBtn');
  clearQueueBtn.addEventListener('click', async () => {
    await ReadLater.clear();
    loadReadLaterQueue();
  });

  // Start reading
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    status.className = 'status';
    status.style.display = 'none';

    try {
      // Save current settings
      await saveSettings();

      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('No active tab found');
      }

      // Inject content scripts
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['lib/Readability.js', 'content/utils.js', 'content/twitter-parser.js', 'content/key-terms.js', 'content/reader.js', 'content/swiper.js', 'content/quiz.js', 'content/flashcard-export.js', 'content/stats.js', 'content/content.js']
      });

      // Inject styles
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/content.css']
      });

      // Send message to start reading
      await chrome.tabs.sendMessage(tab.id, {
        action: 'startReading',
        settings: {
          chunkSize: parseInt(chunkSizeSlider.value),
          questionInterval: parseInt(questionIntervalSlider.value),
          aiProvider: aiProviderSelect.value,
          apiKey: apiKeyInput.value
        }
      });

      // Close popup
      window.close();

    } catch (error) {
      console.error('Error:', error);
      status.textContent = error.message || 'Failed to start reader';
      status.className = 'status error';
      startBtn.disabled = false;
    }
  });
});

/**
 * Load and display reading stats in popup
 */
async function loadReadingStats() {
  const STORAGE_KEY = 'readable_stats';
  const statsContainer = document.getElementById('readingStats');
  if (!statsContainer) return;

  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const stats = result[STORAGE_KEY];

    if (!stats || stats.totalArticles === 0) {
      statsContainer.innerHTML = '<p class="stats-empty">No reading history yet</p>';
      return;
    }

    const accuracy = stats.totalQuizzes > 0
      ? Math.round((stats.correctAnswers / stats.totalQuizzes) * 100)
      : 0;

    const wordsFormatted = formatWordCount(stats.totalWords);

    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">${stats.totalArticles}</span>
          <span class="stat-label">Articles</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${wordsFormatted}</span>
          <span class="stat-label">Words</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${accuracy}%</span>
          <span class="stat-label">Quiz Accuracy</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.streakDays}</span>
          <span class="stat-label">Day Streak</span>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Failed to load stats:', e);
    statsContainer.innerHTML = '';
  }
}

function formatWordCount(count) {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K';
  }
  return count.toString();
}

/**
 * Load and display read later queue
 */
async function loadReadLaterQueue() {
  const section = document.getElementById('readLaterSection');
  const list = document.getElementById('readLaterList');
  const countEl = document.getElementById('queueCount');

  const queue = await ReadLater.getAll();
  countEl.textContent = queue.length;

  if (queue.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = queue.map(item => `
    <div class="read-later-item" data-url="${escapeAttr(item.url)}">
      ${item.favicon ? `<img class="read-later-favicon" src="${escapeAttr(item.favicon)}" alt="">` : ''}
      <span class="read-later-title">${escapeHtml(item.title)}</span>
      <button class="read-later-remove" data-url="${escapeAttr(item.url)}">&times;</button>
    </div>
  `).join('');

  // Add click handlers
  list.querySelectorAll('.read-later-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.classList.contains('read-later-remove')) {
        e.stopPropagation();
        const url = e.target.dataset.url;
        await ReadLater.removeArticle(url);
        loadReadLaterQueue();
        return;
      }

      const url = item.dataset.url;
      // Open in current tab and start reading
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.update(tab.id, { url });
      await ReadLater.removeArticle(url);
      window.close();
    });
  });
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  status.style.display = 'block';
  setTimeout(() => {
    status.style.display = 'none';
  }, 2000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
