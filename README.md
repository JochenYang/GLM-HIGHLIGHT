<div align="center">
  <h2 style="font-size: 1.5em; margin: 1em 0;">
    <img src="./img/logo.png" alt="GLM-HIGHLIGHT" width="128" />
    <br>
    Multi-functional Text Highlighter Extension
    <br>
    <a href="./docs/README_zh.md" style="font-size: 0.9em; color: #666;">中文文档</a>
  </h2>
</div>

[![Version](https://img.shields.io/badge/version-1.0.7-blue.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/pulls)
[![Issues](https://img.shields.io/badge/issues-welcome-orange.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/issues)

A powerful Chrome extension for webpage text highlighting management. Supporting multi-category, hotkeys, highlight synchronization and more features.

## Key Features

- 🎨 Multi-category Highlight Management

  - Support multiple highlight categories
  - Custom colors for each category
  - Category renaming and deletion

- 🔍 Smart Text Highlighting

  - Real-time text highlighting
  - Support for dynamic content
  - Optimized performance and memory usage

- ⌨️ Quick Operations

  - Keyboard shortcuts
  - Right-click menu operations
  - One-click highlight clearing

- 🔄 Data Synchronization

  - Cross-device settings sync
  - Import/export configurations
  - Auto-save highlight states

## Installation

1. Install from Chrome Web Store
2. Click the extension icon to open control panel
3. Create highlight categories and set keywords
4. Select text on webpage, use shortcuts or right-click menu to add highlights

## Keyboard Shortcuts

- `Alt + Shift + C`: Add selected text to highlight category
- `Alt + Shift + D`: Remove highlight from selected text

## Technical Features

- Developed with Manifest V3
- DOM observer for dynamic content highlighting
- Batch processing for performance optimization
- Secure cross-origin messaging
- Responsive user interface

## Development Guide

1、Currently, multi-language is not supported, only Chinese is supported

### Project Structure

```
GLM-HIGHLIGHTER
├── manifest.json          # Extension configuration
├── js/
│   ├── background.js     # Background service
│   ├── content-action.js # Content script
│   ├── highlighter.js    # Core highlighting implementation
│   └── utils.js         # Utility functions
├── popup/                # Popup window
└── locales/             # i18n resources
```

## Privacy Statement

- Extension only runs on user authorized pages
- No personal information collection
- Local data storage with Chrome sync service only

## License

MIT License

## Feedback

For issues or suggestions:

1. Submit GitHub Issue
2. Send email to [297390763@qq.com]

For changelog details, please see Releases.
