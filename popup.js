class ImportMapOverrider {
  constructor() {
    this.importMaps = [];
    this.overrides = {};
    this.init();
  }

  async init() {
    await this.loadOverrides();
    await this.refreshImportMaps();
    this.bindEvents();
    this.renderOverrides();
  }

  bindEvents() {
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.refreshImportMaps();
    });

    document.getElementById("addOverride").addEventListener("click", () => {
      this.addOverride();
    });

    document.getElementById("clearAll").addEventListener("click", () => {
      this.clearAllOverrides();
    });

    // Event delegation for dynamically created buttons
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("override-btn")) {
        const name = e.target.dataset.packageName;
        const url = e.target.dataset.packageUrl;
        this.quickOverride(name, url);
      } else if (e.target.classList.contains("toggle-btn")) {
        const importList = e.target.parentElement.nextElementSibling;
        importList.style.display =
          importList.style.display === "none" ? "block" : "none";
      } else if (e.target.classList.contains("remove-btn")) {
        const name = e.target.dataset.packageName;
        this.removeOverride(name);
      }
    });
  }

  async refreshImportMaps() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        this.showError("No active tab found");
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Extract import maps from the current page
          const scripts = document.querySelectorAll('script[type="importmap"]');
          const importMaps = [];

          scripts.forEach((script, index) => {
            try {
              const content = script.textContent || script.innerHTML;
              if (content.trim()) {
                const parsed = JSON.parse(content);
                const isOverride =
                  script.id === "import-map-overrider-override" ||
                  script.hasAttribute("data-import-map-overrider");

                importMaps.push({
                  index,
                  content: parsed,
                  raw: content,
                  isOverride,
                  element: {
                    tagName: script.tagName,
                    id: script.id,
                    className: script.className,
                  },
                });
              }
            } catch (e) {
              console.warn(
                "Failed to parse import map at index",
                index,
                ":",
                e
              );
            }
          });

          return importMaps;
        },
      });

      this.importMaps = results[0].result || [];
      this.renderImportMaps();
    } catch (error) {
      console.error("获取 import maps 失败:", error);
      this.showError("无法获取页面的 import maps");
    }
  }

  renderImportMaps() {
    const container = document.getElementById("importMaps");

    if (this.importMaps.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div>未找到 Import Maps</div>
          <div style="font-size: 12px; margin-top: 8px; color: #999;">
            此页面可能没有使用 ES Module Import Maps
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.importMaps
      .map(({ content, index }) => {
        const importsHtml = Object.entries(content.imports)
          .map(
            ([name, url]) => `
        <div class="import-item">
          <div>
            <div class="import-name">${this.escapeHtml(name)}</div>
            <div class="import-url">${this.escapeHtml(url)}</div>
          </div>
          <button class="override-btn" data-package-name="${this.escapeHtml(
            name
          )}" data-package-url="${this.escapeHtml(url)}">
            覆盖
          </button>
        </div>
      `
          )
          .join("");

        const scopesHtml = content.scopes
          ? `
        <div style="margin-top: 12px;">
          <div style="font-weight: 500; margin-bottom: 6px; color: #666;">Scopes:</div>
          ${Object.entries(content.scopes)
            .map(
              ([scope, imports]) => `
            <div style="margin-left: 12px; margin-bottom: 8px;">
              <div style="font-size: 11px; color: #888; margin-bottom: 4px;">${this.escapeHtml(
                scope
              )}</div>
              ${Object.entries(imports)
                .map(
                  ([name, url]) => `
                <div class="import-item" style="margin-left: 12px;">
                  <div>
                    <div class="import-name">${this.escapeHtml(name)}</div>
                    <div class="import-url">${this.escapeHtml(url)}</div>
                  </div>
                  <button class="override-btn" onclick="importMapOverrider.quickOverride('${this.escapeHtml(
                    name
                  )}', '${this.escapeHtml(url)}')">
                    覆盖
                  </button>
                </div>
              `
                )
                .join("")}
            </div>
          `
            )
            .join("")}
        </div>
      `
          : "";

        return `
        <div class="import-map-item">
          <div class="import-map-header">
            <div class="import-map-type">Import Map #${index}</div>
            <button class="toggle-btn">
              切换显示
            </button>
          </div>
          <div class="import-list">
            ${importsHtml}
            ${scopesHtml}
          </div>
        </div>
      `;
      })
      .join("");
  }

  quickOverride(name, url) {
    document.getElementById("packageName").value = name;
    document.getElementById("packageUrl").value = url;
  }

  async addOverride() {
    const packageName = document.getElementById("packageName").value.trim();
    const packageUrl = document.getElementById("packageUrl").value.trim();

    if (!packageName || !packageUrl) {
      alert("请填写包名和 URL");
      return;
    }

    this.overrides[packageName] = packageUrl;
    await this.saveOverrides();
    await this.applyOverrides();

    // 清空输入框
    document.getElementById("packageName").value = "";
    document.getElementById("packageUrl").value = "";

    this.renderOverrides();
  }

  async removeOverride(packageName) {
    delete this.overrides[packageName];
    await this.saveOverrides();
    await this.applyOverrides();
    this.renderOverrides();
  }

  async clearAllOverrides() {
    if (confirm("确定要清除所有覆盖规则吗？")) {
      this.overrides = {};
      await this.saveOverrides();
      await this.applyOverrides();
      this.renderOverrides();
    }
  }

  renderOverrides() {
    const container = document.getElementById("overridesList");
    const overrideEntries = Object.entries(this.overrides);

    if (overrideEntries.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <div style="color: #666; font-size: 12px;">暂无覆盖规则</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="overrides-list">
        ${overrideEntries
          .map(
            ([name, url]) => `
          <div class="override-item">
            <div>
              <div class="import-name">${this.escapeHtml(name)}</div>
              <div class="import-url">${this.escapeHtml(url)}</div>
            </div>
            <button class="remove-btn" data-package-name="${this.escapeHtml(
              name
            )}">
              删除
            </button>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  async applyOverrides() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const overrides = this.overrides ?? {};

          // 移除之前的覆盖脚本
          const existingScript = document.getElementById(
            "import-map-overrider-script"
          );
          if (existingScript) {
            existingScript.remove();
          }

          if (Object.keys(overrides).length === 0) {
            return;
          }

          // 创建新的 importmap 脚本来覆盖
          const script = document.createElement("script");
          script.type = "importmap";
          script.id = "import-map-overrider-script";
          script.textContent = JSON.stringify(
            {
              imports: overrides,
            },
            null,
            2
          );

          // 插入到 head 的最前面，确保优先级
          document.head.insertBefore(script, document.head.firstChild);
        },
      });
    } catch (error) {
      console.error("应用覆盖规则失败:", error);
    }
  }

  async loadOverrides() {
    try {
      const result = await chrome.storage.local.get(["importMapOverrides"]);
      this.overrides = result.importMapOverrides || {};
    } catch (error) {
      console.error("加载覆盖规则失败:", error);
      this.overrides = {};
    }
  }

  async saveOverrides() {
    try {
      await chrome.storage.local.set({ importMapOverrides: this.overrides });
    } catch (error) {
      console.error("保存覆盖规则失败:", error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    const container = document.getElementById("importMaps");
    container.innerHTML = `
      <div class="empty-state">
        <div style="color: #ea4335;">${message}</div>
      </div>
    `;
  }
}

// 全局实例
let importMapOverrider;

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  importMapOverrider = new ImportMapOverrider();
  // 将实例暴露到 window 对象，确保 onclick 事件可以访问
  window.importMapOverrider = importMapOverrider;
});
