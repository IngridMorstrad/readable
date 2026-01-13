/**
 * TwitterParser - Extract threads from Twitter/X pages
 */

var TwitterParser = (function() {
  /**
   * Check if current page is a Twitter/X thread
   */
  function isTwitterThread() {
    var host = window.location.hostname;
    var path = window.location.pathname;

    // Must be on twitter.com or x.com
    if (host !== 'twitter.com' && host !== 'x.com' &&
        !host.endsWith('.twitter.com') && !host.endsWith('.x.com')) {
      return false;
    }

    // Must be on a status page (e.g., /user/status/123)
    return /\/status\/\d+/.test(path);
  }

  /**
   * Get the thread author's screen name from URL
   */
  function getThreadAuthor() {
    var match = window.location.pathname.match(/^\/([^/]+)\/status/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Extract tweet content from a tweet element
   */
  function extractTweet(tweetEl) {
    var result = {
      text: '',
      html: '',
      images: [],
      author: '',
      isQuote: false
    };

    // Get author
    var userNameEl = tweetEl.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      var handleEl = userNameEl.querySelector('a[href^="/"]');
      if (handleEl) {
        var href = handleEl.getAttribute('href');
        result.author = href ? href.replace('/', '').toLowerCase() : '';
      }
    }

    // Get tweet text
    var tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
    if (tweetTextEl) {
      result.text = tweetTextEl.textContent.trim();
      result.html = extractTweetHtml(tweetTextEl);
    }

    // Get images
    var photoEls = tweetEl.querySelectorAll('[data-testid="tweetPhoto"] img');
    photoEls.forEach(function(img) {
      var src = img.src;
      if (src && !src.includes('profile_images')) {
        // Get highest quality version
        src = src.replace(/&name=\w+/, '&name=large');
        result.images.push({
          src: src,
          alt: img.alt || ''
        });
      }
    });

    // Check if this is a quote tweet container
    var quoteEl = tweetEl.querySelector('[data-testid="tweet"] [data-testid="tweet"]');
    if (quoteEl) {
      result.isQuote = true;
    }

    return result;
  }

  /**
   * Extract tweet HTML preserving links and formatting
   */
  function extractTweetHtml(el) {
    var html = '';

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return escapeHtml(node.textContent);
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      var tag = node.tagName.toLowerCase();

      // Handle links
      if (tag === 'a') {
        var href = node.getAttribute('href') || '';
        var linkText = node.textContent;

        // Handle t.co links - use the displayed text
        if (href.includes('t.co')) {
          // Try to get the real URL from title or displayed text
          var title = node.getAttribute('title') || linkText;
          if (title.startsWith('http')) {
            href = title;
          }
        }

        return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">' +
               escapeHtml(linkText) + '</a>';
      }

      // Handle line breaks
      if (tag === 'br') {
        return '<br>';
      }

      // Handle spans (usually contain text or emoji)
      if (tag === 'span' || tag === 'div') {
        var childHtml = '';
        for (var i = 0; i < node.childNodes.length; i++) {
          childHtml += processNode(node.childNodes[i]);
        }
        return childHtml;
      }

      // Handle emoji images
      if (tag === 'img' && node.alt) {
        return node.alt; // Return emoji character
      }

      // Process children for other elements
      var childHtml = '';
      for (var i = 0; i < node.childNodes.length; i++) {
        childHtml += processNode(node.childNodes[i]);
      }
      return childHtml;
    }

    for (var i = 0; i < el.childNodes.length; i++) {
      html += processNode(el.childNodes[i]);
    }

    return html;
  }

  /**
   * Extract thread from the page
   */
  function extractThread() {
    var threadAuthor = getThreadAuthor();
    if (!threadAuthor) {
      return null;
    }

    // Find all tweets on the page
    var tweetEls = document.querySelectorAll('[data-testid="tweet"]');
    if (tweetEls.length === 0) {
      return null;
    }

    var tweets = [];
    var seenTexts = new Set(); // Dedupe

    tweetEls.forEach(function(tweetEl) {
      // Skip quote tweet containers (we'll handle the main tweet)
      if (tweetEl.closest('[data-testid="tweet"] [data-testid="tweet"]')) {
        return;
      }

      var tweet = extractTweet(tweetEl);

      // Only include tweets from thread author
      if (tweet.author !== threadAuthor) {
        return;
      }

      // Skip empty tweets
      if (!tweet.text && tweet.images.length === 0) {
        return;
      }

      // Skip duplicates
      if (tweet.text && seenTexts.has(tweet.text)) {
        return;
      }

      if (tweet.text) {
        seenTexts.add(tweet.text);
      }

      tweets.push(tweet);
    });

    if (tweets.length === 0) {
      return null;
    }

    // Build article structure
    var title = '@' + threadAuthor + ' thread';
    var firstTweet = tweets[0].text;
    if (firstTweet.length > 100) {
      title = firstTweet.substring(0, 100) + '...';
    } else if (firstTweet.length > 0) {
      title = firstTweet;
    }

    // Build content blocks
    var blocks = [];

    tweets.forEach(function(tweet, index) {
      // Add tweet text as paragraph
      if (tweet.text) {
        blocks.push({
          type: 'paragraph',
          content: tweet.text,
          html: tweet.html
        });
      }

      // Add images
      tweet.images.forEach(function(img) {
        blocks.push({
          type: 'image',
          src: img.src,
          alt: img.alt
        });
      });
    });

    return {
      title: title,
      content: '', // Not used, we return blocks directly
      blocks: blocks,
      author: '@' + threadAuthor,
      tweetCount: tweets.length
    };
  }

  // Use shared utility
  var escapeHtml = Utils.escapeHtml;

  // Public API
  return {
    isTwitterThread: isTwitterThread,
    extractThread: extractThread
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.TwitterParser = TwitterParser;
}
