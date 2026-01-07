/**
 * Readability - Simplified article extractor
 * Based on Mozilla's Readability.js
 * https://github.com/mozilla/readability
 */

var Readability = function(doc) {
  this._doc = doc;
  this._articleTitle = '';
  this._articleContent = null;
};

Readability.prototype = {
  _isMathElement: function(el) {
    if (!el) return false;

    // Check if element itself is a math element
    if (el.classList) {
      var mathClasses = ['katex', 'katex-display', 'katex-html', 'katex-mathml', 'math', 'MathJax', 'MathJax_Display', 'mjx-container'];
      for (var i = 0; i < mathClasses.length; i++) {
        if (el.classList.contains(mathClasses[i])) return true;
      }
    }

    if (el.tagName === 'MATH') return true;

    // Check class name string
    if (el.className && typeof el.className === 'string') {
      if (el.className.indexOf('katex') !== -1 ||
          el.className.indexOf('math') !== -1 ||
          el.className.indexOf('MathJax') !== -1) {
        return true;
      }
    }

    // Check if inside a math container
    if (el.closest && (el.closest('.katex') || el.closest('.MathJax') || el.closest('.report-math-block') || el.closest('[data-testid*="katex"]'))) {
      return true;
    }

    return false;
  },

  REGEXPS: {
    unlikelyCandidates: /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-hierarchical-navigation/i,
    okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,
    positive: /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
    negative: /hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget/i,
    byline: /byline|author|dateline|writtenby|p-author/i,
  },

  parse: function() {
    // Clone the document to avoid modifying the original
    var documentClone = this._doc.cloneNode(true);

    // Get article title
    this._articleTitle = this._getArticleTitle(documentClone);

    // Get article content
    this._articleContent = this._grabArticle(documentClone);

    if (!this._articleContent) {
      return null;
    }

    return {
      title: this._articleTitle,
      content: this._articleContent.innerHTML,
      textContent: this._articleContent.textContent,
      excerpt: this._getExcerpt(documentClone)
    };
  },

  _getArticleTitle: function(doc) {
    var curTitle = '';
    var origTitle = '';

    try {
      curTitle = origTitle = doc.title.trim();

      // If there's a h1 that matches the title, use the title
      var h1 = doc.querySelector('h1');
      if (h1) {
        curTitle = h1.textContent.trim();
      }

      // Check for og:title
      var ogTitle = doc.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        curTitle = ogTitle.getAttribute('content').trim();
      }

    } catch (e) {
      curTitle = origTitle;
    }

    return curTitle;
  },

  _getExcerpt: function(doc) {
    var excerpt = '';
    var meta = doc.querySelector('meta[name="description"]') ||
               doc.querySelector('meta[property="og:description"]');
    if (meta) {
      excerpt = meta.getAttribute('content').trim();
    }
    return excerpt;
  },

  _grabArticle: function(doc) {
    var elementsToScore = [];
    var candidates = [];

    // First, try to find article or main elements
    var article = doc.querySelector('article, [role="article"], main, [role="main"]');
    if (article) {
      return this._prepArticle(article.cloneNode(true));
    }

    // Get all paragraphs
    var paragraphs = doc.getElementsByTagName('p');

    // Find the element with the most paragraphs
    var parentCounts = new Map();

    for (var i = 0; i < paragraphs.length; i++) {
      var p = paragraphs[i];
      var parent = p.parentNode;

      if (!parent || parent.tagName === 'HTML' || parent.tagName === 'BODY') {
        continue;
      }

      // Skip unlikely candidates
      var matchString = parent.className + ' ' + parent.id;
      if (this.REGEXPS.unlikelyCandidates.test(matchString) &&
          !this.REGEXPS.okMaybeItsACandidate.test(matchString)) {
        continue;
      }

      var textLength = p.textContent.trim().length;
      if (textLength < 25) {
        continue;
      }

      if (!parentCounts.has(parent)) {
        parentCounts.set(parent, { count: 0, textLength: 0 });
      }

      var data = parentCounts.get(parent);
      data.count++;
      data.textLength += textLength;
    }

    // Find the best candidate
    var bestCandidate = null;
    var bestScore = 0;

    parentCounts.forEach(function(data, element) {
      var score = data.count + (data.textLength / 100);

      // Boost score for positive class/id matches
      var matchString = element.className + ' ' + element.id;
      if (this.REGEXPS.positive.test(matchString)) {
        score *= 1.5;
      }
      if (this.REGEXPS.negative.test(matchString)) {
        score *= 0.5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = element;
      }
    }, this);

    if (bestCandidate) {
      return this._prepArticle(bestCandidate.cloneNode(true));
    }

    // Fallback: get body content
    var body = doc.body;
    if (body) {
      return this._prepArticle(body.cloneNode(true));
    }

    return null;
  },

  _prepArticle: function(articleContent) {
    // Clean up the article
    this._cleanStyles(articleContent);
    this._clean(articleContent, 'script');
    this._clean(articleContent, 'style');
    this._clean(articleContent, 'noscript');
    this._clean(articleContent, 'iframe');
    this._clean(articleContent, 'form');
    this._clean(articleContent, 'button');
    this._clean(articleContent, 'input');
    this._clean(articleContent, 'textarea');
    this._clean(articleContent, 'select');
    this._clean(articleContent, 'nav');
    this._clean(articleContent, 'aside');
    this._clean(articleContent, 'footer');
    this._clean(articleContent, 'header');

    // Remove hidden elements (but preserve math/katex elements which use aria-hidden)
    var hidden = articleContent.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]');
    for (var i = hidden.length - 1; i >= 0; i--) {
      var el = hidden[i];
      // Don't remove if it's part of a math block
      if (!this._isMathElement(el)) {
        el.parentNode.removeChild(el);
      }
    }

    // Remove comments and ads
    var elements = articleContent.querySelectorAll('*');
    for (var i = elements.length - 1; i >= 0; i--) {
      var el = elements[i];
      // Skip math elements
      if (this._isMathElement(el)) {
        continue;
      }
      var matchString = el.className + ' ' + el.id;
      if (this.REGEXPS.unlikelyCandidates.test(matchString) &&
          !this.REGEXPS.okMaybeItsACandidate.test(matchString)) {
        el.parentNode && el.parentNode.removeChild(el);
      }
    }

    return articleContent;
  },

  _cleanStyles: function(el) {
    if (!el || el.tagName === 'svg') {
      return;
    }

    // Preserve styles on math elements (KaTeX relies on inline styles)
    if (this._isMathElement(el)) {
      return;
    }

    // Remove inline styles except for certain elements
    if (el.tagName !== 'TABLE' && el.tagName !== 'THEAD' &&
        el.tagName !== 'TBODY' && el.tagName !== 'TR' &&
        el.tagName !== 'TH' && el.tagName !== 'TD') {
      el.removeAttribute('style');
    }

    var children = el.children;
    for (var i = 0; i < children.length; i++) {
      this._cleanStyles(children[i]);
    }
  },

  _clean: function(el, tag) {
    var elements = el.getElementsByTagName(tag);
    for (var i = elements.length - 1; i >= 0; i--) {
      elements[i].parentNode.removeChild(elements[i]);
    }
  }
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.Readability = Readability;
}
