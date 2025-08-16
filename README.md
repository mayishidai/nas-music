# NAS音乐服务器歌词插件系统

## 项目简介
这是一个为NAS音乐服务器开发的歌词搜索插件系统，支持通过多个音乐平台API获取歌词信息。系统包含以下核心功能：

- 支持多个音乐平台的歌词搜索服务
- 智能匹配算法选择最佳歌词结果
- 插件化架构便于扩展
- 歌词格式清理与标准化

目前支持的平台：
- 网易云音乐
- 咪咕音乐
- 酷狗音乐
- QQ音乐

## 主要特性
1. **多平台支持**：通过不同插件实现对多个音乐平台的歌词搜索
2. **智能匹配**：使用字符串相似度算法自动选择最匹配的歌词
3. **格式标准化**：统一不同平台的歌词格式，清理多余空行
4. **插件管理**：可动态注册/注销歌词插件
5. **错误处理**：完善的错误日志记录和异常处理机制

## 安装指南
1. 确保已安装Node.js和npm
2. 克隆仓库：
   ```bash
   git clone https://gitee.com/yanfanVIP/nas-music.git
   ```
3. 安装依赖：
   ```bash
   cd nas-music
   npm install
   ```
4. 配置API密钥（如需要）：
   ```bash
   # 在apikey文件中配置相关API密钥
   ```

## 使用方法
1. 初始化插件管理器：
   ```javascript
   const lyricsPluginManager = new LyricsPluginManager();
   ```

2. 搜索歌词：
   ```javascript
   // 使用所有插件搜索
   const results = await lyricsPluginManager.searchLyrics("歌曲名", "艺术家");
   
   // 使用指定插件搜索
   const result = await lyricsPluginManager.searchLyrics("歌曲名", "艺术家", "netease");
   ```

3. 获取插件信息：
   ```javascript
   const pluginInfo = lyricsPluginManager.getPluginInfo("migu");
   ```

## 插件开发
要添加新的歌词插件，只需：
1. 在`src/plugins/`目录创建新插件文件
2. 实现`getInfo()`和`searchLyrics()`方法
3. 在`LyricsPluginManager`中注册插件

## 技术架构
系统采用模块化设计，主要包含：
- 插件接口层：定义插件标准接口
- 网络请求层：处理HTTP请求
- 数据处理层：歌词格式清理和匹配算法
- 核心引擎：插件管理和调度

## 许可证
本项目采用MIT许可证，详细信息请查看LICENSE文件。