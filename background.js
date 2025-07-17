class ImportMapServiceWorker {
  constructor() {
    this.overrides = {};
    this.dynamicRules = [];
    this.init();
  }

  async init() {
    // Load saved override rules
    await this.loadOverrides();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.importMapOverrides) {
        this.overrides = changes.importMapOverrides.newValue || {};
        this.updateNetworkRules();
      }
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });

    // Initialize network rules
    await this.updateNetworkRules();

    console.log("Import Map Service Worker: Initialized");
  }

  async loadOverrides() {
    try {
      const result = await chrome.storage.local.get(["importMapOverrides"]);
      this.overrides = result.importMapOverrides || {};
    } catch (error) {
      console.error("Import Map Service Worker: Failed to load override rules", error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "UPDATE_OVERRIDES":
        this.overrides = message.overrides || {};
        await this.updateNetworkRules();
        sendResponse({ success: true });
        break;
      case "GET_OVERRIDES":
        sendResponse({ overrides: this.overrides });
        break;
      default:
        sendResponse({ error: "Unknown message type" });
    }
  }

  async updateNetworkRules() {
    try {
      // Clear existing dynamic rules
      const existingRules =
        await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIdsToRemove = existingRules.map((rule) => rule.id);

      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove,
        });
      }

      // Create new redirect rules
      const newRules = [];
      let ruleId = 1;

      for (const [, override] of Object.entries(this.overrides)) {
        // Only support new format: direct redirect from oldUrl to newUrl
        if (
          override &&
          typeof override === "object" &&
          override.oldUrl &&
          override.newUrl
        ) {
          newRules.push({
            id: ruleId++,
            priority: 1,
            action: {
              type: "redirect",
              redirect: { url: override.newUrl },
            },
            condition: {
              urlFilter: override.oldUrl,
              resourceTypes: ["script", "xmlhttprequest"],
            },
          });
        }
      }

      // Apply new rules
      if (newRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: newRules,
        });
        console.log("Import Map Service Worker: Updated network rules", newRules);
      }

      this.dynamicRules = newRules;
    } catch (error) {
      console.error("Import Map Service Worker: Failed to update network rules", error);
    }
  }

  // Get currently active rules (for debugging)
  async getActiveRules() {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      return rules;
    } catch (error) {
      console.error("Import Map Service Worker: Failed to get active rules", error);
      return [];
    }
  }
}

// Initialize Service Worker
const importMapServiceWorker = new ImportMapServiceWorker();

// Export instance for debugging
if (typeof globalThis !== "undefined") {
  globalThis.importMapServiceWorker = importMapServiceWorker;
}
