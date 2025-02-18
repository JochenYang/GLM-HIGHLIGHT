<div align="center">
  <h1>
    <img src="../img/logo.png" alt="GLM-HIGHLIGHT" width="128" />
    <br>
    多功能文本高亮扩展
    <br>
    <a href="../README.md">English</a>
  </h1>
</div>

[![版本](https://img.shields.io/badge/版本-1.0.0-blue.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/releases)
[![许可](https://img.shields.io/badge/许可-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![欢迎PR](https://img.shields.io/badge/PR-welcome-brightgreen.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/pulls)
[![问题](https://img.shields.io/badge/issues-welcome-orange.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/issues)

一个强大的 Chrome 浏览器扩展，用于网页文本高亮管理。支持多分类、快捷键操作、高亮同步等功能。

## 主要功能

- 🎨 多分类高亮管理

  - 支持创建多个高亮分类
  - 每个分类可设置不同颜色
  - 分类支持重命名和删除

- 🔍 智能文本高亮

  - 实时高亮匹配文本
  - 支持网页动态内容高亮
  - 优化的性能和内存使用

- ⌨️ 快捷操作

  - 快捷键添加高亮
  - 右键菜单快速操作
  - 一键清除所有高亮

- 🔄 数据同步

  - 跨设备同步高亮设置
  - 导入/导出高亮配置
  - 自动保存高亮状态

## 安装使用

1. 从 Chrome 网上应用店安装扩展
2. 点击工具栏的扩展图标打开控制面板
3. 创建高亮分类并设置关键词
4. 在网页中选中文本，使用快捷键或右键菜单添加高亮

## 快捷键

- `Alt + Shift + C`: 将选中文本添加到高亮分类
- `Alt + Shift + D`: 移除选中文本的高亮

## 技术特性

- 使用 Manifest V3 开发
- 基于 DOM 观察器实现动态内容高亮
- 批处理机制优化性能
- 安全的跨域消息通信
- 响应式用户界面

## 开发说明

1、目前不支持多语言，仅支持中文

### 项目结构

```
GLM-HIGHLIGHTER
├── manifest.json # 扩展配置文件
├── js/
│ ├── background.js # 后台服务
│ ├── content-action.js # 内容脚本
│ ├── highlighter.js # 高亮核心实现
│ └── utils.js # 工具函数
├── popup/ # 弹出窗口相关
└── locales/ # 国际化资源
```

## 隐私说明

- 扩展仅在用户授权的网页上运行
- 不收集用户个人信息
- 所有数据存储在本地，仅通过 Chrome 同步服务同步

## 许可证

MIT License

## 问题反馈

如有问题或建议，请通过以下方式反馈：

1. 提交 GitHub Issue
2. 发送邮件至 [297390763@qq.com]

更新内容详情请见 Releases。
