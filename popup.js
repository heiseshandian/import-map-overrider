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

    document
      .getElementById("selectForCompareBtn")
      .addEventListener("click", () => {
        this.selectForCompare();
      });

    document
      .getElementById("compareWithSelectedBtn")
      .addEventListener("click", () => {
        this.compareWithSelected();
      });

    document.getElementById("closeCompareBtn").addEventListener("click", () => {
      this.closeCompareResults();
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
          .map(([name, override]) => {
            // 只支持新格式：URL 重定向
            return `
                <div class="override-item">
                  <div>
                    <div class="import-name">${this.escapeHtml(name)}</div>
                    <div class="import-url" style="font-size: 10px; color: #888;">从: ${this.escapeHtml(
                      override.oldUrl
                    )}</div>
                    <div class="import-url">到: ${this.escapeHtml(
                      override.newUrl
                    )}</div>
                  </div>
                  <button class="remove-btn" data-package-name="${this.escapeHtml(
                    name
                  )}">
                    删除
                  </button>
                </div>
              `;
          })
          .join("")}
      </div>
    `;
  }

  async applyOverrides() {
    try {
      // 通过 Service Worker 更新网络拦截规则
      const response = await chrome.runtime.sendMessage({
        type: "UPDATE_OVERRIDES",
        overrides: this.overrides,
      });

      if (response && response.success) {
        console.log("Import Map Overrider: 已更新网络拦截规则", this.overrides);

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
              window.dispatchEvent(
                new CustomEvent("importMapOverrideUpdated", {
                  detail: { overrides },
                })
              );

              console.log(
                "Import Map Overrider: 网络拦截规则已生效，刷新页面后将使用新的模块 URL"
              );
            },
            args: [this.overrides],
          });
        } catch (scriptError) {
          // 忽略脚本注入错误，不影响主要功能
          console.warn(
            "Import Map Overrider: 无法通知页面更新状态",
            scriptError
          );
        }
      } else {
        console.error("Import Map Overrider: 更新网络拦截规则失败", response);
      }
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

  async selectForCompare() {
    try {
      // 获取当前页面的importmap数据
      const currentImportMaps = {};
      this.importMaps.forEach((importMap) => {
        if (importMap.content && importMap.content.imports) {
          Object.assign(currentImportMaps, importMap.content.imports);
        }
      });

      // Debug: 可以在开发时取消注释
      // console.log('Selected Import Map:', currentImportMaps);
      // console.log('Import Maps count:', Object.keys(currentImportMaps).length);

      // 存储到chrome.storage.local
      await chrome.storage.local.set({ selectedImportMap: currentImportMaps });

      // 显示成功消息
      this.showSuccess(
        `当前页面的 Import Map 已选择用于比较 (${
          Object.keys(currentImportMaps).length
        } 个包)`
      );
    } catch (error) {
      this.showError("选择 Import Map 失败: " + error.message);
    }
  }

  async compareWithSelected() {
    try {
      // 获取之前存储的importmap
      const result = await chrome.storage.local.get(["selectedImportMap"]);
      const selectedImportMap = result.selectedImportMap;

      if (!selectedImportMap) {
        this.showError("请先选择一个 Import Map 用于比较");
        return;
      }

      // 获取当前页面的importmap
      const currentImportMaps = {};
      this.importMaps.forEach((importMap) => {
        if (importMap.content && importMap.content.imports) {
          Object.assign(currentImportMaps, importMap.content.imports);
        }
      });

      // Debug: 可以在开发时取消注释
      // console.log('Selected Import Map:', selectedImportMap);
      // console.log('Current Import Map:', currentImportMaps);
      // console.log('Selected keys:', Object.keys(selectedImportMap));
      // console.log('Current keys:', Object.keys(currentImportMaps));

      // 比较两个importmap
      const diff = this.compareImportMaps(selectedImportMap, currentImportMaps);

      // console.log('Diff result:', diff);

      // 显示比较结果
      this.displayCompareResults(diff);
    } catch (error) {
      this.showError("比较 Import Map 失败: " + error.message);
    }
  }

  compareImportMaps(selected, current) {
    const diff = {
      added: {},
      removed: {},
      changed: {},
    };

    // 确保输入参数是对象
    if (!selected || typeof selected !== "object") {
      console.warn("Selected import map is not a valid object:", selected);
      selected = {};
    }
    if (!current || typeof current !== "object") {
      console.warn("Current import map is not a valid object:", current);
      current = {};
    }

    // Debug: 可以在开发时取消注释
    // console.log('Comparing:', {
    //   selectedKeys: Object.keys(selected),
    //   currentKeys: Object.keys(current),
    //   selectedCount: Object.keys(selected).length,
    //   currentCount: Object.keys(current).length
    // });

    // 找出新增的包
    for (const [name, url] of Object.entries(current)) {
      if (!selected.hasOwnProperty(name)) {
        diff.added[name] = url;
        // console.log('Added:', name, url);
      } else if (selected[name] !== url) {
        diff.changed[name] = {
          old: selected[name],
          new: url,
        };
        // console.log('Changed:', name, 'from', selected[name], 'to', url);
      }
    }

    // 找出删除的包
    for (const [name, url] of Object.entries(selected)) {
      if (!current.hasOwnProperty(name)) {
        diff.removed[name] = url;
        // console.log('Removed:', name, url);
      }
    }

    // console.log('Final diff:', diff);
    return diff;
  }

  displayCompareResults(diff) {
    const compareSection = document.getElementById("compareSection");
    const compareResults = document.getElementById("compareResults");

    // console.log('Displaying results for diff:', diff);

    let html = "";

    const addedCount = Object.keys(diff.added).length;
    const removedCount = Object.keys(diff.removed).length;
    const changedCount = Object.keys(diff.changed).length;

    // console.log('Counts:', { addedCount, removedCount, changedCount });

    if (addedCount === 0 && removedCount === 0 && changedCount === 0) {
      html =
        "<div style='text-align: center; color: #28a745; padding: 20px;'>✅ 两个 Import Map 完全相同</div>";
    } else {
      // 添加总结信息
      html += `<div style='background: #e3f2fd; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px;'>`;
      html += `📊 <strong>比较结果总结:</strong> `;
      if (addedCount > 0) html += `新增 ${addedCount} 个包 `;
      if (removedCount > 0) html += `删除 ${removedCount} 个包 `;
      if (changedCount > 0) html += `变更 ${changedCount} 个包`;
      html += `</div>`;
      if (Object.keys(diff.added).length > 0) {
        html +=
          "<h4 style='color: #155724; margin: 12px 0 8px 0;'>🆕 新增的包:</h4>";
        for (const [name, url] of Object.entries(diff.added)) {
          html += `<div class='diff-item diff-added'>+ ${this.escapeHtml(
            name
          )}: ${this.escapeHtml(url)}</div>`;
        }
      }

      if (Object.keys(diff.removed).length > 0) {
        html +=
          "<h4 style='color: #721c24; margin: 12px 0 8px 0;'>🗑️ 删除的包:</h4>";
        for (const [name, url] of Object.entries(diff.removed)) {
          html += `<div class='diff-item diff-removed'>- ${this.escapeHtml(
            name
          )}: ${this.escapeHtml(url)}</div>`;
        }
      }

      if (Object.keys(diff.changed).length > 0) {
        html +=
          "<h4 style='color: #856404; margin: 12px 0 8px 0;'>🔄 版本变更的包:</h4>";
        for (const [name, change] of Object.entries(diff.changed)) {
          html += `<div class='diff-item diff-changed'>~ ${this.escapeHtml(
            name
          )}:</div>`;
          html += `<div class='diff-item diff-removed' style='margin-left: 20px;'>- ${this.escapeHtml(
            change.old
          )}</div>`;
          html += `<div class='diff-item diff-added' style='margin-left: 20px;'>+ ${this.escapeHtml(
            change.new
          )}</div>`;
        }
      }
    }

    compareResults.innerHTML = html;
    compareSection.style.display = "block";

    // 滚动到比较结果区域
    compareSection.scrollIntoView({ behavior: "smooth" });
  }

  closeCompareResults() {
    document.getElementById("compareSection").style.display = "none";
  }

  showSuccess(message) {
    const successDiv = document.createElement("div");
    successDiv.style.cssText = `
      position: fixed; top: 10px; right: 10px; background: #4caf50; color: white;
      padding: 10px; border-radius: 4px; z-index: 1000;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
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
