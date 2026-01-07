/**
 * Background Service Worker
 * Handles API calls to avoid CORS issues in content scripts
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateQuiz') {
    handleGenerateQuiz(request)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open for async response
  }
});

/**
 * Handle quiz generation API call
 */
async function handleGenerateQuiz(request) {
  const { apiKey, prompt } = request;

  if (!apiKey) {
    throw new Error('API key is required');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error:', errorText);

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Please check your Gemini API key.');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (response.status === 404) {
      throw new Error('Model not found. The gemma-3-27b-it model may not be available.');
    } else {
      throw new Error(`API request failed: ${response.status}`);
    }
  }

  const data = await response.json();

  // Extract the text from the response
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const text = data.candidates[0].content.parts
      .map(part => part.text)
      .join('');
    return { text };
  }

  throw new Error('Unexpected API response format');
}
