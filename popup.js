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

    // Search functionality
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
      console.error("Failed to get import maps:", error);
      this.showError("Unable to get page import maps");
    }
  }

  renderImportMaps() {
    const container = document.getElementById("importMaps");

    if (this.importMaps.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div>No Import Maps found</div>
          <div style="font-size: 12px; margin-top: 8px; color: #999;">
            This page may not be using ES Module Import Maps
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
            Override
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
              Toggle Display
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

    // Apply current search filter
    const searchInput = document.getElementById("searchInput");
    if (searchInput && searchInput.value) {
      this.filterImportMaps(searchInput.value);
    }
  }

  filterImportMaps(searchTerm) {
    const container = document.getElementById("importMaps");
    const importMapItems = container.querySelectorAll(".import-map-item");

    if (!searchTerm.trim()) {
      // Show all items
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

      // If this import map has visible import items, show the entire map
      if (hasVisibleImports) {
        mapItem.classList.remove("hidden");
      } else {
        mapItem.classList.add("hidden");
      }
    });

    // Show or hide "no results" message
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
      <div>No results found for "${this.escapeHtml(searchTerm)}"</div>
      <div style="font-size: 12px; margin-top: 4px; color: #999;">
        Try searching for other package names or URLs
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

    // Check required fields
    if (!packageName) {
      alert("Please enter rule name");
      return;
    }

    if (!oldUrl) {
      alert("Old URL is required");
      return;
    }

    if (!newUrl) {
      alert("Please enter new URL");
      return;
    }

    // Only support new format: URL redirection
    this.overrides[packageName] = { oldUrl, newUrl };

    await this.saveOverrides();
    await this.applyOverrides();

    // Clear input fields
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
    if (confirm("Are you sure you want to clear all override rules?")) {
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
          <div style="color: #666; font-size: 12px;">No override rules</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="overrides-list">
        ${overrideEntries
          .map(([name, override]) => {
            // Only support new format: URL redirection
            return `
                <div class="override-item">
                  <div>
                    <div class="import-name">${this.escapeHtml(name)}</div>
                    <div class="import-url" style="font-size: 10px; color: #888;">From: ${this.escapeHtml(
          override.oldUrl
        )}</div>
        <div class="import-url">To: ${this.escapeHtml(
          override.newUrl
        )}</div>
                  </div>
                  <button class="remove-btn" data-package-name="${this.escapeHtml(
                    name
                  )}">
                    Delete
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
      // Update network interception rules through Service Worker
      const response = await chrome.runtime.sendMessage({
        type: "UPDATE_OVERRIDES",
        overrides: this.overrides,
      });

      if (response && response.success) {
        console.log("Import Map Overrider: Updated network interception rules", this.overrides);

        // Notify current page that override rules have been updated (optional, for status display)
        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (overrides) => {
              // Trigger custom event to notify page that override rules have been updated
              window.dispatchEvent(
                new CustomEvent("importMapOverrideUpdated", {
                  detail: { overrides },
                })
              );

              console.log(
                "Import Map Overrider: Network interception rules are now active, new module URLs will be used after page refresh"
              );
            },
            args: [this.overrides],
          });
        } catch (scriptError) {
         // Ignore script injection errors, does not affect main functionality
            console.warn(
              "Import Map Overrider: Unable to notify page of update status",
              error
            );
        }
      } else {
        console.error("Import Map Overrider: Failed to update network interception rules", response);
      }
    } catch (error) {
      console.error("Failed to apply override rules:", error);
    }
  }

  async loadOverrides() {
    try {
      const result = await chrome.storage.local.get(["importMapOverrides"]);
      this.overrides = result.importMapOverrides || {};
    } catch (error) {
      console.error("Failed to load override rules:", error);
      this.overrides = {};
    }
  }

  async saveOverrides() {
    try {
      await chrome.storage.local.set({ importMapOverrides: this.overrides });
    } catch (error) {
      console.error("Failed to save override rules:", error);
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
      // Get current page's importmap data
      const currentImportMaps = {};
      this.importMaps.forEach((importMap) => {
        if (importMap.content && importMap.content.imports) {
          Object.assign(currentImportMaps, importMap.content.imports);
        }
      });

      // Debug: Can be uncommented during development
      // console.log('Selected Import Map:', currentImportMaps);
      // console.log('Import Maps count:', Object.keys(currentImportMaps).length);

      // Store to chrome.storage.local
      await chrome.storage.local.set({ selectedImportMap: currentImportMaps });

      // Show success message
      this.showSuccess(
        `Current page's Import Map has been selected for comparison (${
          Object.keys(currentImportMaps).length
        } packages)`
      );
    } catch (error) {
      this.showError("Failed to select Import Map: " + error.message);
    }
  }

  async compareWithSelected() {
    try {
      // Get previously stored importmap
      const result = await chrome.storage.local.get(["selectedImportMap"]);
      const selectedImportMap = result.selectedImportMap;

      if (!selectedImportMap) {
        this.showError("Please select an Import Map for comparison first");
        return;
      }

      // Get current page's importmap
      const currentImportMaps = {};
      this.importMaps.forEach((importMap) => {
        if (importMap.content && importMap.content.imports) {
          Object.assign(currentImportMaps, importMap.content.imports);
        }
      });

      // Debug: Can be uncommented during development
      // console.log('Selected Import Map:', selectedImportMap);
      // console.log('Current Import Map:', currentImportMaps);
      // console.log('Selected keys:', Object.keys(selectedImportMap));
      // console.log('Current keys:', Object.keys(currentImportMaps));

      // Compare two importmaps
      const diff = this.compareImportMaps(selectedImportMap, currentImportMaps);

      // console.log('Diff result:', diff);

      // Display comparison results
      this.displayCompareResults(diff);
    } catch (error) {
      this.showError("Failed to compare Import Map: " + error.message);
    }
  }

  compareImportMaps(selected, current) {
    const diff = {
      added: {},
      removed: {},
      changed: {},
    };

    // Ensure input parameters are objects
    if (!selected || typeof selected !== "object") {
      console.warn("Selected import map is not a valid object:", selected);
      selected = {};
    }
    if (!current || typeof current !== "object") {
      console.warn("Current import map is not a valid object:", current);
      current = {};
    }

    // Debug: Can be uncommented during development
    // console.log('Comparing:', {
    //   selectedKeys: Object.keys(selected),
    //   currentKeys: Object.keys(current),
    //   selectedCount: Object.keys(selected).length,
    //   currentCount: Object.keys(current).length
    // });

    // Find added packages
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

    // Find removed packages
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
        "<div style='text-align: center; color: #28a745; padding: 20px;'>✅ The two Import Maps are identical</div>";
    } else {
      // Add summary information
      html += `<div style='background: #e3f2fd; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px;'>`;
      html += `📊 <strong>Comparison Summary:</strong> `;
      if (addedCount > 0) html += `Added ${addedCount} packages `;
      if (removedCount > 0) html += `Removed ${removedCount} packages `;
      if (changedCount > 0) html += `Changed ${changedCount} packages`;
      html += `</div>`;
      if (Object.keys(diff.added).length > 0) {
        html +=
          "<h4 style='color: #155724; margin: 12px 0 8px 0;'>🆕 Added Packages:</h4>";
        for (const [name, url] of Object.entries(diff.added)) {
          html += `<div class='diff-item diff-added'>+ ${this.escapeHtml(
            name
          )}: ${this.escapeHtml(url)}</div>`;
        }
      }

      if (Object.keys(diff.removed).length > 0) {
        html +=
          "<h4 style='color: #721c24; margin: 12px 0 8px 0;'>🗑️ Removed Packages:</h4>";
        for (const [name, url] of Object.entries(diff.removed)) {
          html += `<div class='diff-item diff-removed'>- ${this.escapeHtml(
            name
          )}: ${this.escapeHtml(url)}</div>`;
        }
      }

      if (Object.keys(diff.changed).length > 0) {
        html +=
          "<h4 style='color: #856404; margin: 12px 0 8px 0;'>🔄 Changed Packages:</h4>";
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

    // Scroll to comparison results area
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

// Global instance
let importMapOverrider;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  importMapOverrider = new ImportMapOverrider();
  // Expose instance to window object to ensure onclick events can access it
  window.importMapOverrider = importMapOverrider;
});
