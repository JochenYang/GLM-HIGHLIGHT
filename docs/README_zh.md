<div align="center">
  <h1>
    <img src="../img/logo.png" alt="GLM关键词高亮" width="128" height="128" />
    <br>
    GLM关键词高亮
  </h1>
  <p>专业网页文本高亮工具，支持多分类管理、自定义颜色、快捷键操作、右键菜单、拖拽排序、导入导出与分享码功能</p>
  <a href="../README.md">English</a> | 中文
</div>

[![版本](https://img.shields.io/badge/版本-1.0.8-blue.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/releases)
[![许可](https://img.shields.io/badge/许可-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![欢迎PR](https://img.shields.io/badge/PR-welcome-brightgreen.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/pulls)
[![问题](https://img.shields.io/badge/issues-welcome-orange.svg)](https://github.com/JochenYang/GLM-HIGHLIGHT/issues)

## 功能特点

### 多分类高亮管理
- 创建多个独立高亮分类，每个分类可单独配置和管理
- 通过开关按钮快速启用/禁用特定分类的高亮显示
- 直观的拖拽界面，轻松调整分类优先级和显示顺序
- 支持批量添加、编辑和删除关键词

### 高亮样式定制
- 提供多种预设颜色，满足不同场景需求
- 每个分类可设置不同颜色，提高视觉识别效率
- 高亮样式经过精心设计，确保可读性和美观性

### 高效操作方式
- 使用键盘快捷键快速添加(Alt+Shift+C)或删除(Alt+Shift+D)高亮
- 通过右键菜单快速将选中文本添加到高亮分类
- 自动处理空格分隔的多关键词，支持关键词去重

### 数据管理与共享
- 一键导出配置为JSON文件，方便备份和迁移
- 生成紧凑的分享码，轻松与他人共享高亮配置
- 通过导入导出功能，实现不同设备间的配置迁移

## 使用指南

### 基本操作
1. 点击工具栏中的扩展图标打开控制面板
2. 点击"新建"按钮创建高亮分类
3. 输入分类名称和关键词（多个关键词用空格分隔）
4. 选择高亮颜色，点击开关启用高亮
5. 浏览网页时，匹配的关键词将自动高亮显示

### 快捷操作
- 选中网页文本后按Alt+Shift+C（Mac上为MacCtrl+Shift+C）添加到高亮分类
- 选中已高亮文本后按Alt+Shift+D（Mac上为MacCtrl+Shift+D）移除高亮
- 右键选中文本，从菜单中选择"添加到高亮分类"
- 拖动分类卡片调整显示顺序

### 数据管理
- 点击"导出"按钮备份当前配置
- 点击"导入"按钮恢复之前的配置
- 点击"分享"生成分享码，复制后可分享给他人
- 点击"去重"自动清理重复的关键词

## 隐私说明

- 扩展仅在用户授权的网页上运行
- 所有数据存储在本地，仅通过Chrome同步服务同步
- 不收集用户个人信息或浏览历史
- 无需任何额外权限或第三方服务

## 开源许可

本项目采用 [Apache License 2.0](./LICENSE)

有关完整的许可证文本，请参阅 [LICENSE](./LICENSE) 文件。

## 技术特性

- 基于 Manifest V3 开发，符合Chrome最新扩展标准
- 使用 DOM 观察器实现动态内容高亮，支持AJAX加载的内容
- 优化的Range API实现，提供高性能文本处理
- 完善的国际化支持，支持中英文界面
- 精心设计的缓存机制，减少资源占用
- 响应式用户界面，适应不同屏幕尺寸

## 问题反馈

如有问题或建议，请通过以下方式反馈：

1. 提交 GitHub Issue
2. 发送邮件至 [297390763@qq.com]

更新内容详情请见 Releases。
