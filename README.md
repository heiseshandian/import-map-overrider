# Import Map Overrider

A powerful Chrome extension for displaying and overriding ES Module Import Maps in web pages.

## Features

### 🔍 Import Map Detection and Display

- Automatically detect all `<script type="importmap">` tags on the page
- Clearly display the content of each Import Map, including `imports` and `scopes`
- Support detection of dynamically added Import Maps
- Distinguish between original Import Maps and override rules

### ⚡ Network Interception Override Functionality

- One-click override of any package's import path
- Support adding custom package override rules
- Override rules are persistently stored and take effect across pages
- Use Service Worker to intercept network requests for overrides
- 🔗 **Smart Dependency Handling**: Automatically handle version compatibility of related dependency packages
- 🎯 **Precise URL Redirection**: Support direct 307 redirect from oldUrl to newUrl

### 🎯 Developer Friendly

- Intuitive user interface, easy to use
- Support quick override (click "Override" button next to package name)
- Override rule management (add, delete, clear)
- Detailed error messages and status feedback

## Installation

### Developer Mode Installation

1. Open Chrome browser
2. Visit `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked extension"
5. Select this project's folder
6. Extension installation complete!

## Usage Guide

### Basic Usage

1. Visit any webpage that uses Import Maps
2. Click the extension icon in the browser toolbar
3. View all Import Maps detected on the page
4. Click the "Override" button next to any package to quickly set override rules

### Adding Override Rules

#### 🎯 Precise URL Redirection Mode

1. Fill in the "Add Override Rules" section:

- **Rule Name**: Custom rule name (e.g., `my-redirect-rule`)
- **Old URL**: Complete URL to redirect (e.g., `https://esm.sh/lodash@4.17.21`)
- **New URL**: Target URL (e.g., `https://cdn.skypack.dev/lodash@4.17.21`)

2. Click "Add Override" button
3. **Refresh the page** for Service Worker interception rules to take effect

### Managing Override Rules

- **View Current Rules**: View all active overrides in the "Current Override Rules" section
- **Delete Single Rule**: Click the "Delete" button next to a rule
- **Clear All Rules**: Click the "Clear All" button

## Technical Implementation

### Architecture Design

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Popup.js      │    │  Content.js     │    │ Background.js   │
│   (UI Logic)    │    │ (Page Detection)│    │(Service Worker) │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Override Mgmt│ │    │ │Import Map   │ │    │ │Network      │ │
│ │             │ │    │ │Detection    │ │    │ │Interception │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │   (Persistent)        │    (Listen Changes)   │    (Request Interception)
        └───────────────────────┼───────────────────────┼─────────────────────────
                               │                       │
                    ┌─────────────────┐    ┌─────────────────┐
                    │ Chrome Storage  │    │ Network Requests│
                    │                 │    │                 │
                    └─────────────────┘    └─────────────────┘
```

### Core Components

**Popup.js**:

- User interaction interface
- Import Maps display
- Override rule management
- Communication with Content Script

**Content.js**:

- Page-level Import Map detection
- DOM change monitoring
- Override rule application
- Message passing bridge

**Background.js**:

- Network request interception and redirection
- Dynamic rule management
- Cross-page override rule application
- Background continuous operation

### Override Mechanism

The extension implements Import Map override through the following methods:

1. **Network Interception**: Use Service Worker's declarativeNetRequest API to intercept network requests
2. **URL Redirection**: Redirect matching module requests to specified new URLs
3. **Dynamic Rules**: Dynamically create and update interception rules based on user configuration
4. **Persistent Storage**: Use Chrome Storage API to save override rules
5. **Precise Matching**: Direct matching of complete URLs for precise control

## Common Use Cases

### 1. Development Environment Debugging

```javascript
// Original Import Map
{
  "imports": {
    "react": "https://esm.sh/react@18.2.0"
  }
}

// Override to local development version
{
  "imports": {
    "react": "http://localhost:3000/react.js"
  }
}
```

### 2. Version Switching Testing

```javascript
// Quickly switch between different versions for compatibility testing
"react": "https://esm.sh/react@18.2.0"  // Test new version
"react": "https://esm.sh/react@17.0.2"  // Rollback to stable version
```

### 3. CDN Switching

```javascript
// Switch from one CDN to another
// Old URL: "https://cdn.skypack.dev/lodash@4.17.21"
// New URL: "https://esm.sh/lodash@4.17.21"
```

## Compatibility

- **Browser**: Chrome 88+ (Manifest V3)
- **Web Pages**: Modern browsers that support ES Modules and Import Maps
- **Frameworks**: Compatible with all frameworks that use Import Maps

## Development Notes

### Project Structure

```
import-map-overrider/
├── manifest.json          # Extension configuration file
├── popup.html            # Popup interface
├── popup.js              # Popup logic
├── content.js            # Content script
├── background.js         # Background script
├── test.html             # Test page
└── README.md             # Documentation
```

### Permission Explanation

- `activeTab`: Access current active tab
- `storage`: Store override rules
- `scripting`: Inject scripts into pages
- `declarativeNetRequest`: Intercept and redirect network requests
- `declarativeNetRequestWithHostAccess`: Host access permissions
- `<all_urls>`: Work on all websites

## Troubleshooting

### Common Issues

**Q: Override rules not taking effect?**
A: Make sure:

- Package name is spelled correctly
- URL format is correct and accessible
- Page actually uses Import Maps
- **Page has been refreshed** (Service Worker interception requires page reload)
- Check Network tab in developer tools to confirm requests are being redirected

**Q: Dependency errors after updating package version?**
A: This is usually caused by incompatible dependency package versions:

- Need to manually add override rules for dependency packages
- For example: Redirect the complete URL of `vue-demi` to a compatible version

**Q: Vue Router export errors (useRouter etc.)?**
A: This is usually caused by mismatched build versions:

- Need to manually add vue-router redirect rules
- Vue 3.x requires vue-router 4.x ESM browser build version
- Ensure new URL includes `esm-browser.js` suffix

**Q: Import Maps not detected?**
A: Possible reasons:

- Page doesn't use Import Maps
- Import Maps are dynamically loaded (wait a moment then click refresh)
- Page uses non-standard module loading methods

**Q: Extension icon is grayed out?**
A: Check:

- Extension is properly installed
- On a supported website
- Browser supports Manifest V3

## Contributing

Welcome to submit Issues and Pull Requests!

### Development Environment Setup

1. Clone the project
2. Load extension in Chrome
3. Reload extension after modifying code
4. Test functionality

## License

MIT License - See LICENSE file for details

## Changelog

### v2.0.0 (Current)

- **Major Update**: Simplified to precise URL redirection mode
- Removed package name mapping functionality, focused on precise URL control
- More intuitive user interface and usage
- Improved redirection predictability and accuracy

### v1.1.0

- **Major Update**: Changed to Service Worker network interception for overrides
- More stable override mechanism, not limited by browser Import Map parsing
- Optimized user interface, added working principle explanation

### v1.0.0

- Initial version release
- Basic Import Map detection and display
- Override rule addition and management (based on Import Map injection)
- Persistent storage support
- Dynamic Import Map monitoring
