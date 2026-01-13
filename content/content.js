/**
 * Content Script - Main orchestrator
 */

(function() {
  // Prevent multiple initializations
  if (window.__readableInitialized) {
    return;
  }
  window.__readableInitialized = true;

  var settings = {
    chunkSize: 100,
    questionInterval: 3,
    apiKey: ''
  };

  var chunks = [];
  var chunkWordCounts = []; // Word count per chunk for stats tracking
  var quizPositions = new Set();
  var preGeneratedQuizzes = new Map(); // Store pre-generated quizzes by CHUNK index (stable)
  var quizGenerationQueue = []; // Queue of quiz contexts to generate
  var isGenerating = false;
  var generationAborted = false;
  var GENERATION_DELAY = 2000; // 2 seconds between API calls
  var chunkToPositionMap = new Map(); // Maps chunk index to current slide position

  /**
   * Start reading the article
   */
  async function startReading(options) {
    settings = Object.assign(settings, options);
    generationAborted = false;

    try {
      var article;
      var blocks;

      // Check for Twitter/X thread first
      if (typeof TwitterParser !== 'undefined' && TwitterParser.isTwitterThread()) {
        var thread = TwitterParser.extractThread();
        if (!thread) {
          alert('Could not extract thread. Make sure you are on a tweet/thread page.');
          return;
        }
        article = {
          title: thread.title,
          excerpt: thread.author + ' - ' + thread.tweetCount + ' tweets'
        };
        blocks = thread.blocks;
      } else {
        // Extract article using Readability
        article = Reader.extractArticle();
        if (!article) {
          alert('Could not extract article content from this page.');
          return;
        }
        blocks = Reader.parseContent(article.content);
      }

      // Chunk content
      chunks = Reader.chunkContent(blocks, settings.chunkSize);

      if (chunks.length === 0) {
        alert('No content found to display.');
        return;
      }

      // Calculate word counts per chunk for stats
      chunkWordCounts = chunks.map(function(chunk) {
        return chunk.text ? chunk.text.split(/\s+/).filter(Boolean).length : 0;
      });
      var totalWords = chunkWordCounts.reduce(function(sum, count) {
        return sum + count;
      }, 0);

      // Prepare slides with key term highlighting
      var slides = chunks.map(function(chunk, index) {
        var html = Reader.renderChunk(chunk);

        // Mark key terms if KeyTerms module is available
        if (typeof KeyTerms !== 'undefined') {
          html = KeyTerms.markTermsInHtml(html);
        }

        return {
          type: 'content',
          html: html,
          text: chunk.text,
          index: index
        };
      });

      // Add title slide at the beginning
      slides.unshift({
        type: 'content',
        html: `
          <div class="readable-title-slide">
            <h1 class="readable-article-title">${escapeHtml(article.title)}</h1>
            ${article.excerpt ? `<p class="readable-article-excerpt">${escapeHtml(article.excerpt)}</p>` : ''}
            <div class="readable-article-meta">
              <span>${chunks.length} sections</span>
              ${settings.apiKey ? `<span>Quiz every ${settings.questionInterval} sections</span>` : ''}
            </div>
            <div class="readable-start-hint">Swipe up to start reading</div>
          </div>
        `,
        text: article.title,
        index: -1
      });

      // Initialize swiper
      Swiper.init({
        onSlideChange: handleSlideChange,
        onClose: handleClose
      });

      // Set initial slides
      Swiper.setSlides(slides);

      // Configure and initialize key terms (for AI definitions on hover)
      if (typeof KeyTerms !== 'undefined') {
        KeyTerms.configure({
          apiKey: settings.apiKey,
          provider: settings.aiProvider
        });
        // Initialize hover listeners after a short delay to ensure DOM is ready
        setTimeout(function() {
          var container = document.querySelector('.readable-overlay');
          if (container) {
            KeyTerms.initializeListeners(container);
          }
        }, 100);
      }

      // Start stats tracking session
      if (typeof ReadingStats !== 'undefined') {
        ReadingStats.startSession(article.title, window.location.href, chunks.length, totalWords);
      }

      // Initialize flashcard export with article title
      if (typeof FlashcardExport !== 'undefined') {
        FlashcardExport.clear();
        FlashcardExport.setArticleTitle(article.title);
      }

      // Set up quiz if API key provided
      if (settings.apiKey) {
        Quiz.setApiKey(settings.apiKey);
        Quiz.setProvider(settings.aiProvider);
        Quiz.resetStats();

        // Calculate quiz positions and prepare generation queue
        // Use chunk index as stable key (doesn't change when slides are inserted)
        quizGenerationQueue = [];
        chunkToPositionMap.clear();

        for (var i = settings.questionInterval; i < chunks.length; i += settings.questionInterval + 1) {
          var slideIndex = i + 1; // Account for title slide
          quizPositions.add(slideIndex);
          chunkToPositionMap.set(i, slideIndex); // Track: chunk index -> current slide position

          // Collect context for this quiz position
          var contextChunks = [];
          var startIdx = Math.max(0, i - settings.questionInterval);
          for (var j = startIdx; j <= i && j < chunks.length; j++) {
            contextChunks.push(chunks[j].text);
          }

          quizGenerationQueue.push({
            chunkIndex: i, // Stable identifier
            context: contextChunks.join(' ')
          });
        }

        // Start background generation
        startBackgroundGeneration();
      }

    } catch (error) {
      console.error('Readable error:', error);
      alert('Error: ' + error.message);
    }
  }

  /**
   * Start generating quizzes in the background
   */
  async function startBackgroundGeneration() {
    if (isGenerating || quizGenerationQueue.length === 0) {
      return;
    }

    isGenerating = true;
    console.log('Starting background quiz generation for', quizGenerationQueue.length, 'quizzes');

    while (quizGenerationQueue.length > 0 && !generationAborted) {
      var item = quizGenerationQueue.shift();

      try {
        console.log('Pre-generating quiz for chunk', item.chunkIndex);
        var quiz = await Quiz.generateQuestion(item.context);
        preGeneratedQuizzes.set(item.chunkIndex, { quiz: quiz, error: null });
        console.log('Quiz pre-generated for chunk', item.chunkIndex);
      } catch (error) {
        console.error('Failed to pre-generate quiz for chunk', item.chunkIndex, error);
        preGeneratedQuizzes.set(item.chunkIndex, { quiz: null, error: error.message });
      }

      // Wait before next generation to avoid rate limits
      if (quizGenerationQueue.length > 0 && !generationAborted) {
        await sleep(GENERATION_DELAY);
      }
    }

    isGenerating = false;
    console.log('Background quiz generation complete');
  }

  /**
   * Sleep helper
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle slide change
   */
  async function handleSlideChange(index, slide) {
    // Track reading progress for stats (content slides only, index > 0 skips title)
    if (typeof ReadingStats !== 'undefined' && slide && slide.type === 'content' && slide.index >= 0) {
      var chunkIdx = slide.index;
      ReadingStats.updateChunkProgress(chunkIdx, chunkWordCounts[chunkIdx] || 0);
    }

    // Check if we should insert a quiz after this slide
    if (Quiz.isEnabled() && quizPositions.has(index)) {
      quizPositions.delete(index);

      // Find which chunk index this position corresponds to
      var chunkIndex = null;
      chunkToPositionMap.forEach(function(pos, chunk) {
        if (pos === index) {
          chunkIndex = chunk;
        }
      });

      if (chunkIndex !== null) {
        insertQuizAtPosition(index + 1, chunkIndex);
      }
    }
  }

  /**
   * Insert quiz at position (using pre-generated if available)
   */
  async function insertQuizAtPosition(insertIndex, chunkIndex) {
    // Check if we have a pre-generated quiz (keyed by stable chunk index)
    var preGenerated = preGeneratedQuizzes.get(chunkIndex);

    if (preGenerated) {
      // Use pre-generated quiz
      preGeneratedQuizzes.delete(chunkIndex);

      if (preGenerated.quiz) {
        // Insert the ready quiz
        var quizHtml = Quiz.createQuizCard(preGenerated.quiz, insertIndex);
        var quizSlide = {
          type: 'quiz',
          html: quizHtml,
          quiz: preGenerated.quiz
        };

        Swiper.addSlide(quizSlide, insertIndex);
        shiftQuizPositions(insertIndex);

        // Bind events
        setTimeout(function() {
          var quizContainer = document.querySelector(`.readable-quiz[data-quiz-index="${insertIndex}"]`);
          if (quizContainer) {
            Quiz.bindQuizEvents(quizContainer.parentElement, preGenerated.quiz);
          }
        }, 100);
      } else {
        // Pre-generation failed, show error
        var errorHtml = Quiz.createLoadingCard(insertIndex);
        var errorSlide = { type: 'quiz', html: errorHtml };
        Swiper.addSlide(errorSlide, insertIndex);
        shiftQuizPositions(insertIndex);
        Quiz.showLoadingError(insertIndex, preGenerated.error);
      }
    } else {
      // Not pre-generated yet, show loading and wait
      var loadingHtml = Quiz.createLoadingCard(insertIndex);
      var loadingSlide = { type: 'quiz', html: loadingHtml, loading: true };

      Swiper.addSlide(loadingSlide, insertIndex);
      shiftQuizPositions(insertIndex);

      // Find and remove from queue if still there (by chunk index)
      var queueIndex = quizGenerationQueue.findIndex(q => q.chunkIndex === chunkIndex);
      var contextText = '';
      if (queueIndex !== -1) {
        contextText = quizGenerationQueue[queueIndex].context;
        quizGenerationQueue.splice(queueIndex, 1);
      } else {
        // Rebuild context from chunk
        var contextChunks = [];
        var startIdx = Math.max(0, chunkIndex - settings.questionInterval);
        for (var i = startIdx; i <= chunkIndex && i < chunks.length; i++) {
          contextChunks.push(chunks[i].text);
        }
        contextText = contextChunks.join(' ');
      }

      // Generate now
      try {
        var quiz = await Quiz.generateQuestion(contextText);
        Quiz.updateLoadingCard(insertIndex, quiz);

        setTimeout(function() {
          var quizContainer = document.querySelector(`.readable-quiz[data-quiz-index="${insertIndex}"]`);
          if (quizContainer) {
            Quiz.bindQuizEvents(quizContainer.parentElement, quiz);
          }
        }, 100);
      } catch (error) {
        Quiz.showLoadingError(insertIndex, error.message);
      }
    }
  }

  /**
   * Shift quiz positions after insertion
   */
  function shiftQuizPositions(insertIndex) {
    // Update quizPositions set
    var newPositions = new Set();
    quizPositions.forEach(function(pos) {
      if (pos >= insertIndex) {
        newPositions.add(pos + 1);
      } else {
        newPositions.add(pos);
      }
    });
    quizPositions = newPositions;

    // Update chunkToPositionMap (chunk index stays same, position shifts)
    chunkToPositionMap.forEach(function(pos, chunkIdx) {
      if (pos >= insertIndex) {
        chunkToPositionMap.set(chunkIdx, pos + 1);
      }
    });
  }

  /**
   * Handle close
   */
  function handleClose() {
    // End stats session and persist
    if (typeof ReadingStats !== 'undefined') {
      ReadingStats.endSession();
    }

    window.__readableInitialized = false;
    generationAborted = true;
    chunks = [];
    chunkWordCounts = [];
    quizPositions.clear();
    preGeneratedQuizzes.clear();
    chunkToPositionMap.clear();
    quizGenerationQueue = [];
    isGenerating = false;

    // Clear flashcard export
    if (typeof FlashcardExport !== 'undefined') {
      FlashcardExport.clear();
    }

    // Clear key terms cache
    if (typeof KeyTerms !== 'undefined') {
      KeyTerms.clearCache();
      KeyTerms.hideTooltip();
    }
  }

  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'startReading') {
      startReading(request.settings);
      sendResponse({ success: true });
    }
    return true;
  });
})();
