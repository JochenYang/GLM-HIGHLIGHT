<div align="center">
  <h1>
    <img src="img/logo.png" alt="GLM Highlighter" width="128" height="128" />
    <br>
    GLM Highlighter
  </h1>
  <p>Professional webpage text highlighter with multi-category management, custom colors, keyboard shortcuts, context menu, drag-and-drop sorting, import/export and share code features</p>
  <p>English | <a href="docs/README_zh.md">中文</a></p>
</div>

[![Version](https://img.shields.io/badge/version-1.0.8-blue.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/pulls)
[![Issues](https://img.shields.io/badge/issues-welcome-orange.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/issues)

## Features

### Multi-Category Highlight Management
- Create multiple independent highlight categories, each with its own configuration
- Quickly enable/disable specific categories with toggle switches
- Intuitive drag-and-drop interface for adjusting category priority and display order
- Support for adding, editing, and deleting keywords in bulk

### Highlight Style Customization
- Multiple preset colors available for different scenarios
- Set different colors for each category to improve visual recognition
- Carefully designed highlight styles ensuring readability and aesthetics

### Efficient Operation Methods
- Quickly add (Alt+Shift+C) or remove (Alt+Shift+D) highlights using keyboard shortcuts
- Add selected text to highlight categories via right-click menu
- Automatically process space-separated multiple keywords, with deduplication support

### Data Management & Sharing
- One-click export to JSON file for backup and migration
- Generate compact share codes to easily share highlight configurations
- Transfer configurations between devices via import/export functionality

## Usage Guide

### Basic Operations
1. Click the extension icon in the toolbar to open the control panel
2. Click the "New" button to create a highlight category
3. Enter category name and keywords (separate multiple keywords with spaces)
4. Select highlight color and enable highlighting with the toggle switch
5. While browsing, matching keywords will be automatically highlighted

### Quick Operations
- Select webpage text and press Alt+Shift+C (MacCtrl+Shift+C on Mac) to add to highlight category
- Select highlighted text and press Alt+Shift+D (MacCtrl+Shift+D on Mac) to remove highlighting
- Right-click selected text and choose "Add to Highlight Category" from the menu
- Drag category cards to adjust display order

### Data Management
- Click "Export" button to backup current configuration
- Click "Import" button to restore previous configuration
- Click "Share" to generate a share code that can be copied and shared
- Click "Dedup" to automatically clean up duplicate keywords

## Privacy Statement

- Extension only runs on user-authorized webpages
- All data is stored locally, synchronized only through Chrome sync service
- Does not collect personal information or browsing history
- No additional permissions or third-party services required

## License

This project is licensed under the [Apache License 2.0](LICENSE)

For the full license text, please see the [LICENSE](LICENSE) file.

## Technical Features

- Developed with Manifest V3, compliant with latest Chrome extension standards
- DOM observer implementation for dynamic content highlighting
- Optimized Range API implementation for high-performance text processing
- Comprehensive internationalization support for English and Chinese
- Carefully designed caching mechanism to reduce resource usage
- Responsive user interface adapting to different screen sizes

## Feedback

For issues or suggestions:

1. Submit GitHub Issue
2. Send email to [297390763@qq.com]

For changelog details, please see Releases.

## Localization

This extension supports multiple languages. Currently supported:

- English (default)
- Chinese (Simplified)
- (Add more languages as you implement them)

To contribute a new language, add a new folder under `_locales` with the appropriate language code.

```
                                 Apache License
                           Version 2.0, January 2004

Copyright (c) 2025 Jochen Yang

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Technical Features

- Developed with Manifest V3, compliant with latest Chrome extension standards
- DOM observer implementation for dynamic content highlighting
- Optimized Range API implementation for high-performance text processing
- Comprehensive internationalization support for English and Chinese
- Carefully designed caching mechanism to reduce resource usage
- Responsive user interface adapting to different screen sizes

## Feedback

For issues or suggestions:

1. Submit GitHub Issue
2. Send email to [297390763@qq.com]

For changelog details, please see Releases.

## Localization

This extension supports multiple languages. Currently supported:

- English (default)
- Chinese (Simplified)
- (Add more languages as you implement them)

To contribute a new language, add a new folder under `_locales` with the appropriate language code.
