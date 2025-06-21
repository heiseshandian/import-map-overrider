// Injected Script for Import Map Overrider
// 这个脚本运行在页面的主世界上下文中，可以访问页面的全局变量和函数

(function () {
  "use strict";

  // 避免重复注入
  if (window.importMapOverriderInjected) {
    return;
  }
  window.importMapOverriderInjected = true;

  class ImportMapInjector {
    constructor() {
      this.originalImportMaps = [];
      this.overrides = {};
      this.init();
    }

    init() {
      // 保存原始的 import maps
      this.saveOriginalImportMaps();

      // 监听存储变化
      this.listenForOverrideChanges();

      // 拦截动态 import maps 的添加
      this.interceptDynamicImportMaps();

      console.log("Import Map Overrider: 注入脚本已初始化");
    }

    saveOriginalImportMaps() {
      const scripts = document.querySelectorAll('script[type="importmap"]');
      scripts.forEach((script, index) => {
        if (!script.id || script.id !== "import-map-overrider-injected") {
          try {
            const content = JSON.parse(script.textContent || script.innerHTML);
            this.originalImportMaps.push({
              index,
              element: script,
              content,
            });
          } catch (error) {
            console.warn("Import Map Overrider: 无法解析原始 importmap", error);
          }
        }
      });
    }

    listenForOverrideChanges() {
      // 通过自定义事件监听覆盖规则的变化
      window.addEventListener("importMapOverrideUpdate", (event) => {
        this.overrides = event.detail.overrides || {};
        this.applyOverrides();
      });
    }

    interceptDynamicImportMaps() {
      // 拦截 createElement 来监听动态创建的 script 标签
      const originalCreateElement = document.createElement;
      document.createElement = function (tagName) {
        const element = originalCreateElement.call(document, tagName);

        if (tagName.toLowerCase() === "script") {
          // 监听 type 属性的变化
          const originalSetAttribute = element.setAttribute;
          element.setAttribute = function (name, value) {
            originalSetAttribute.call(this, name, value);
            if (name === "type" && value === "importmap") {
              // 延迟处理，确保内容已设置
              setTimeout(() => {
                window.importMapInjector.handleNewImportMap(this);
              }, 0);
            }
          };

          // 监听 type 属性的直接赋值
          Object.defineProperty(element, "type", {
            set: function (value) {
              this.setAttribute("type", value);
            },
            get: function () {
              return this.getAttribute("type");
            },
          });
        }

        return element;
      };

      // 添加MutationObserver监听DOM变化
      const self = this;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              node.tagName === "SCRIPT" &&
              node.type === "importmap" &&
              node.id !== "import-map-overrider-injected"
            ) {
              console.log("Import Map Overrider: 检测到新的import map", node);
              // 发现新的import map，重新应用覆盖
              setTimeout(() => {
                if (Object.keys(self.overrides).length > 0) {
                  self.applyOverrides();
                }
              }, 50);
            }
          });
        });
      });

      observer.observe(document.head, {
        childList: true,
        subtree: true,
      });

      // 保存observer引用以便后续清理
      this.mutationObserver = observer;
    }

    handleNewImportMap(scriptElement) {
      if (scriptElement.id === "import-map-overrider-injected") {
        return; // 忽略我们自己创建的覆盖脚本
      }

      try {
        const content = JSON.parse(
          scriptElement.textContent || scriptElement.innerHTML
        );
        this.originalImportMaps.push({
          index: this.originalImportMaps.length,
          element: scriptElement,
          content,
        });

        // 如果有覆盖规则，重新应用（延迟执行避免竞态条件）
        if (Object.keys(this.overrides).length > 0) {
          setTimeout(() => this.applyOverrides(), 50);
        }
      } catch (error) {
        console.warn("Import Map Overrider: 无法解析新的 importmap", error);
      }
    }

    applyOverrides() {
      if (Object.keys(this.overrides).length === 0) {
        this.removeOverrideScript();
        return;
      }

      // 延迟注入，确保在主import map之后
      setTimeout(() => {
        this.doApplyOverrides();
      }, 100);
    }

    doApplyOverrides(retryCount = 0) {
      const maxRetries = 5;
      const existingImportMaps = document.querySelectorAll(
        'script[type="importmap"]:not(#import-map-overrider-injected)'
      );

      console.log(
        `Import Map Overrider: 尝试应用覆盖规则 (第${retryCount + 1}次), 发现${
          existingImportMaps.length
        }个原始import map`
      );

      // 如果还没有主import map且未达到最大重试次数，继续等待
      if (existingImportMaps.length === 0 && retryCount < maxRetries) {
        console.log("Import Map Overrider: 等待主import map加载...");
        setTimeout(() => {
          this.doApplyOverrides(retryCount + 1);
        }, 200);
        return;
      }

      // 移除之前的覆盖脚本
      this.removeOverrideScript();

      // 创建新的覆盖脚本
      const script = document.createElement("script");
      script.type = "importmap";
      script.id = "import-map-overrider-injected";
      script.textContent = JSON.stringify(
        {
          imports: this.overrides,
        },
        null,
        2
      );

      // 插入到最后一个原始 importmap 之后，确保覆盖生效
      const lastOriginalImportMap = Array.from(existingImportMaps).pop();
      if (lastOriginalImportMap && lastOriginalImportMap.nextSibling) {
        document.head.insertBefore(script, lastOriginalImportMap.nextSibling);
      } else if (lastOriginalImportMap) {
        lastOriginalImportMap.parentNode.insertBefore(
          script,
          lastOriginalImportMap.nextSibling
        );
      } else {
        document.head.appendChild(script);
      }

      console.log("Import Map Overrider: 已应用覆盖规则", this.overrides);

      // 触发自定义事件，通知其他脚本
      window.dispatchEvent(
        new CustomEvent("importMapOverrideApplied", {
          detail: { overrides: this.overrides },
        })
      );
    }

    removeOverrideScript() {
      const existingScript = document.getElementById(
        "import-map-overrider-injected"
      );
      if (existingScript) {
        existingScript.remove();
      }
    }

    // 获取当前所有的 import maps（包括原始的和覆盖的）
    getAllImportMaps() {
      const allMaps = [];
      const scripts = document.querySelectorAll('script[type="importmap"]');

      scripts.forEach((script, index) => {
        try {
          const content = JSON.parse(script.textContent || script.innerHTML);
          allMaps.push({
            index: index + 1,
            id: script.id || null,
            isOverride: script.id === "import-map-overrider-injected",
            content,
            imports: content.imports || {},
            scopes: content.scopes || {},
          });
        } catch (error) {
          allMaps.push({
            index: index + 1,
            id: script.id || null,
            isOverride: false,
            error: error.message,
            content: null,
            imports: {},
            scopes: {},
          });
        }
      });

      return allMaps;
    }

    // 获取合并后的 import map
    getMergedImportMap() {
      const merged = {
        imports: {},
        scopes: {},
      };

      const scripts = document.querySelectorAll('script[type="importmap"]');
      scripts.forEach((script) => {
        try {
          const content = JSON.parse(script.textContent || script.innerHTML);
          if (content.imports) {
            Object.assign(merged.imports, content.imports);
          }
          if (content.scopes) {
            Object.assign(merged.scopes, content.scopes);
          }
        } catch (error) {
          console.warn("Import Map Overrider: 无法解析 importmap", error);
        }
      });

      return merged;
    }

    // 更新覆盖规则
    updateOverrides(newOverrides) {
      this.overrides = newOverrides || {};
      this.applyOverrides();
    }
  }

  // 创建全局实例
  window.importMapInjector = new ImportMapInjector();

  // 配置选项
  const CONFIG = {
    INJECTION_DELAY: 100,
    MAX_RETRIES: 5,
    RETRY_INTERVAL: 200,
    DEBUG_MODE: false,
  };

  // 暴露一些有用的方法到全局
  window.importMapOverrider = {
    getImportMaps: () => window.importMapInjector.getAllImportMaps(),
    getMergedImportMap: () => window.importMapInjector.getMergedImportMap(),
    updateOverrides: (overrides) =>
      window.importMapInjector.updateOverrides(overrides),
    getOverrides: () => window.importMapInjector.overrides,
    debug: {
      getConfig: () => CONFIG,
      setConfig: (newConfig) => Object.assign(CONFIG, newConfig),
      forceReapply: () => window.importMapInjector.applyOverrides(),
      getTimeline: () => window.importMapInjector.timeline || [],
      enableDebug: () => {
        CONFIG.DEBUG_MODE = true;
      },
      disableDebug: () => {
        CONFIG.DEBUG_MODE = false;
      },
    },
  };

  console.log("Import Map Overrider: 页面注入脚本已加载");
})();
