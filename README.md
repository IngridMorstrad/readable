# Readable

Turn any article into a TikTok-style swipeable experience with optional AI-powered comprehension quizzes.

![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Swipeable Interface** — Navigate with swipe gestures, keyboard arrows, or scroll wheel
- **Smart Chunking** — Articles broken into digestible pieces (configurable 50-500 words)
- **AI Quizzes** — Optional MCQ questions test comprehension as you read (requires Gemini API key)
- **Distraction-Free** — Full-screen dark mode removes clutter
- **Works Everywhere** — News sites, blogs, Medium, Substack, and more

## Installation

### Chrome Web Store (Recommended)
[Install from Chrome Web Store](https://chrome.google.com/webstore/detail/readable/cegfoepnghfonapjdmjiigdekdnhnjof)

### Manual Installation
1. Download or clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `readable` folder

## Usage

1. Navigate to any article
2. Click the Readable extension icon
3. Adjust chunk size and quiz interval
4. (Optional) Add your [Gemini API key](https://aistudio.google.com/apikey) for quizzes
5. Click "Start Reading"

### Controls

| Action | Input |
|--------|-------|
| Next | Swipe up, ↓, Space, Scroll down |
| Previous | Swipe down, ↑, Scroll up |
| Close | Escape |

## Configuration

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Chunk Size | 50-500 words | 100 | Size of each swipeable card |
| Quiz Interval | 1-10 chunks | 3 | How often quizzes appear |
| API Key | - | - | Gemini API key for AI quizzes |

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy and paste into Readable settings

The free tier is generous and sufficient for normal use.

## Privacy

- No data collection or tracking
- API key stored locally in your browser
- Article content sent to Gemini API only if you enable quizzes
- No analytics, no ads

## Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## Support

If you find Readable useful, consider:
- Starring this repo
- [Buying me a coffee](https://ko-fi.com/freedomdev)
- Sharing with others

## License

MIT License - see [LICENSE](LICENSE) for details
