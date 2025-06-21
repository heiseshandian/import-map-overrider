# Import Map Overrider

一个强大的 Chrome 扩展，用于显示和覆盖网页中的 ES Module Import Maps。

## 功能特性

### 🔍 Import Map 检测与显示
- 自动检测页面中的所有 `<script type="importmap">` 标签
- 清晰展示每个 Import Map 的内容，包括 `imports` 和 `scopes`
- 支持动态添加的 Import Maps 检测
- 区分原始 Import Maps 和覆盖规则

### ⚡ 实时覆盖功能
- 一键覆盖任何包的导入路径
- 支持添加自定义的包覆盖规则
- 覆盖规则持久化存储，跨页面生效
- 实时应用覆盖，无需刷新页面

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
1. 在"添加覆盖规则"区域填写：
   - **包名**：要覆盖的包名（如 `react`、`lodash`）
   - **新的 URL**：新的包地址（如 `https://esm.sh/react@18.2.0`）
2. 点击"添加覆盖"按钮
3. 覆盖规则立即生效

### 管理覆盖规则
- **查看当前规则**：在"当前覆盖规则"区域查看所有生效的覆盖
- **删除单个规则**：点击规则旁的"删除"按钮
- **清空所有规则**：点击"清除所有"按钮

## 技术实现

### 架构设计
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Popup UI      │    │  Content Script  │    │ Injected Script │
│   (popup.js)    │◄──►│   (content.js)   │◄──►│  (injected.js)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Chrome Storage  │    │   DOM Observer   │    │  Page Context   │
│   (持久化)       │    │   (监听变化)     │    │   (深度集成)     │
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

#### 3. Injected Script (`injected.js`)
- 页面主世界上下文操作
- 深度 Import Map 拦截
- 动态创建监听
- 全局 API 暴露

### 覆盖机制

扩展通过以下方式实现 Import Map 覆盖：

1. **优先级覆盖**：在页面头部插入新的 `<script type="importmap">` 标签
2. **位置策略**：覆盖脚本插入在原始 Import Maps 之前，确保优先级
3. **动态监听**：使用 MutationObserver 监听 DOM 变化，处理动态添加的 Import Maps
4. **持久化存储**：使用 Chrome Storage API 保存覆盖规则

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
"lodash": "https://cdn.skypack.dev/lodash"     // 原始
"lodash": "https://esm.sh/lodash"             // 切换 CDN
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
├── injected.js           # 注入脚本
└── README.md             # 说明文档
```

### 权限说明
- `activeTab`：访问当前活动标签页
- `storage`：存储覆盖规则
- `scripting`：注入脚本到页面
- `<all_urls>`：在所有网站上工作

## 故障排除

### 常见问题

**Q: 覆盖规则不生效？**
A: 确保：
- 包名拼写正确
- URL 格式正确且可访问
- 页面确实使用了 Import Maps
- 尝试刷新页面

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

### v1.0.0
- 初始版本发布
- 基本的 Import Map 检测和显示
- 覆盖规则添加和管理
- 持久化存储支持
- 动态 Import Map 监听