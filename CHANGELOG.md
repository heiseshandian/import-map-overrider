# Changelog

## v2.0.0

### 💥 Breaking Changes

#### Removed Backward Compatibility
- **No longer supports package name mapping mode**: Removed old string format override rules (`packageName -> newUrl`)
- **Enforced precise redirection**: All override rules now must use `{ oldUrl, newUrl }` format
- **Old URL required**: When creating override rules, the "Old URL" field is now mandatory

### 🎯 New Features

#### Precise URL Redirection (Only Mode)
- **Precise match redirection**: Support direct redirection from `oldUrl` to `newUrl`
- **Quick override optimization**: Automatically fill `oldUrl` and `newUrl` fields when clicking "Quick Override"
- **Simplified configuration**: Directly specify complete source URL and target URL

#### User Interface Improvements
- **Simplified interface**: Removed package name mapping related instructions and options
- **Required fields**: "Old URL" is now a required field, clearly marked in the interface
- **Updated placeholder text**: Provide clearer input guidance

### 🔧 Technical Improvements

#### Service Worker Optimization
- **Simplified rule generation**: Only handle precise URL redirection
- **Removed complex logic**: Removed package name matching logic
- **Improved performance**: Reduced unnecessary pattern matching

#### Test Feature Updates
- **Updated test instructions**: Only keep precise redirection related content
- **Removed package name mapping tests**: Removed package name mapping test cases
- **Simplified working principle explanation**: Focus on precise redirection mode

### 📋 Usage

#### Precise URL Redirection (Only Mode)
```
Rule Name: my-redirect-rule
Old URL: https://esm.sh/lodash@4.17.21 (Required)
New URL: https://cdn.skypack.dev/lodash@4.17.21
```

### 🔄 Migration Guide

If you previously used package name mapping mode, you need to:
1. Convert package names to specific URLs
2. Fill in the complete source URL in the "Old URL" field
3. Fill in the target URL in the "New URL" field

### 🎯 Use Cases

Precise redirection is suitable for scenarios where you need to redirect specific URLs to another URL, such as:
- Fixing bugs in specific versions
- Using local development versions
- Switching to faster CDNs
- Solving compatibility issues with specific URLs

### ⚠️ Important Reminders

- After adding or modifying override rules, you must **refresh the page** for Service Worker interception rules to take effect
- All rules are now exact matches
- The "Old URL" field cannot be empty