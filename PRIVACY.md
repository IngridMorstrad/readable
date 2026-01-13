# Privacy Policy

**Readable - Swipeable Article Reader**

Last updated: January 2026

## Overview

Readable is a browser extension that converts articles into a swipeable reading interface with optional AI-powered features. This policy explains what data the extension handles and how.

## Data We Collect

### Stored Locally on Your Device

The following data is stored in your browser's local storage (`chrome.storage.local`) and **never transmitted to us**:

- **Reading Statistics**: Articles read (titles and URLs), word counts, reading streaks, quiz scores
- **Preferences**: Chunk size settings, quiz interval, selected AI provider
- **API Keys**: Your personally-provided API keys for AI services (encrypted by browser)
- **Read Later Queue**: Articles you save for later reading

### Processed Temporarily

- **Article Content**: When you activate the reader, article text is processed locally to create the swipeable interface. This content is not stored permanently.

## Data Sent to Third Parties

When you configure an API key and use AI features, the following data is sent to your chosen AI provider:

| Feature | Data Sent | Destination |
|---------|-----------|-------------|
| Quiz Generation | Article text chunks | Google (Gemini), OpenAI, or Anthropic |
| Key Term Definitions | Individual terms | Google (Gemini), OpenAI, or Anthropic |
| Text Explanations | Selected text passages | Google (Gemini), OpenAI, or Anthropic |

**Important:**
- These transfers only occur when you explicitly trigger them (clicking buttons, hovering terms)
- You provide your own API key—we never see or store your API credentials on our servers
- Data is sent directly from your browser to the AI provider using your API key
- We do not receive, store, or have access to any content sent to AI providers

## Data We Do NOT Collect

- Personal information (name, email, address)
- Browsing history beyond articles you read with this extension
- Financial information
- Location data
- Analytics or tracking data

## Data Sharing

We do not:
- Sell your data
- Share your data with third parties for advertising
- Collect data on our servers
- Use analytics services

The only third-party data sharing is the AI API calls described above, which you control entirely.

## Data Retention

- Local data persists until you clear browser storage or uninstall the extension
- You can clear reading statistics anytime via the extension
- AI providers handle data according to their own privacy policies:
  - [Google AI Privacy](https://ai.google.dev/terms)
  - [OpenAI Privacy](https://openai.com/privacy)
  - [Anthropic Privacy](https://www.anthropic.com/privacy)

## Your Rights

You can:
- View all stored data via browser developer tools
- Clear all data by removing the extension
- Use the extension without AI features (no external data transfer)
- Choose which AI provider to use

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `activeTab` | To read and transform the current article |
| `storage` | To save your preferences and reading stats locally |
| `scripting` | To inject the reader interface into web pages |

## Changes to This Policy

We may update this policy occasionally. Significant changes will be noted in extension update notes.

## Contact

For questions about this privacy policy, please open an issue at: [GitHub Repository URL]

---

*This extension does not collect personal data for advertising or marketing purposes. All data handling is for core functionality only.*
