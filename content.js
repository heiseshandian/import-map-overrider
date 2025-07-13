// Content Script for Import Map Overrider
// 这个脚本运行在页面上下文中，用于检测和操作 import maps

class ImportMapContentScript {
  constructor() {
    this.observer = null;
    this.init();
  }

  async init() {
    // 监听 DOM 变化，以便检测新的 import maps
    this.observeImportMaps();

    // 监听来自 popup 的消息
    this.setupMessageListener();

    console.log('Import Map Overrider: Content Script 已初始化（Service Worker 模式）');
  }

  // Service Worker 模式下不再需要注入脚本和应用覆盖规则
  // 覆盖功能现在通过 Service Worker 的网络拦截实现

  observeImportMaps() {
    // 创建 MutationObserver 来监听 DOM 变化，用于检测新的 import maps
    this.observer = new MutationObserver((mutations) => {
      let hasNewImportMap = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查是否是新的 importmap
            if (
              node.tagName === "SCRIPT" &&
              node.type === "importmap"
            ) {
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

      // 如果检测到新的 importmap，记录日志（Service Worker 会自动处理拦截）
      if (hasNewImportMap) {
        console.log('Import Map Overrider: 检测到新的 import map');
      }
    });

    // 开始观察
    this.observer.observe(document.head, {
      childList: true,
      subtree: true,
    });
  }

  setupMessageListener() {
    // 监听来自 popup 的消息
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

    // 查找所有 importmap script 标签
    const scripts = document.querySelectorAll('script[type="importmap"]');

    scripts.forEach((script, index) => {
      try {
        const content = script.textContent || script.innerHTML;
        const parsed = JSON.parse(content);

        // 在 Service Worker 模式下，不再有注入的覆盖脚本
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

// 页面卸载时清理
window.addEventListener("beforeunload", () => {
  if (importMapContentScript) {
    importMapContentScript.destroy();
  }
});
