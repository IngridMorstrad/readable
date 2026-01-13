/**
 * FlashcardExport - Export quiz questions to Anki format
 */

var FlashcardExport = (function() {
  var flashcards = [];
  var articleTitle = '';

  /**
   * Set the article title for export metadata
   */
  function setArticleTitle(title) {
    articleTitle = title || 'Readable Article';
  }

  /**
   * Add a flashcard from quiz data
   */
  function addFlashcard(quiz) {
    if (!quiz || !quiz.question || !quiz.options || !quiz.correct) {
      return;
    }

    // Find correct answer text
    var correctIndex = quiz.correct.charCodeAt(0) - 65;
    var correctAnswer = quiz.options[correctIndex] || '';
    // Strip letter prefix from answer
    correctAnswer = correctAnswer.replace(/^[A-D]\.\s*/, '');

    flashcards.push({
      type: 'quiz',
      question: quiz.question,
      answer: correctAnswer,
      explanation: quiz.explanation || '',
      options: quiz.options.slice()
    });
  }

  /**
   * Add a term/definition flashcard (from key terms)
   */
  function addTermCard(term, definition) {
    if (!term || !definition) return;
    flashcards.push({
      type: 'term',
      question: term,
      answer: definition
    });
  }

  /**
   * Get count of collected flashcards
   */
  function getCount() {
    return flashcards.length;
  }

  /**
   * Clear all flashcards
   */
  function clear() {
    flashcards = [];
    articleTitle = '';
  }

  /**
   * Export to Anki text format (tab-separated)
   * Format: front<TAB>back
   * Anki imports this directly
   */
  function exportToAnkiText() {
    if (flashcards.length === 0) {
      return null;
    }

    var lines = flashcards.map(function(card) {
      var front = card.question;
      var back = card.answer;
      if (card.explanation) {
        back += '\n\n' + card.explanation;
      }
      // Escape tabs and newlines for TSV format
      front = front.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      back = back.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      return front + '\t' + back;
    });

    return lines.join('\n');
  }

  /**
   * Export to Anki with multiple choice context
   * Format includes all options for richer cards
   */
  function exportToAnkiRich() {
    if (flashcards.length === 0) {
      return null;
    }

    var lines = flashcards.map(function(card) {
      var front, back;
      if (card.type === 'term') {
        // Term card: simple term → definition
        front = '<b>' + card.question + '</b>';
        back = card.answer;
      } else {
        // Quiz card: question with options
        front = card.question + '<br><br>' + (card.options || []).join('<br>');
        back = '<b>' + card.answer + '</b>';
        if (card.explanation) {
          back += '<br><br><i>' + card.explanation + '</i>';
        }
      }
      front = front.replace(/\t/g, ' ');
      back = back.replace(/\t/g, ' ');
      return front + '\t' + back;
    });

    return lines.join('\n');
  }

  /**
   * Trigger download of exported flashcards
   */
  function downloadExport(format) {
    format = format || 'basic';
    var content = format === 'rich' ? exportToAnkiRich() : exportToAnkiText();

    if (!content) {
      alert('No flashcards to export. Answer some quiz questions first!');
      return false;
    }

    // Create filename from article title
    var filename = articleTitle
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50) || 'flashcards';
    filename += '_anki.txt';

    // Create blob and download
    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(function() {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    return true;
  }

  /**
   * Get all flashcards data
   */
  function getFlashcards() {
    return flashcards.slice();
  }

  // Public API
  return {
    setArticleTitle: setArticleTitle,
    addFlashcard: addFlashcard,
    addTermCard: addTermCard,
    getCount: getCount,
    clear: clear,
    exportToAnkiText: exportToAnkiText,
    exportToAnkiRich: exportToAnkiRich,
    downloadExport: downloadExport,
    getFlashcards: getFlashcards
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.FlashcardExport = FlashcardExport;
}
