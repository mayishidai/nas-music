# 📸 系统截图说明

本文档说明如何为项目添加真实的系统运行截图。

## 📋 需要的截图

### 1. 主页面 (Homepage)
- **文件名**: `screenshots/homepage.png`
- **尺寸**: 800x450 像素
- **内容**: 显示应用的主页面，包括侧边栏导航和主要内容区域
- **描述**: 展示应用的整体布局和导航结构

### 2. 音乐列表 (Music List)
- **文件名**: `screenshots/music-list.png`
- **尺寸**: 800x450 像素
- **内容**: 显示音乐列表页面，包含搜索框、音乐列表和播放器
- **描述**: 展示音乐管理的主要功能

### 3. 专辑管理 (Album Management)
- **文件名**: `screenshots/album-management.png`
- **尺寸**: 800x450 像素
- **内容**: 显示专辑列表或专辑详情页面
- **描述**: 展示专辑分类和管理功能

### 4. 设置页面 (Settings)
- **文件名**: `screenshots/settings.png`
- **尺寸**: 800x450 像素
- **内容**: 显示设置页面，包括媒体库管理、数据同步等功能
- **描述**: 展示系统配置和管理功能

## 📁 目录结构

```
project-root/
├── screenshots/
│   ├── homepage.png
│   ├── music-list.png
│   ├── album-management.png
│   └── settings.png
├── README.md
├── README.en.md
└── SCREENSHOTS.md
```

## 🔧 如何替换占位符

### 1. 创建截图目录
```bash
mkdir screenshots
```

### 2. 拍摄系统截图
使用截图工具（如 Snipaste、ShareX 等）拍摄应用界面截图。

### 3. 调整图片尺寸
使用图片编辑工具将截图调整为 800x450 像素：
- **在线工具**: [Canva](https://www.canva.com/), [Pixlr](https://pixlr.com/)
- **桌面软件**: Photoshop, GIMP, Paint.NET

### 4. 更新 README 文件
将 README.md 和 README.en.md 中的占位符链接替换为实际图片：

```markdown
<!-- 替换前 -->
![主页面](https://via.placeholder.com/800x450/2c3e50/ffffff?text=主页面+Homepage)

<!-- 替换后 -->
![主页面](./screenshots/homepage.png)
```

## 📱 截图建议

### 最佳实践
1. **选择合适的分辨率**: 确保截图清晰，文字可读
2. **展示核心功能**: 重点展示应用的主要功能和特色
3. **保持一致性**: 所有截图使用相同的尺寸和风格
4. **避免敏感信息**: 确保截图中不包含个人信息或敏感数据

### 截图工具推荐
- **Windows**: Snipaste, ShareX, Windows 截图工具
- **macOS**: 系统截图工具, Skitch
- **Linux**: Flameshot, Spectacle
- **在线工具**: [Screenshot.net](https://screenshot.net/)

## 🎨 图片优化

### 文件格式
- **推荐**: PNG 格式（支持透明背景，质量好）
- **备选**: JPEG 格式（文件更小，适合照片）

### 文件大小
- **目标**: 每张截图不超过 500KB
- **优化工具**: TinyPNG, ImageOptim

### 压缩建议
```bash
# 使用 ImageOptim (macOS)
# 或使用在线工具优化图片大小
```

## 📝 更新说明

当添加新的截图后，请更新以下文件：
1. `README.md` - 中文说明文档
2. `README.en.md` - 英文说明文档
3. `SCREENSHOTS.md` - 本说明文档

## 🔄 版本控制

建议将截图文件添加到版本控制中：
```bash
git add screenshots/
git commit -m "Add system screenshots"
```

这样可以确保项目文档的完整性和一致性。
