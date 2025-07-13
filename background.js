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
      if (namespace === 'local' && changes.importMapOverrides) {
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

    console.log('Import Map Service Worker: 已初始化');
  }

  async loadOverrides() {
    try {
      const result = await chrome.storage.local.get(['importMapOverrides']);
      this.overrides = result.importMapOverrides || {};
    } catch (error) {
      console.error('Import Map Service Worker: 加载覆盖规则失败', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'UPDATE_OVERRIDES':
        this.overrides = message.overrides || {};
        await this.updateNetworkRules();
        sendResponse({ success: true });
        break;
      case 'GET_OVERRIDES':
        sendResponse({ overrides: this.overrides });
        break;
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  async updateNetworkRules() {
    try {
      // 清除现有的动态规则
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIdsToRemove = existingRules.map(rule => rule.id);
      
      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove
        });
      }

      // 创建新的重定向规则
      const newRules = [];
      let ruleId = 1;

      for (const [packageName, newUrl] of Object.entries(this.overrides)) {
        // 为每个覆盖规则创建多个匹配模式
        const patterns = this.generateUrlPatterns(packageName);
        
        for (const pattern of patterns) {
          newRules.push({
            id: ruleId++,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: { url: newUrl }
            },
            condition: {
              urlFilter: pattern,
              resourceTypes: ['script', 'xmlhttprequest']
            }
          });
        }

        // 添加依赖包的自动映射规则
        const dependencyMappings = this.getDependencyMapping(packageName, newUrl);
        for (const [depPackageName, depNewUrl] of Object.entries(dependencyMappings)) {
          const depPatterns = this.generateUrlPatterns(depPackageName);
          
          for (const pattern of depPatterns) {
            newRules.push({
              id: ruleId++,
              priority: 1,
              action: {
                type: 'redirect',
                redirect: { url: depNewUrl }
              },
              condition: {
                urlFilter: pattern,
                resourceTypes: ['script', 'xmlhttprequest']
              }
            });
          }
        }
      }

      // 应用新规则
      if (newRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: newRules
        });
        console.log('Import Map Service Worker: 已更新网络规则', newRules);
      }

      this.dynamicRules = newRules;
    } catch (error) {
      console.error('Import Map Service Worker: 更新网络规则失败', error);
    }
  }

  generateUrlPatterns(packageName) {
    // 生成常见的 CDN URL 模式
    const patterns = [];
    
    // ESM.sh 模式
    patterns.push(`*://esm.sh/${packageName}@*`);
    patterns.push(`*://esm.sh/${packageName}`);
    patterns.push(`*://esm.sh/${packageName}/*`);
    
    // CDN.skypack.dev 模式
    patterns.push(`*://cdn.skypack.dev/${packageName}@*`);
    patterns.push(`*://cdn.skypack.dev/${packageName}`);
    patterns.push(`*://cdn.skypack.dev/${packageName}/*`);
    
    // unpkg.com 模式
    patterns.push(`*://unpkg.com/${packageName}@*`);
    patterns.push(`*://unpkg.com/${packageName}`);
    patterns.push(`*://unpkg.com/${packageName}/*`);
    
    // jsdelivr.net 模式
    patterns.push(`*://cdn.jsdelivr.net/npm/${packageName}@*`);
    patterns.push(`*://cdn.jsdelivr.net/npm/${packageName}`);
    patterns.push(`*://cdn.jsdelivr.net/npm/${packageName}/*`);
    
    // 通用模式 - 匹配任何包含包名的 URL
    patterns.push(`*://*/${packageName}@*`);
    patterns.push(`*://*/${packageName}/*`);
    
    return patterns;
  }

  // 获取依赖包的兼容版本映射
  getDependencyMapping(packageName, newUrl) {
    const mappings = {};
    
    // Vue 相关的依赖映射
    if (packageName === 'vue') {
      const versionMatch = newUrl.match(/vue@([\d\.]+)/);
      if (versionMatch) {
        const vueVersion = versionMatch[1];
        const [major, minor, patch] = vueVersion.split('.').map(Number);
        
        console.log(`Import Map Service Worker: 检测到 Vue 版本 ${vueVersion}`);
        
        const baseUrl = newUrl.replace(/\/vue@[\d\.]+.*$/, '');
        
        // Vue 3.5.16+ 需要更新的 vue-demi 版本
        if (major >= 3 && (minor > 5 || (minor === 5 && patch >= 16))) {
          mappings['vue-demi'] = `${baseUrl}/vue-demi@0.14.10/+esm`;
          console.log(`Import Map Service Worker: 自动映射 vue-demi 到版本 0.14.10`);
        } else if (major >= 3 && minor >= 5) {
          // Vue 3.5.0-3.5.15 使用稍旧的 vue-demi 版本
          mappings['vue-demi'] = `${baseUrl}/vue-demi@0.14.8/+esm`;
          console.log(`Import Map Service Worker: 自动映射 vue-demi 到版本 0.14.8`);
        }
        
        // Vue 3.x 对应的 vue-router 版本映射
        if (major >= 3) {
          mappings['vue-router'] = `${baseUrl}/vue-router@4.4.5/dist/vue-router.esm-browser.js`;
          console.log(`Import Map Service Worker: 自动映射 vue-router 到版本 4.4.5`);
        }
      }
    }
    
    // vue-router 独立映射（当用户直接覆盖 vue-router 时）
    if (packageName === 'vue-router') {
      const versionMatch = newUrl.match(/vue-router@([\d\.]+)/);
      if (versionMatch) {
        const routerVersion = versionMatch[1];
        console.log(`Import Map Service Worker: 检测到 vue-router 版本 ${routerVersion}`);
        
        // 确保使用正确的构建版本
        const baseUrl = newUrl.replace(/\/vue-router@[\d\.]+.*$/, '');
        if (!newUrl.includes('esm-browser')) {
          mappings['vue-router'] = `${baseUrl}/vue-router@${routerVersion}/dist/vue-router.esm-browser.js`;
          console.log(`Import Map Service Worker: 修正 vue-router 为 ESM 浏览器版本`);
        }
      }
    }
    
    return mappings;
  }

  // 获取当前活动的规则（用于调试）
  async getActiveRules() {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      return rules;
    } catch (error) {
      console.error('Import Map Service Worker: 获取活动规则失败', error);
      return [];
    }
  }
}

// 初始化 Service Worker
const importMapServiceWorker = new ImportMapServiceWorker();

// 导出实例供调试使用
if (typeof globalThis !== 'undefined') {
  globalThis.importMapServiceWorker = importMapServiceWorker;
}