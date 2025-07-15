# Import Map Overrider

一个强大的 Chrome 扩展，用于显示和覆盖网页中的 ES Module Import Maps。

## 功能特性

### 🔍 Import Map 检测与显示
- 自动检测页面中的所有 `<script type="importmap">` 标签
- 清晰展示每个 Import Map 的内容，包括 `imports` 和 `scopes`
- 支持动态添加的 Import Maps 检测
- 区分原始 Import Maps 和覆盖规则

### ⚡ 网络拦截覆盖功能
- 一键覆盖任何包的导入路径
- 支持添加自定义的包覆盖规则
- 覆盖规则持久化存储，跨页面生效
- 使用 Service Worker 拦截网络请求实现覆盖
- 🔗 **智能依赖处理**：自动处理相关依赖包的版本兼容性
- 🎯 **精确 URL 重定向**：支持直接从 oldUrl 307 重定向到 newUrl

### 🎯 开发者友好
- 直观的用户界面，易于使用
- 支持快速覆盖（点击包名旁的"覆盖"按钮）
- 覆盖规则管理（添加、删除、清空）
- 详细的错误提示和状态反馈

## 安装方法

### 开发者模式安装
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目的文件夹
6. 扩展安装完成！

## 使用指南

### 基本使用
1. 访问任何使用了 Import Maps 的网页
2. 点击浏览器工具栏中的扩展图标
3. 查看页面中检测到的所有 Import Maps
4. 点击任何包旁边的"覆盖"按钮来快速设置覆盖规则

### 添加覆盖规则

#### 🎯 精确 URL 重定向模式
1. 在"添加覆盖规则"区域填写：
   - **规则名称**：自定义规则名称（如 `my-redirect-rule`）
   - **旧 URL**：要重定向的完整 URL（如 `https://esm.sh/lodash@4.17.21`）
   - **新 URL**：目标 URL（如 `https://cdn.skypack.dev/lodash@4.17.21`）
2. 点击"添加覆盖"按钮
3. **刷新页面**使 Service Worker 拦截规则生效

### 管理覆盖规则
- **查看当前规则**：在"当前覆盖规则"区域查看所有生效的覆盖
- **删除单个规则**：点击规则旁的"删除"按钮
- **清空所有规则**：点击"清除所有"按钮

## 技术实现

### 架构设计
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Popup UI      │    │  Content Script  │    │ Service Worker  │
│   (popup.js)    │◄──►│   (content.js)   │◄──►│ (background.js) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Chrome Storage  │    │   DOM Observer   │    │ Network Intercept│
│   (持久化)       │    │   (监听变化)     │    │   (请求拦截)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 核心组件

#### 1. Popup Interface (`popup.js`)
- 用户交互界面
- Import Maps 展示
- 覆盖规则管理
- 与 Content Script 通信

#### 2. Content Script (`content.js`)
- 页面级别的 Import Map 检测
- DOM 变化监听
- 覆盖规则应用
- 消息传递桥梁

#### 3. Service Worker (`background.js`)
- 网络请求拦截和重定向
- 动态规则管理
- 跨页面覆盖规则应用
- 后台持续运行

### 覆盖机制

扩展通过以下方式实现 Import Map 覆盖：

1. **网络拦截**：使用 Service Worker 的 declarativeNetRequest API 拦截网络请求
2. **URL 重定向**：将匹配的模块请求重定向到指定的新 URL
3. **动态规则**：根据用户配置动态创建和更新拦截规则
4. **持久化存储**：使用 Chrome Storage API 保存覆盖规则
5. **精确匹配**：直接匹配完整 URL，确保精确控制

## 常见用例

### 1. 开发环境调试
```javascript
// 原始 Import Map
{
  "imports": {
    "react": "https://cdn.skypack.dev/react@17.0.2"
  }
}

// 覆盖为本地开发版本
{
  "imports": {
    "react": "http://localhost:3000/react.development.js"
  }
}
```

### 2. 版本切换测试
```javascript
// 快速切换不同版本进行兼容性测试
"react": "https://esm.sh/react@18.2.0"  // 测试新版本
"react": "https://esm.sh/react@17.0.2"  // 回退到稳定版本
```

### 3. CDN 切换
```javascript
// 从一个 CDN 切换到另一个
// 旧 URL: "https://cdn.skypack.dev/lodash@4.17.21"
// 新 URL: "https://esm.sh/lodash@4.17.21"
```

## 兼容性

- **浏览器**：Chrome 88+ (Manifest V3)
- **网页**：支持 ES Modules 和 Import Maps 的现代浏览器
- **框架**：与所有使用 Import Maps 的框架兼容

## 开发说明

### 项目结构
```
import-map-overrider/
├── manifest.json          # 扩展配置文件
├── popup.html            # 弹窗界面
├── popup.js              # 弹窗逻辑
├── content.js            # 内容脚本
├── background.js         # Service Worker
├── test.html             # 测试页面
└── README.md             # 说明文档
```

### 权限说明
- `activeTab`：访问当前活动标签页
- `storage`：存储覆盖规则
- `scripting`：注入脚本到页面
- `declarativeNetRequest`：拦截和重定向网络请求
- `declarativeNetRequestWithHostAccess`：访问主机权限
- `<all_urls>`：在所有网站上工作

## 故障排除

### 常见问题

**Q: 覆盖规则不生效？**
A: 确保：
- 包名拼写正确
- URL 格式正确且可访问
- 页面确实使用了 Import Maps
- **已刷新页面**（Service Worker 拦截需要页面重新加载）
- 检查开发者工具的 Network 标签页，确认请求被重定向

**Q: 更新包版本后出现依赖错误？**
A: 这通常是依赖包版本不兼容导致的：
- 需要手动添加依赖包的覆盖规则
- 例如：将 `vue-demi` 的完整 URL 重定向为兼容的版本

**Q: Vue Router 导出错误（useRouter 等）？**
A: 这通常是构建版本不匹配导致的：
- 需要手动添加 vue-router 的重定向规则
- Vue 3.x 需要使用 vue-router 4.x 的 ESM 浏览器构建版本
- 确保新 URL 包含 `esm-browser.js` 后缀

**Q: 检测不到 Import Maps？**
A: 可能原因：
- 页面没有使用 Import Maps
- Import Maps 是动态加载的（稍等片刻后点击刷新）
- 页面使用了非标准的模块加载方式

**Q: 扩展图标是灰色的？**
A: 检查：
- 扩展是否正确安装
- 是否在支持的网站上
- 浏览器是否支持 Manifest V3

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境设置
1. Clone 项目
2. 在 Chrome 中加载扩展
3. 修改代码后重新加载扩展
4. 测试功能

## 许可证

MIT License - 详见 LICENSE 文件

## 更新日志

### v3.0.0
- **重大更新**：简化为精确 URL 重定向模式
- 移除包名映射功能，专注于精确 URL 控制
- 更直观的用户界面和使用方式
- 提高重定向的可预测性和准确性

### v2.0.0
- **重大更新**：改用 Service Worker 网络拦截方式实现覆盖
- 更稳定的覆盖机制，不受浏览器 Import Map 解析限制
- 优化用户界面，添加工作原理说明

### v1.0.0
- 初始版本发布
- 基本的 Import Map 检测和显示
- 覆盖规则添加和管理（基于 Import Map 注入）
- 持久化存储支持
- 动态 Import Map 监听

