document.addEventListener('DOMContentLoaded', async () => {
  const chunkSizeSlider = document.getElementById('chunkSize');
  const chunkSizeValue = document.getElementById('chunkSizeValue');
  const questionIntervalSlider = document.getElementById('questionInterval');
  const questionIntervalValue = document.getElementById('questionIntervalValue');
  const apiKeyInput = document.getElementById('apiKey');
  const startBtn = document.getElementById('startBtn');
  const status = document.getElementById('status');

  // Load saved settings
  const saved = await chrome.storage.local.get(['chunkSize', 'questionInterval', 'apiKey']);
  if (saved.chunkSize) {
    chunkSizeSlider.value = saved.chunkSize;
    chunkSizeValue.textContent = saved.chunkSize;
  }
  if (saved.questionInterval) {
    questionIntervalSlider.value = saved.questionInterval;
    questionIntervalValue.textContent = saved.questionInterval;
  }
  if (saved.apiKey) {
    apiKeyInput.value = saved.apiKey;
  }

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
      apiKey: apiKeyInput.value
    });
  };

  chunkSizeSlider.addEventListener('change', saveSettings);
  questionIntervalSlider.addEventListener('change', saveSettings);
  apiKeyInput.addEventListener('change', saveSettings);

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
        files: ['lib/Readability.js', 'content/reader.js', 'content/swiper.js', 'content/quiz.js', 'content/content.js']
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
