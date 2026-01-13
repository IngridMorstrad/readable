/**
 * Background Service Worker
 * Handles API calls to avoid CORS issues in content scripts
 * Supports multiple AI providers: Gemini, OpenAI, Claude
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
 * Handle API error responses consistently across providers
 */
async function handleApiError(response, provider) {
  const errorText = await response.text();
  console.error(`${provider} API Error:`, errorText);

  const status = response.status;
  if (status === 401 || status === 403) {
    throw new Error(`Invalid API key. Please check your ${provider} API key.`);
  } else if (status === 429) {
    throw new Error('Rate limit exceeded. Please try again later.');
  } else if (status === 404) {
    throw new Error(`Model not found. Try a different ${provider} model.`);
  } else if (status === 400) {
    throw new Error(`Bad request. Please check your ${provider} API configuration.`);
  } else {
    throw new Error(`${provider} API error: ${status}`);
  }
}

/**
 * Handle quiz generation API call with multiple provider support
 */
async function handleGenerateQuiz(request) {
  const { apiKey, prompt, provider = 'gemini' } = request;

  if (!apiKey) {
    throw new Error('API key is required');
  }

  switch (provider) {
    case 'openai':
      return handleOpenAI(apiKey, prompt);
    case 'claude':
      return handleClaude(apiKey, prompt);
    case 'gemini':
    default:
      return handleGemini(apiKey, prompt);
  }
}

/**
 * Handle Gemini API call
 */
async function handleGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
    })
  });

  if (!response.ok) await handleApiError(response, 'Gemini');

  const data = await response.json();
  if (data.candidates?.[0]?.content) {
    return { text: data.candidates[0].content.parts.map(p => p.text).join('') };
  }
  throw new Error('Unexpected Gemini response format');
}

/**
 * Handle OpenAI API call
 */
async function handleOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) await handleApiError(response, 'OpenAI');

  const data = await response.json();
  if (data.choices?.[0]?.message) {
    return { text: data.choices[0].message.content };
  }
  throw new Error('Unexpected OpenAI response format');
}

/**
 * Handle Claude/Anthropic API call
 */
async function handleClaude(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) await handleApiError(response, 'Claude');

  const data = await response.json();
  if (data.content?.[0]?.text) {
    return { text: data.content[0].text };
  }
  throw new Error('Unexpected Claude response format');
}
