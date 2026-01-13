/**
 * Stats / ReadingStats - Persistent reading statistics
 * Tracks articles read, words consumed, quiz performance over time
 */

var Stats = (function() {
  var STORAGE_KEY = 'readable_stats';
  var currentSession = null;
  var chunksRead = new Set();

  /**
   * Default stats structure
   */
  function getDefaultStats() {
    return {
      totalArticles: 0,
      totalWords: 0,
      totalQuizzes: 0,
      correctAnswers: 0,
      articlesHistory: [],
      streakDays: 0,
      lastReadDate: null
    };
  }

  /**
   * Load stats from storage
   */
  async function loadStats() {
    return new Promise(function(resolve) {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([STORAGE_KEY], function(result) {
          var stats = result[STORAGE_KEY] || getDefaultStats();
          resolve(stats);
        });
      } else {
        try {
          var stored = localStorage.getItem(STORAGE_KEY);
          resolve(stored ? JSON.parse(stored) : getDefaultStats());
        } catch (e) {
          resolve(getDefaultStats());
        }
      }
    });
  }

  /**
   * Save stats to storage
   */
  async function saveStats(stats) {
    return new Promise(function(resolve) {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        var data = {};
        data[STORAGE_KEY] = stats;
        chrome.storage.local.set(data, resolve);
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
        } catch (e) {
          console.error('Failed to save stats:', e);
        }
        resolve();
      }
    });
  }

  /**
   * Start tracking a new reading session
   */
  function startSession(articleTitle, articleUrl, totalChunks, totalWords) {
    chunksRead.clear();
    currentSession = {
      title: articleTitle || 'Untitled',
      url: articleUrl || '',
      startTime: Date.now(),
      totalChunks: totalChunks || 0,
      totalWords: totalWords || 0,
      wordsRead: 0,
      quizzesTaken: 0,
      correctAnswers: 0
    };
    return currentSession;
  }

  /**
   * Update progress when a chunk is read
   */
  function updateChunkProgress(chunkIndex, wordCount) {
    if (!currentSession) return;
    if (!chunksRead.has(chunkIndex)) {
      chunksRead.add(chunkIndex);
      currentSession.wordsRead += (wordCount || 0);
    }
  }

  /**
   * Record quiz answer
   */
  function recordQuizAnswer(isCorrect) {
    if (!currentSession) return;
    currentSession.quizzesTaken++;
    if (isCorrect) {
      currentSession.correctAnswers++;
    }
  }

  /**
   * Get completion percentage
   */
  function getCompletionPercent() {
    if (!currentSession || !currentSession.totalChunks) return 0;
    return Math.round((chunksRead.size / currentSession.totalChunks) * 100);
  }

  /**
   * End session and persist stats
   */
  async function endSession() {
    if (!currentSession) return null;

    var stats = await loadStats();
    var today = new Date().toDateString();

    // Update streak
    if (stats.lastReadDate) {
      var lastDate = new Date(stats.lastReadDate);
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate.toDateString() === yesterday.toDateString()) {
        stats.streakDays++;
      } else if (lastDate.toDateString() !== today) {
        stats.streakDays = 1;
      }
    } else {
      stats.streakDays = 1;
    }
    stats.lastReadDate = today;

    // Only count if meaningful progress was made (>20%)
    var completionPercent = getCompletionPercent();
    if (completionPercent >= 20) {
      stats.totalArticles++;
      stats.totalWords += currentSession.wordsRead;
      stats.totalQuizzes += currentSession.quizzesTaken;
      stats.correctAnswers += currentSession.correctAnswers;

      // Add to history (keep last 50)
      stats.articlesHistory.unshift({
        title: currentSession.title,
        url: currentSession.url,
        date: new Date().toISOString(),
        words: currentSession.wordsRead,
        quizzesTaken: currentSession.quizzesTaken,
        correctAnswers: currentSession.correctAnswers,
        completed: completionPercent >= 80
      });

      if (stats.articlesHistory.length > 50) {
        stats.articlesHistory = stats.articlesHistory.slice(0, 50);
      }
    }

    await saveStats(stats);

    var session = currentSession;
    currentSession = null;
    chunksRead.clear();
    return session;
  }

  /**
   * Get current session info
   */
  function getCurrentSession() {
    return currentSession;
  }

  /**
   * Get all stats (for display)
   */
  async function getStats() {
    return loadStats();
  }

  /**
   * Get summary for popup display
   */
  async function getSummary() {
    var stats = await loadStats();
    var accuracy = stats.totalQuizzes > 0
      ? Math.round((stats.correctAnswers / stats.totalQuizzes) * 100)
      : 0;

    return {
      articles: stats.totalArticles,
      words: stats.totalWords,
      quizAccuracy: accuracy,
      streak: stats.streakDays,
      recentArticles: stats.articlesHistory.slice(0, 5)
    };
  }

  // Use shared utility
  var formatWordCount = Utils.formatWordCount;

  /**
   * Reset all stats
   */
  async function resetStats() {
    await saveStats(getDefaultStats());
  }

  /**
   * Delete an article from history and recalculate totals
   */
  async function deleteArticle(index) {
    var stats = await loadStats();
    if (index < 0 || index >= stats.articlesHistory.length) return false;

    var article = stats.articlesHistory[index];

    // Subtract this article's contribution from totals
    stats.totalArticles = Math.max(0, stats.totalArticles - 1);
    stats.totalWords = Math.max(0, stats.totalWords - (article.words || 0));
    stats.totalQuizzes = Math.max(0, stats.totalQuizzes - (article.quizzesTaken || 0));
    stats.correctAnswers = Math.max(0, stats.correctAnswers - (article.correctAnswers || 0));

    // Remove from history
    stats.articlesHistory.splice(index, 1);

    await saveStats(stats);
    return true;
  }

  // Public API
  return {
    startSession: startSession,
    updateChunkProgress: updateChunkProgress,
    recordQuizAnswer: recordQuizAnswer,
    endSession: endSession,
    getCurrentSession: getCurrentSession,
    getStats: getStats,
    getSummary: getSummary,
    getCompletionPercent: getCompletionPercent,
    formatWordCount: formatWordCount,
    resetStats: resetStats,
    deleteArticle: deleteArticle
  };
})();

// Export both Stats and ReadingStats for compatibility
if (typeof window !== 'undefined') {
  window.Stats = Stats;
  window.ReadingStats = Stats;
}
