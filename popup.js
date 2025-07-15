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

    // 搜索功能
    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");

    searchInput.addEventListener("input", (e) => {
      this.filterImportMaps(e.target.value);
      clearSearchBtn.style.display = e.target.value ? "flex" : "none";
    });

    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      this.filterImportMaps("");
      clearSearchBtn.style.display = "none";
      searchInput.focus();
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
          let scripts = document.querySelectorAll('script[type="importmap"]');
          // Filter out our own injected import map script
          scripts = Array.from(scripts ?? []).filter(
            (script) => script.id !== "import-map-overrider-injected"
          );
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

    // 应用当前的搜索过滤
    const searchInput = document.getElementById("searchInput");
    if (searchInput && searchInput.value) {
      this.filterImportMaps(searchInput.value);
    }
  }

  filterImportMaps(searchTerm) {
    const container = document.getElementById("importMaps");
    const importMapItems = container.querySelectorAll(".import-map-item");

    if (!searchTerm.trim()) {
      // 显示所有项目
      importMapItems.forEach((item) => {
        item.classList.remove("hidden");
        const importItems = item.querySelectorAll(".import-item");
        importItems.forEach((importItem) =>
          importItem.classList.remove("hidden")
        );
      });
      this.removeNoResultsMessage();
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    let hasVisibleResults = false;

    importMapItems.forEach((mapItem) => {
      const importItems = mapItem.querySelectorAll(".import-item");
      let hasVisibleImports = false;

      importItems.forEach((importItem) => {
        const nameElement = importItem.querySelector(".import-name");
        const urlElement = importItem.querySelector(".import-url");

        const name = nameElement ? nameElement.textContent.toLowerCase() : "";
        const url = urlElement ? urlElement.textContent.toLowerCase() : "";

        const matches = name.includes(searchLower) || url.includes(searchLower);

        if (matches) {
          importItem.classList.remove("hidden");
          hasVisibleImports = true;
          hasVisibleResults = true;
        } else {
          importItem.classList.add("hidden");
        }
      });

      // 如果这个import map有可见的导入项，则显示整个map
      if (hasVisibleImports) {
        mapItem.classList.remove("hidden");
      } else {
        mapItem.classList.add("hidden");
      }
    });

    // 显示或隐藏"无结果"消息
    if (!hasVisibleResults) {
      this.showNoResultsMessage(searchTerm);
    } else {
      this.removeNoResultsMessage();
    }
  }

  showNoResultsMessage(searchTerm) {
    this.removeNoResultsMessage();
    const container = document.getElementById("importMaps");
    const noResultsDiv = document.createElement("div");
    noResultsDiv.className = "no-results";
    noResultsDiv.id = "noResultsMessage";
    noResultsDiv.innerHTML = `
      <div>未找到匹配 "${this.escapeHtml(searchTerm)}" 的结果</div>
      <div style="font-size: 12px; margin-top: 4px; color: #999;">
        尝试搜索其他包名或URL
      </div>
    `;
    container.appendChild(noResultsDiv);
  }

  removeNoResultsMessage() {
    const existing = document.getElementById("noResultsMessage");
    if (existing) {
      existing.remove();
    }
  }

  quickOverride(name, url) {
    document.getElementById("packageName").value = name;
    document.getElementById("oldUrl").value = url;
    document.getElementById("newUrl").value = url;
  }

  async addOverride() {
    const packageName = document.getElementById("packageName").value.trim();
    const oldUrl = document.getElementById("oldUrl").value.trim();
    const newUrl = document.getElementById("newUrl").value.trim();

    // 检查必填字段
    if (!packageName) {
      alert("请填写规则名称");
      return;
    }
    
    if (!oldUrl) {
      alert("旧 URL 为必填项");
      return;
    }
    
    if (!newUrl) {
      alert("请填写新 URL");
      return;
    }

    // 只支持新格式：URL 重定向
    this.overrides[packageName] = { oldUrl, newUrl };

    await this.saveOverrides();
    await this.applyOverrides();

    // 清空输入框
    document.getElementById("packageName").value = "";
    document.getElementById("oldUrl").value = "";
    document.getElementById("newUrl").value = "";

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
            ([name, override]) => {
              // 只支持新格式：URL 重定向
              return `
                <div class="override-item">
                  <div>
                    <div class="import-name">${this.escapeHtml(name)}</div>
                    <div class="import-url" style="font-size: 10px; color: #888;">从: ${this.escapeHtml(override.oldUrl)}</div>
                    <div class="import-url">到: ${this.escapeHtml(override.newUrl)}</div>
                  </div>
                  <button class="remove-btn" data-package-name="${this.escapeHtml(name)}">
                    删除
                  </button>
                </div>
              `;
            }
          )
          .join("")}
      </div>
    `;
  }

  async applyOverrides() {
    try {
      // 通过 Service Worker 更新网络拦截规则
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_OVERRIDES',
        overrides: this.overrides
      });

      if (response && response.success) {
        console.log('Import Map Overrider: 已更新网络拦截规则', this.overrides);
        
        // 通知当前页面覆盖规则已更新（可选，用于显示状态）
        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (overrides) => {
              // 触发自定义事件通知页面覆盖规则已更新
              window.dispatchEvent(new CustomEvent('importMapOverrideUpdated', {
                detail: { overrides }
              }));
              
              console.log('Import Map Overrider: 网络拦截规则已生效，刷新页面后将使用新的模块 URL');
            },
            args: [this.overrides]
          });
        } catch (scriptError) {
          // 忽略脚本注入错误，不影响主要功能
          console.warn('Import Map Overrider: 无法通知页面更新状态', scriptError);
        }
      } else {
        console.error('Import Map Overrider: 更新网络拦截规则失败', response);
      }
    } catch (error) {
      console.error('应用覆盖规则失败:', error);
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
