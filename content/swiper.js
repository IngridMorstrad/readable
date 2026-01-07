/**
 * Swiper - Swipeable card interface
 */

var Swiper = (function() {
  var container = null;
  var cardsContainer = null;
  var cards = [];
  var currentIndex = 0;
  var touchStartY = 0;
  var touchStartX = 0;
  var isDragging = false;
  var dragOffset = 0;
  var onSlideChange = null;
  var onClose = null;

  /**
   * Initialize the swiper
   */
  function init(options) {
    options = options || {};
    onSlideChange = options.onSlideChange || function() {};
    onClose = options.onClose || function() {};

    createContainer();
    bindEvents();
  }

  /**
   * Create the main container
   */
  function createContainer() {
    // Create overlay container
    container = document.createElement('div');
    container.className = 'readable-overlay';
    container.innerHTML = `
      <div class="readable-header">
        <div class="readable-progress">
          <span class="readable-current">1</span>
          <span class="readable-separator">/</span>
          <span class="readable-total">1</span>
        </div>
        <button class="readable-close" aria-label="Close">&times;</button>
      </div>
      <div class="readable-cards-wrapper">
        <div class="readable-cards"></div>
      </div>
      <div class="readable-nav-hint">
        <span class="readable-hint-up">Swipe up for next</span>
        <span class="readable-hint-down">Swipe down for previous</span>
      </div>
    `;

    cardsContainer = container.querySelector('.readable-cards');

    // Add close button handler
    container.querySelector('.readable-close').addEventListener('click', close);

    document.body.appendChild(container);
    document.body.style.overflow = 'hidden';
  }

  /**
   * Set the slides
   */
  function setSlides(slides) {
    cards = slides;
    currentIndex = 0;

    // Clear existing cards
    cardsContainer.innerHTML = '';

    // Create card elements
    slides.forEach(function(slide, index) {
      var card = document.createElement('div');
      card.className = 'readable-card';
      card.dataset.index = index;

      if (slide.type === 'quiz') {
        card.classList.add('readable-card-quiz');
        card.innerHTML = slide.html;
      } else {
        card.innerHTML = `
          <div class="readable-card-content">
            ${slide.html}
          </div>
        `;
      }

      cardsContainer.appendChild(card);
    });

    updateProgress();
    goToSlide(0, false);
  }

  /**
   * Add a single slide
   */
  function addSlide(slide, atIndex) {
    var card = document.createElement('div');
    card.className = 'readable-card';
    card.dataset.index = atIndex;

    if (slide.type === 'quiz') {
      card.classList.add('readable-card-quiz');
      card.innerHTML = slide.html;
    } else {
      card.innerHTML = `
        <div class="readable-card-content">
          ${slide.html}
        </div>
      `;
    }

    // Insert at correct position
    if (atIndex >= cardsContainer.children.length) {
      cardsContainer.appendChild(card);
    } else {
      cardsContainer.insertBefore(card, cardsContainer.children[atIndex]);
    }

    // Update all indices
    Array.from(cardsContainer.children).forEach(function(el, i) {
      el.dataset.index = i;
    });

    cards.splice(atIndex, 0, slide);

    // Adjust currentIndex if slide was inserted before current position
    if (atIndex <= currentIndex) {
      currentIndex++;
      // Re-apply transform without animation to stay on same content
      var offset = -currentIndex * 100;
      cardsContainer.style.transition = 'none';
      cardsContainer.style.transform = 'translateY(' + offset + '%)';
    }

    updateProgress();
  }

  /**
   * Update progress indicator
   */
  function updateProgress() {
    container.querySelector('.readable-current').textContent = currentIndex + 1;
    container.querySelector('.readable-total').textContent = cards.length;
  }

  /**
   * Go to a specific slide
   */
  function goToSlide(index, animate) {
    if (index < 0 || index >= cards.length) {
      return;
    }

    var oldIndex = currentIndex;
    currentIndex = index;

    var offset = -index * 100;
    cardsContainer.style.transition = animate !== false ? 'transform 0.3s ease-out' : 'none';
    cardsContainer.style.transform = 'translateY(' + offset + '%)';

    // Update active states
    Array.from(cardsContainer.children).forEach(function(card, i) {
      card.classList.toggle('readable-card-active', i === index);
      card.classList.toggle('readable-card-prev', i < index);
      card.classList.toggle('readable-card-next', i > index);
    });

    updateProgress();

    if (animate !== false && oldIndex !== currentIndex) {
      onSlideChange(currentIndex, cards[currentIndex]);
    }
  }

  /**
   * Go to next slide
   */
  function next() {
    if (currentIndex < cards.length - 1) {
      goToSlide(currentIndex + 1);
    }
  }

  /**
   * Go to previous slide
   */
  function prev() {
    if (currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    // Touch events
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Mouse events for desktop dragging
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);

    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);

    // Wheel events
    container.addEventListener('wheel', handleWheel, { passive: false });
  }

  /**
   * Unbind event listeners
   */
  function unbindEvents() {
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchmove', handleTouchMove);
    container.removeEventListener('touchend', handleTouchEnd);
    container.removeEventListener('mousedown', handleMouseDown);
    container.removeEventListener('mousemove', handleMouseMove);
    container.removeEventListener('mouseup', handleMouseUp);
    container.removeEventListener('mouseleave', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
    container.removeEventListener('wheel', handleWheel);
  }

  /**
   * Handle touch start
   */
  function handleTouchStart(e) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    isDragging = true;
    dragOffset = 0;
    cardsContainer.style.transition = 'none';
  }

  /**
   * Handle touch move
   */
  function handleTouchMove(e) {
    if (!isDragging) return;

    var deltaY = e.touches[0].clientY - touchStartY;
    var deltaX = e.touches[0].clientX - touchStartX;

    // Only handle vertical swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return;
    }

    e.preventDefault();

    // Add resistance at boundaries
    if ((currentIndex === 0 && deltaY > 0) ||
        (currentIndex === cards.length - 1 && deltaY < 0)) {
      deltaY = deltaY * 0.3;
    }

    dragOffset = deltaY;
    var baseOffset = -currentIndex * 100;
    var dragPercent = (deltaY / window.innerHeight) * 100;
    cardsContainer.style.transform = 'translateY(' + (baseOffset + dragPercent) + '%)';
  }

  /**
   * Handle touch end
   */
  function handleTouchEnd() {
    if (!isDragging) return;

    isDragging = false;
    var threshold = window.innerHeight * 0.15;

    if (dragOffset < -threshold && currentIndex < cards.length - 1) {
      next();
    } else if (dragOffset > threshold && currentIndex > 0) {
      prev();
    } else {
      goToSlide(currentIndex);
    }

    dragOffset = 0;
  }

  /**
   * Handle mouse down
   */
  function handleMouseDown(e) {
    if (e.target.closest('button, input, a, .readable-close')) {
      return;
    }
    touchStartY = e.clientY;
    touchStartX = e.clientX;
    isDragging = true;
    dragOffset = 0;
    cardsContainer.style.transition = 'none';
    e.preventDefault();
  }

  /**
   * Handle mouse move
   */
  function handleMouseMove(e) {
    if (!isDragging) return;

    var deltaY = e.clientY - touchStartY;
    var deltaX = e.clientX - touchStartX;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return;
    }

    if ((currentIndex === 0 && deltaY > 0) ||
        (currentIndex === cards.length - 1 && deltaY < 0)) {
      deltaY = deltaY * 0.3;
    }

    dragOffset = deltaY;
    var baseOffset = -currentIndex * 100;
    var dragPercent = (deltaY / window.innerHeight) * 100;
    cardsContainer.style.transform = 'translateY(' + (baseOffset + dragPercent) + '%)';
  }

  /**
   * Handle mouse up
   */
  function handleMouseUp() {
    if (!isDragging) return;

    isDragging = false;
    var threshold = window.innerHeight * 0.15;

    if (dragOffset < -threshold && currentIndex < cards.length - 1) {
      next();
    } else if (dragOffset > threshold && currentIndex > 0) {
      prev();
    } else {
      goToSlide(currentIndex);
    }

    dragOffset = 0;
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeyDown(e) {
    if (!container || !document.body.contains(container)) {
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        prev();
        break;
      case 'ArrowDown':
      case 'j':
      case ' ':
        e.preventDefault();
        next();
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(0);
        break;
      case 'End':
        e.preventDefault();
        goToSlide(cards.length - 1);
        break;
    }
  }

  /**
   * Handle wheel scroll
   */
  var wheelTimeout = null;
  var wheelDeltaAccum = 0;
  var WHEEL_THRESHOLD = 50; // Minimum accumulated delta to trigger

  function handleWheel(e) {
    e.preventDefault();

    // If in cooldown, ignore
    if (wheelTimeout) return;

    // Accumulate delta for trackpad inertia handling
    wheelDeltaAccum += e.deltaY;

    // Only trigger if accumulated enough scroll
    if (Math.abs(wheelDeltaAccum) < WHEEL_THRESHOLD) {
      return;
    }

    // Trigger navigation
    if (wheelDeltaAccum > 0) {
      next();
    } else {
      prev();
    }

    // Reset accumulator and start cooldown
    wheelDeltaAccum = 0;
    wheelTimeout = setTimeout(function() {
      wheelTimeout = null;
      wheelDeltaAccum = 0;
    }, 400);
  }

  /**
   * Close the swiper
   */
  function close() {
    unbindEvents();
    document.body.style.overflow = '';

    if (container && container.parentNode) {
      container.classList.add('readable-closing');
      setTimeout(function() {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        container = null;
        cardsContainer = null;
        cards = [];
        currentIndex = 0;
        onClose();
      }, 300);
    }
  }

  /**
   * Get current index
   */
  function getCurrentIndex() {
    return currentIndex;
  }

  /**
   * Get total count
   */
  function getTotal() {
    return cards.length;
  }

  // Public API
  return {
    init: init,
    setSlides: setSlides,
    addSlide: addSlide,
    goToSlide: goToSlide,
    next: next,
    prev: prev,
    close: close,
    getCurrentIndex: getCurrentIndex,
    getTotal: getTotal
  };
})();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.Swiper = Swiper;
}
