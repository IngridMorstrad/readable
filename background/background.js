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
    console.error('Gemini API Error:', errorText);

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Please check your Gemini API key.');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (response.status === 404) {
      throw new Error('Model not found. Try a different Gemini model.');
    } else {
      throw new Error(`Gemini API error: ${response.status}`);
    }
  }

  const data = await response.json();

  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const text = data.candidates[0].content.parts
      .map(part => part.text)
      .join('');
    return { text };
  }

  throw new Error('Unexpected Gemini response format');
}

/**
 * Handle OpenAI API call
 */
async function handleOpenAI(apiKey, prompt) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API Error:', errorText);

    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key.');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (response.status === 404) {
      throw new Error('Model not found. Please check your OpenAI API access.');
    } else {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
  }

  const data = await response.json();

  if (data.choices && data.choices[0] && data.choices[0].message) {
    return { text: data.choices[0].message.content };
  }

  throw new Error('Unexpected OpenAI response format');
}

/**
 * Handle Claude/Anthropic API call
 */
async function handleClaude(apiKey, prompt) {
  const url = 'https://api.anthropic.com/v1/messages';

  const response = await fetch(url, {
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
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API Error:', errorText);

    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Claude API key.');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (response.status === 400) {
      throw new Error('Bad request. Please check your Claude API configuration.');
    } else {
      throw new Error(`Claude API error: ${response.status}`);
    }
  }

  const data = await response.json();

  if (data.content && data.content[0] && data.content[0].text) {
    return { text: data.content[0].text };
  }

  throw new Error('Unexpected Claude response format');
}
