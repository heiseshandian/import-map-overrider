// Content Script for Import Map Overrider
// 这个脚本运行在页面上下文中，用于检测和操作 import maps

class ImportMapContentScript {
  constructor() {
    this.observer = null;
    this.overrides = {};
    this.init();
  }

  async init() {
    // 首先注入 injected.js 脚本
    await this.injectScript();

    // 加载已保存的覆盖规则
    await this.loadOverrides();

    // 如果有覆盖规则，立即应用
    if (Object.keys(this.overrides).length > 0) {
      this.applyOverrides();
    }

    // 监听 DOM 变化，以便在动态添加的 importmap 上应用覆盖
    this.observeImportMaps();

    // 监听来自 popup 的消息
    this.setupMessageListener();
  }

  injectScript() {
    return new Promise((resolve) => {
      // 检查是否已经注入
      if (document.getElementById("import-map-overrider-injected-script")) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = "import-map-overrider-injected-script";
      script.src = chrome.runtime.getURL("injected.js");
      script.onload = () => {
        console.log("Import Map Overrider: injected.js 已加载");
        resolve();
      };
      script.onerror = () => {
        console.error("Import Map Overrider: injected.js 加载失败");
        resolve();
      };

      // 注入到页面的主世界上下文
      (document.head || document.documentElement).appendChild(script);
    });
  }

  async loadOverrides() {
    try {
      const result = await chrome.storage.local.get(["importMapOverrides"]);
      this.overrides = result.importMapOverrides || {};
    } catch (error) {
      console.error("Import Map Overrider: 加载覆盖规则失败", error);
    }
  }

  applyOverrides() {
    if (Object.keys(this.overrides).length === 0) {
      // 通知注入脚本清除覆盖规则
      this.notifyInjectedScript({});
      return;
    }

    // 通过自定义事件通知注入脚本应用覆盖规则
    this.notifyInjectedScript(this.overrides);

    console.log(
      "Import Map Overrider: 已通知注入脚本应用覆盖规则",
      this.overrides
    );
  }

  notifyInjectedScript(overrides) {
    // 通过自定义事件与注入脚本通信，避免 CSP 违规
    const event = new CustomEvent("importMapOverrideUpdate", {
      detail: { overrides },
    });
    window.dispatchEvent(event);
  }

  observeImportMaps() {
    // 创建 MutationObserver 来监听 DOM 变化
    this.observer = new MutationObserver((mutations) => {
      let hasNewImportMap = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查是否是新的 importmap
            if (node.tagName === "SCRIPT" && node.type === "importmap") {
              hasNewImportMap = true;
            }
            // 检查子元素中是否有 importmap
            const importMaps =
              node.querySelectorAll &&
              node.querySelectorAll('script[type="importmap"]');
            if (importMaps && importMaps.length > 0) {
              hasNewImportMap = true;
            }
          }
        });
      });

      // 如果检测到新的 importmap，重新应用覆盖规则
      if (hasNewImportMap && Object.keys(this.overrides).length > 0) {
        setTimeout(() => {
          this.applyOverrides();
        }, 100); // 稍微延迟以确保 DOM 完全更新
      }
    });

    // 开始观察
    this.observer.observe(document.head, {
      childList: true,
      subtree: true,
    });
  }

  setupMessageListener() {
    // 监听来自 popup 或 background 的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case "GET_IMPORT_MAPS":
          sendResponse(this.extractImportMaps());
          break;
        case "APPLY_OVERRIDES":
          this.overrides = message.overrides || {};
          this.applyOverrides();
          sendResponse({ success: true });
          break;
        case "RELOAD_OVERRIDES":
          this.loadOverrides().then(() => {
            this.applyOverrides();
            sendResponse({ success: true });
          });
          return true; // 保持消息通道开放
        default:
          sendResponse({ error: "Unknown message type" });
      }
    });
  }

  extractImportMaps() {
    const importMaps = [];

    // 查找所有 importmap script 标签
    const scripts = document.querySelectorAll('script[type="importmap"]');

    scripts.forEach((script, index) => {
      try {
        const content = script.textContent || script.innerHTML;
        const parsed = JSON.parse(content);

        // 检查是否是我们注入的覆盖脚本
        const isOverrideScript = script.id === "import-map-overrider-injected";

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
        console.error("Import Map Overrider: 解析 importmap 失败", error);
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

// 初始化内容脚本
let importMapContentScript;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    importMapContentScript = new ImportMapContentScript();
  });
} else {
  importMapContentScript = new ImportMapContentScript();
}

// 页面卸载时清理
window.addEventListener("beforeunload", () => {
  if (importMapContentScript) {
    importMapContentScript.destroy();
  }
});
