# Multi-functional Text Highlighter Extension | [中文文档](./docs/README_zh.md)

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

### Project Structure

GLM-HIGHLIGHTER
├── manifest.json # 扩展配置文件
├── js/
│ ├── background.js # Background service
│ ├── content-action.js # Content script
│ ├── highlighter.js # Core highlighting implementation
│ └── utils.js # Utility functions
├── popup/ # Popup window
└── locales/ # i18n resources
