// Content Script for Import Map Overrider
// This script runs in page context to detect and manipulate import maps

class ImportMapContentScript {
  constructor() {
    this.observer = null;
    this.init();
  }

  async init() {
    // Listen for DOM changes to detect new import maps
    this.observeImportMaps();

    // Listen for messages from popup
    this.setupMessageListener();

    console.log('Import Map Overrider: Content Script initialized (Service Worker mode)');
  }

  // No longer need to inject scripts and apply override rules in Service Worker mode
  // Override functionality is now implemented through Service Worker network interception

  observeImportMaps() {
    // Create MutationObserver to listen for DOM changes to detect new import maps
    this.observer = new MutationObserver((mutations) => {
      let hasNewImportMap = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if it's a new importmap
            if (
              node.tagName === "SCRIPT" &&
              node.type === "importmap"
            ) {
              hasNewImportMap = true;
            }
            // Check if there are importmaps in child elements
            const importMaps =
              node.querySelectorAll &&
              node.querySelectorAll('script[type="importmap"]');
            if (importMaps && importMaps.length > 0) {
              hasNewImportMap = true;
            }
          }
        });
      });

      // If new importmap is detected, log it (Service Worker will automatically handle interception)
      if (hasNewImportMap) {
        console.log('Import Map Overrider: Detected new import map');
      }
    });

    // Start observing
    this.observer.observe(document.head, {
      childList: true,
      subtree: true,
    });
  }

  setupMessageListener() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "GET_IMPORT_MAPS":
          sendResponse(this.extractImportMaps());
          break;
        default:
          sendResponse({ error: "Unknown message type" });
      }
    });
  }

  extractImportMaps() {
    const importMaps = [];

    // Find all importmap script tags
    const scripts = document.querySelectorAll('script[type="importmap"]');

    scripts.forEach((script, index) => {
      try {
        const content = script.textContent || script.innerHTML;
        const parsed = JSON.parse(content);

        // In Service Worker mode, there are no more injected override scripts
        const isOverrideScript = false;

        importMaps.push({
          index: index + 1,
          id: script.id || null,
          isOverride: isOverrideScript,
          element: script.outerHTML,
          content: parsed,
          imports: parsed.imports || {},
          scopes: parsed.scopes || {},
        });
      } catch (error) {
        console.error("Import Map Overrider: Failed to parse importmap", error);
        importMaps.push({
          index: index + 1,
          id: script.id || null,
          isOverride: false,
          error: error.message,
          element: script.outerHTML,
          content: null,
          imports: {},
          scopes: {},
        });
      }
    });

    return importMaps;
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize content script
let importMapContentScript;

function initContentScript() {
  if (!importMapContentScript) {
    importMapContentScript = new ImportMapContentScript();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContentScript);
} else {
  initContentScript();
}

// Cleanup when page unloads
window.addEventListener("beforeunload", () => {
  if (importMapContentScript) {
    importMapContentScript.destroy();
  }
});
