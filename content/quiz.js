/**
 * Quiz - MCQ generation and display
 */

var Quiz = (function() {
  var apiKey = '';
  var stats = {
    total: 0,
    correct: 0
  };

  /**
   * Set the API key
   */
  function setApiKey(key) {
    apiKey = key;
  }

  /**
   * Check if quiz is enabled (has API key)
   */
  function isEnabled() {
    return apiKey && apiKey.trim().length > 0;
  }

  /**
   * Generate a quiz question from text content
   */
  async function generateQuestion(textContent) {
    if (!isEnabled()) {
      throw new Error('Quiz is not enabled. Please provide an API key.');
    }

    var prompt = `Based on the following text, generate a multiple choice question with 4 options (A, B, C, D) to test reading comprehension. The question should test understanding of key concepts, not trivial details.

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, just the JSON):
{"question": "Your question here?", "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"], "correct": "A", "explanation": "Brief explanation of why this is correct"}

Text:
${textContent.substring(0, 2000)}`;

    try {
      var response = await chrome.runtime.sendMessage({
        action: 'generateQuiz',
        apiKey: apiKey,
        prompt: prompt
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Parse the response
      var quiz = parseQuizResponse(response.text);
      return quiz;

    } catch (error) {
      console.error('Quiz generation error:', error);
      throw error;
    }
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Parse the quiz response from the API
   */
  function parseQuizResponse(text) {
    // Try to extract JSON from the response
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse quiz response');
    }

    try {
      var quiz = JSON.parse(jsonMatch[0]);

      // Validate the quiz structure
      if (!quiz.question || !quiz.options || !quiz.correct) {
        throw new Error('Invalid quiz format');
      }

      if (!Array.isArray(quiz.options) || quiz.options.length !== 4) {
        throw new Error('Quiz must have exactly 4 options');
      }

      // Find the correct answer text before shuffling
      var correctLetter = quiz.correct.charAt(0).toUpperCase();
      var correctIndex = correctLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      var correctAnswerText = quiz.options[correctIndex];

      // Strip existing letter prefixes (A., B., etc.) for clean shuffle
      var cleanOptions = quiz.options.map(function(opt) {
        return opt.replace(/^[A-D]\.\s*/, '');
      });

      // Shuffle the options
      shuffleArray(cleanOptions);

      // Find new position of correct answer and re-add letter prefixes
      var newCorrectLetter = '';
      quiz.options = cleanOptions.map(function(opt, i) {
        var letter = String.fromCharCode(65 + i);
        if (correctAnswerText.includes(opt) || opt === correctAnswerText.replace(/^[A-D]\.\s*/, '')) {
          newCorrectLetter = letter;
        }
        return letter + '. ' + opt;
      });

      quiz.correct = newCorrectLetter;

      return quiz;
    } catch (e) {
      console.error('JSON parse error:', e, text);
      throw new Error('Could not parse quiz response');
    }
  }

  /**
   * Create loading placeholder HTML
   */
  function createLoadingCard(index) {
    return `
      <div class="readable-quiz readable-quiz-loading" data-quiz-index="${index}">
        <div class="readable-quiz-header">
          <span class="readable-quiz-icon">?</span>
          <span class="readable-quiz-label">Comprehension Check</span>
        </div>
        <div class="readable-quiz-loading-content">
          <div class="readable-quiz-spinner"></div>
          <div class="readable-quiz-loading-text">Generating question...</div>
        </div>
        <div class="readable-quiz-stats">
          Score: <span class="readable-quiz-score">${stats.correct}</span> / <span class="readable-quiz-total">${stats.total}</span>
        </div>
      </div>
    `;
  }

  /**
   * Create quiz card HTML
   */
  function createQuizCard(quiz, index) {
    var optionsHtml = quiz.options.map(function(option, i) {
      var letter = String.fromCharCode(65 + i); // A, B, C, D
      return `
        <button class="readable-quiz-option" data-answer="${letter}">
          ${escapeHtml(option)}
        </button>
      `;
    }).join('');

    return `
      <div class="readable-quiz" data-quiz-index="${index}">
        <div class="readable-quiz-header">
          <span class="readable-quiz-icon">?</span>
          <span class="readable-quiz-label">Comprehension Check</span>
        </div>
        <div class="readable-quiz-question">
          ${escapeHtml(quiz.question)}
        </div>
        <div class="readable-quiz-options">
          ${optionsHtml}
        </div>
        <div class="readable-quiz-feedback" style="display: none;">
          <div class="readable-quiz-result"></div>
          <div class="readable-quiz-explanation">${escapeHtml(quiz.explanation || '')}</div>
        </div>
        <div class="readable-quiz-stats">
          Score: <span class="readable-quiz-score">${stats.correct}</span> / <span class="readable-quiz-total">${stats.total}</span>
        </div>
      </div>
    `;
  }

  /**
   * Bind quiz interaction events
   */
  function bindQuizEvents(container, quiz) {
    var quizEl = container.querySelector('.readable-quiz');
    if (!quizEl) return;

    var options = quizEl.querySelectorAll('.readable-quiz-option');
    var feedback = quizEl.querySelector('.readable-quiz-feedback');
    var result = quizEl.querySelector('.readable-quiz-result');
    var answered = false;

    options.forEach(function(option) {
      option.addEventListener('click', function() {
        if (answered) return;

        answered = true;
        stats.total++;

        var selected = option.dataset.answer;
        var isCorrect = selected === quiz.correct;

        if (isCorrect) {
          stats.correct++;
          option.classList.add('readable-quiz-correct');
          result.textContent = 'Correct!';
          result.className = 'readable-quiz-result readable-quiz-result-correct';
        } else {
          option.classList.add('readable-quiz-wrong');
          result.textContent = 'Incorrect';
          result.className = 'readable-quiz-result readable-quiz-result-wrong';

          // Highlight correct answer
          options.forEach(function(opt) {
            if (opt.dataset.answer === quiz.correct) {
              opt.classList.add('readable-quiz-correct');
            }
          });
        }

        // Disable all options
        options.forEach(function(opt) {
          opt.disabled = true;
        });

        // Show feedback
        feedback.style.display = 'block';

        // Update stats display
        updateStatsDisplay();
      });
    });
  }

  /**
   * Update stats display in all quiz cards
   */
  function updateStatsDisplay() {
    document.querySelectorAll('.readable-quiz-score').forEach(function(el) {
      el.textContent = stats.correct;
    });
    document.querySelectorAll('.readable-quiz-total').forEach(function(el) {
      el.textContent = stats.total;
    });
  }

  /**
   * Get current stats
   */
  function getStats() {
    return { ...stats };
  }

  /**
   * Reset stats
   */
  function resetStats() {
    stats.total = 0;
    stats.correct = 0;
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update a loading card with actual quiz content
   */
  function updateLoadingCard(index, quiz) {
    var loadingCard = document.querySelector(`.readable-quiz-loading[data-quiz-index="${index}"]`);
    if (!loadingCard) return false;

    // Create new content
    var optionsHtml = quiz.options.map(function(option, i) {
      var letter = String.fromCharCode(65 + i);
      return `
        <button class="readable-quiz-option" data-answer="${letter}">
          ${escapeHtml(option)}
        </button>
      `;
    }).join('');

    // Update the card content
    loadingCard.classList.remove('readable-quiz-loading');
    loadingCard.innerHTML = `
      <div class="readable-quiz-header">
        <span class="readable-quiz-icon">?</span>
        <span class="readable-quiz-label">Comprehension Check</span>
      </div>
      <div class="readable-quiz-question">
        ${escapeHtml(quiz.question)}
      </div>
      <div class="readable-quiz-options">
        ${optionsHtml}
      </div>
      <div class="readable-quiz-feedback" style="display: none;">
        <div class="readable-quiz-result"></div>
        <div class="readable-quiz-explanation">${escapeHtml(quiz.explanation || '')}</div>
      </div>
      <div class="readable-quiz-stats">
        Score: <span class="readable-quiz-score">${stats.correct}</span> / <span class="readable-quiz-total">${stats.total}</span>
      </div>
    `;

    return true;
  }

  /**
   * Show error state on loading card
   */
  function showLoadingError(index, message) {
    var loadingCard = document.querySelector(`.readable-quiz-loading[data-quiz-index="${index}"]`);
    if (!loadingCard) return;

    loadingCard.classList.remove('readable-quiz-loading');
    loadingCard.classList.add('readable-quiz-error');
    loadingCard.innerHTML = `
      <div class="readable-quiz-header">
        <span class="readable-quiz-icon">!</span>
        <span class="readable-quiz-label">Quiz Unavailable</span>
      </div>
      <div class="readable-quiz-error-content">
        <p>${escapeHtml(message || 'Failed to generate question')}</p>
        <p class="readable-quiz-error-hint">Swipe to continue reading</p>
      </div>
    `;
  }

  // Public API
  return {
    setApiKey: setApiKey,
    isEnabled: isEnabled,
    generateQuestion: generateQuestion,
    createLoadingCard: createLoadingCard,
    createQuizCard: createQuizCard,
    updateLoadingCard: updateLoadingCard,
    showLoadingError: showLoadingError,
    bindQuizEvents: bindQuizEvents,
    getStats: getStats,
    resetStats: resetStats
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.Quiz = Quiz;
}
