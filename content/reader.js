/**
 * Reader - Article extraction and chunking
 */

var Reader = (function() {
  /**
   * Check if a node is a math/KaTeX block
   */
  function isMathBlock(node) {
    if (!node || !node.classList) return false;

    // Check for common math/KaTeX indicators
    var mathClasses = ['katex', 'katex-display', 'katex-html', 'MathJax', 'MathJax_Display', 'mjx-container'];
    var hasMathClass = mathClasses.some(function(cls) {
      return node.classList.contains(cls);
    });
    if (hasMathClass) return true;

    // Check for math-related attributes
    if (node.hasAttribute('data-testid') && node.getAttribute('data-testid').includes('katex')) {
      return true;
    }

    // Check for specific math wrapper classes (be precise, not greedy)
    if (node.className && typeof node.className === 'string') {
      // Only match specific math wrapper patterns, not generic containers
      if (node.className.match(/\breport-math-block\b/) ||
          node.className.match(/\bmath-display\b/) ||
          node.className.match(/\bequation-block\b/)) {
        return true;
      }
    }

    // Check for MathML element directly
    if (node.tagName === 'MATH') {
      return true;
    }

    // Only treat as math block if it's a DIRECT wrapper (small element with katex child)
    // Don't match large containers that happen to contain math somewhere
    if (node.children && node.children.length <= 3) {
      var firstChild = node.children[0];
      if (firstChild && firstChild.classList &&
          (firstChild.classList.contains('katex') ||
           firstChild.classList.contains('katex-display') ||
           firstChild.classList.contains('MathJax'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract article content from the page
   */
  function extractArticle() {
    var reader = new Readability(document);
    var article = reader.parse();

    if (!article) {
      throw new Error('Could not extract article content from this page');
    }

    return article;
  }

  /**
   * Parse HTML content into text nodes while preserving structure
   */
  function parseContent(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;

    var blocks = [];
    var blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'DIV'];

    function processNode(node, depth) {
      if (node.nodeType === Node.TEXT_NODE) {
        var text = node.textContent.trim();
        if (text) {
          return [{ type: 'text', content: text }];
        }
        return [];
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return [];
      }

      var tagName = node.tagName;
      var results = [];

      // Handle math/KaTeX blocks - preserve raw HTML
      if (isMathBlock(node)) {
        var mathHtml = node.outerHTML;
        var mathText = node.textContent.trim();
        if (mathHtml) {
          results.push({
            type: 'math',
            html: mathHtml,
            content: mathText // For word counting and quiz context
          });
        }
        return results;
      }

      // Handle headings
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
        var headingText = node.textContent.trim();
        if (headingText) {
          results.push({
            type: 'heading',
            level: parseInt(tagName[1]),
            content: headingText
          });
        }
        return results;
      }

      // Handle lists
      if (tagName === 'UL' || tagName === 'OL') {
        var items = [];
        var listItems = node.querySelectorAll(':scope > li');
        listItems.forEach(function(li) {
          var text = li.textContent.trim();
          if (text) {
            items.push(text);
          }
        });
        if (items.length > 0) {
          results.push({
            type: 'list',
            ordered: tagName === 'OL',
            items: items
          });
        }
        return results;
      }

      // Handle code blocks
      if (tagName === 'PRE' || tagName === 'CODE') {
        var code = node.textContent.trim();
        if (code) {
          results.push({
            type: 'code',
            content: code
          });
        }
        return results;
      }

      // Handle blockquotes
      if (tagName === 'BLOCKQUOTE') {
        var quote = node.textContent.trim();
        if (quote) {
          results.push({
            type: 'quote',
            content: quote
          });
        }
        return results;
      }

      // Handle images
      if (tagName === 'IMG') {
        var src = node.src;
        var alt = node.alt || '';
        if (src) {
          results.push({
            type: 'image',
            src: src,
            alt: alt
          });
        }
        return results;
      }

      // Handle figures with images
      if (tagName === 'FIGURE') {
        var img = node.querySelector('img');
        var caption = node.querySelector('figcaption');
        if (img && img.src) {
          results.push({
            type: 'image',
            src: img.src,
            alt: img.alt || '',
            caption: caption ? caption.textContent.trim() : ''
          });
        }
        return results;
      }

      // Handle paragraphs
      if (tagName === 'P') {
        var text = node.textContent.trim();
        if (text) {
          results.push({
            type: 'paragraph',
            content: text
          });
        }
        return results;
      }

      // Process children for other elements
      for (var i = 0; i < node.childNodes.length; i++) {
        var childResults = processNode(node.childNodes[i], depth + 1);
        results = results.concat(childResults);
      }

      return results;
    }

    return processNode(temp, 0);
  }

  /**
   * Count words in text
   */
  function countWords(text) {
    return text.split(/\s+/).filter(function(word) {
      return word.length > 0;
    }).length;
  }

  /**
   * Chunk content blocks by word count
   */
  function chunkContent(blocks, maxWords) {
    var chunks = [];
    var currentChunk = {
      blocks: [],
      wordCount: 0,
      text: ''
    };

    blocks.forEach(function(block) {
      var blockText = '';
      var blockWords = 0;

      switch (block.type) {
        case 'heading':
          blockText = block.content;
          blockWords = countWords(blockText);
          // Headings always start a new chunk
          if (currentChunk.blocks.length > 0) {
            chunks.push(currentChunk);
            currentChunk = { blocks: [], wordCount: 0, text: '' };
          }
          currentChunk.blocks.push(block);
          currentChunk.wordCount += blockWords;
          currentChunk.text += blockText + ' ';
          break;

        case 'paragraph':
        case 'text':
          blockText = block.content;
          blockWords = countWords(blockText);

          // If this block alone exceeds max, split it
          if (blockWords > maxWords) {
            // Save current chunk if not empty
            if (currentChunk.blocks.length > 0) {
              chunks.push(currentChunk);
              currentChunk = { blocks: [], wordCount: 0, text: '' };
            }

            // Split paragraph into sentences
            var sentences = splitIntoSentences(blockText);
            var sentenceChunk = { blocks: [], wordCount: 0, text: '' };

            sentences.forEach(function(sentence) {
              var sentenceWords = countWords(sentence);

              if (sentenceChunk.wordCount + sentenceWords > maxWords && sentenceChunk.blocks.length > 0) {
                chunks.push(sentenceChunk);
                sentenceChunk = { blocks: [], wordCount: 0, text: '' };
              }

              sentenceChunk.blocks.push({
                type: 'paragraph',
                content: sentence
              });
              sentenceChunk.wordCount += sentenceWords;
              sentenceChunk.text += sentence + ' ';
            });

            if (sentenceChunk.blocks.length > 0) {
              currentChunk = sentenceChunk;
            }
          } else if (currentChunk.wordCount + blockWords > maxWords) {
            // Start new chunk
            chunks.push(currentChunk);
            currentChunk = {
              blocks: [block],
              wordCount: blockWords,
              text: blockText + ' '
            };
          } else {
            // Add to current chunk
            currentChunk.blocks.push(block);
            currentChunk.wordCount += blockWords;
            currentChunk.text += blockText + ' ';
          }
          break;

        case 'list':
          blockText = block.items.join(' ');
          blockWords = countWords(blockText);

          if (currentChunk.wordCount + blockWords > maxWords && currentChunk.blocks.length > 0) {
            chunks.push(currentChunk);
            currentChunk = { blocks: [], wordCount: 0, text: '' };
          }

          currentChunk.blocks.push(block);
          currentChunk.wordCount += blockWords;
          currentChunk.text += blockText + ' ';
          break;

        case 'quote':
        case 'code':
          blockText = block.content;
          blockWords = countWords(blockText);

          if (currentChunk.wordCount + blockWords > maxWords && currentChunk.blocks.length > 0) {
            chunks.push(currentChunk);
            currentChunk = { blocks: [], wordCount: 0, text: '' };
          }

          currentChunk.blocks.push(block);
          currentChunk.wordCount += blockWords;
          currentChunk.text += blockText + ' ';
          break;

        case 'math':
          // Math blocks get their own chunk or attach to current
          blockText = block.content || '';
          blockWords = countWords(blockText);

          // If current chunk is getting large, start a new one
          if (currentChunk.wordCount > maxWords / 2 && currentChunk.blocks.length > 0) {
            chunks.push(currentChunk);
            currentChunk = { blocks: [], wordCount: 0, text: '' };
          }

          currentChunk.blocks.push(block);
          currentChunk.wordCount += blockWords;
          currentChunk.text += blockText + ' ';
          break;

        case 'image':
          // Images get their own chunk or attach to small chunks
          if (currentChunk.wordCount > maxWords / 2) {
            chunks.push(currentChunk);
            currentChunk = { blocks: [block], wordCount: 0, text: '' };
          } else {
            currentChunk.blocks.push(block);
          }
          break;

        default:
          // Unknown block type, treat as text
          if (block.content) {
            blockText = block.content;
            blockWords = countWords(blockText);

            if (currentChunk.wordCount + blockWords > maxWords && currentChunk.blocks.length > 0) {
              chunks.push(currentChunk);
              currentChunk = { blocks: [], wordCount: 0, text: '' };
            }

            currentChunk.blocks.push(block);
            currentChunk.wordCount += blockWords;
            currentChunk.text += blockText + ' ';
          }
      }
    });

    // Don't forget the last chunk
    if (currentChunk.blocks.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Split text into sentences
   */
  function splitIntoSentences(text) {
    // Simple sentence splitting
    var sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(function(s) {
      return s.trim();
    }).filter(function(s) {
      return s.length > 0;
    });
  }

  /**
   * Render a block to HTML
   */
  function renderBlock(block) {
    switch (block.type) {
      case 'math':
        // Render math blocks with preserved HTML (don't escape)
        return '<div class="readable-math">' + block.html + '</div>';

      case 'heading':
        var tag = 'h' + Math.min(block.level, 6);
        return '<' + tag + ' class="readable-heading">' + escapeHtml(block.content) + '</' + tag + '>';

      case 'paragraph':
      case 'text':
        return '<p class="readable-paragraph">' + escapeHtml(block.content) + '</p>';

      case 'list':
        var listTag = block.ordered ? 'ol' : 'ul';
        var items = block.items.map(function(item) {
          return '<li>' + escapeHtml(item) + '</li>';
        }).join('');
        return '<' + listTag + ' class="readable-list">' + items + '</' + listTag + '>';

      case 'quote':
        return '<blockquote class="readable-quote">' + escapeHtml(block.content) + '</blockquote>';

      case 'code':
        return '<pre class="readable-code"><code>' + escapeHtml(block.content) + '</code></pre>';

      case 'image':
        var html = '<figure class="readable-figure">';
        html += '<img src="' + escapeHtml(block.src) + '" alt="' + escapeHtml(block.alt) + '">';
        if (block.caption) {
          html += '<figcaption>' + escapeHtml(block.caption) + '</figcaption>';
        }
        html += '</figure>';
        return html;

      default:
        if (block.content) {
          return '<p class="readable-paragraph">' + escapeHtml(block.content) + '</p>';
        }
        return '';
    }
  }

  /**
   * Render a chunk to HTML
   */
  function renderChunk(chunk) {
    return chunk.blocks.map(renderBlock).join('');
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  return {
    extractArticle: extractArticle,
    parseContent: parseContent,
    chunkContent: chunkContent,
    renderChunk: renderChunk
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.Reader = Reader;
}
