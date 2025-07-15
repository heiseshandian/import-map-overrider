class ImportMapServiceWorker {
  constructor() {
    this.overrides = {};
    this.dynamicRules = [];
    this.init();
  }

  async init() {
    // 加载已保存的覆盖规则
    await this.loadOverrides();

    // 监听存储变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.importMapOverrides) {
        this.overrides = changes.importMapOverrides.newValue || {};
        this.updateNetworkRules();
      }
    });

    // 监听来自 popup 的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 初始化网络规则
    await this.updateNetworkRules();

    console.log("Import Map Service Worker: 已初始化");
  }

  async loadOverrides() {
    try {
      const result = await chrome.storage.local.get(["importMapOverrides"]);
      this.overrides = result.importMapOverrides || {};
    } catch (error) {
      console.error("Import Map Service Worker: 加载覆盖规则失败", error);
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
      // 清除现有的动态规则
      const existingRules =
        await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIdsToRemove = existingRules.map((rule) => rule.id);

      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove,
        });
      }

      // 创建新的重定向规则
      const newRules = [];
      let ruleId = 1;

      for (const [, override] of Object.entries(this.overrides)) {
        // 只支持新格式：直接从 oldUrl 重定向到 newUrl
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

      // 应用新规则
      if (newRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: newRules,
        });
        console.log("Import Map Service Worker: 已更新网络规则", newRules);
      }

      this.dynamicRules = newRules;
    } catch (error) {
      console.error("Import Map Service Worker: 更新网络规则失败", error);
    }
  }

  // 获取当前活动的规则（用于调试）
  async getActiveRules() {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      return rules;
    } catch (error) {
      console.error("Import Map Service Worker: 获取活动规则失败", error);
      return [];
    }
  }
}

// 初始化 Service Worker
const importMapServiceWorker = new ImportMapServiceWorker();

// 导出实例供调试使用
if (typeof globalThis !== "undefined") {
  globalThis.importMapServiceWorker = importMapServiceWorker;
}
