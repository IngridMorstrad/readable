/**
 * ReadLater - Queue management for saved articles
 */

const ReadLater = (function() {
  const STORAGE_KEY = 'readable_queue';
  const MAX_ITEMS = 50;

  /**
   * Load queue from storage
   */
  async function loadQueue() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || [];
  }

  /**
   * Save queue to storage
   */
  async function saveQueue(queue) {
    await chrome.storage.local.set({ [STORAGE_KEY]: queue });
  }

  /**
   * Add article to queue
   */
  async function addArticle(article) {
    const queue = await loadQueue();

    // Check if already in queue
    const exists = queue.some(item => item.url === article.url);
    if (exists) {
      return { success: false, message: 'Already in queue' };
    }

    // Add to front of queue
    queue.unshift({
      url: article.url,
      title: article.title || 'Untitled',
      favicon: article.favicon || '',
      addedAt: new Date().toISOString()
    });

    // Limit queue size
    if (queue.length > MAX_ITEMS) {
      queue.pop();
    }

    await saveQueue(queue);
    return { success: true, count: queue.length };
  }

  /**
   * Remove article from queue
   */
  async function removeArticle(url) {
    const queue = await loadQueue();
    const filtered = queue.filter(item => item.url !== url);
    await saveQueue(filtered);
    return filtered.length;
  }

  /**
   * Get queue count
   */
  async function getCount() {
    const queue = await loadQueue();
    return queue.length;
  }

  /**
   * Get all items
   */
  async function getAll() {
    return loadQueue();
  }

  /**
   * Clear entire queue
   */
  async function clear() {
    await saveQueue([]);
  }

  /**
   * Get next article (first in queue)
   */
  async function getNext() {
    const queue = await loadQueue();
    return queue[0] || null;
  }

  /**
   * Pop next article (remove and return)
   */
  async function popNext() {
    const queue = await loadQueue();
    if (queue.length === 0) return null;

    const next = queue.shift();
    await saveQueue(queue);
    return next;
  }

  return {
    addArticle,
    removeArticle,
    getCount,
    getAll,
    clear,
    getNext,
    popNext
  };
})();
