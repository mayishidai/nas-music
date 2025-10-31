#  原项目地址：
https://gitee.com/yanfanVIP/nas-music
导入github，只是为了使用github actions编译daocker镜像。

# 🎵 NAS 音乐服务器

一个功能强大的基于 Node.js 的音乐服务器，支持本地音乐管理、在线音乐搜索和数据同步功能。

## 📸 系统截图

### 主页面
![主页面](/screenimg/homepage.png)

### 专辑管理
![专辑管理](/screenimg/albumpage.png)

### 艺术家管理
![艺术家管理](/screenimg/artistpage.png)

### 设置页面
![设置页面](/screenimg/settingpage.png)

### 音乐详情
![音乐详情](/screenimg/musicdetail.png)

### 艺术家详情
![艺术家详情](/screenimg/artistdetail.png)

## ✨ 功能特性

### 🎵 本地音乐管理
- **📁 媒体库扫描**: 自动扫描本地音乐文件，支持多种音频格式
- **🏷️ 元数据提取**: 自动提取音乐文件的标签信息（标题、艺术家、专辑等）
- **📊 智能分类**: 按专辑、艺术家、流派等自动分类管理
- **🔄 数据同步**: 与在线音乐服务同步，获取更完整的音乐信息
- **❤️ 收藏功能**: 支持音乐收藏和播放历史记录

### 🔍 在线音乐搜索
- **🌐 多平台搜索**: 支持网易云音乐、QQ音乐、酷狗音乐等主流平台
- **🎯 智能匹配**: 基于本地音乐信息智能匹配在线资源
- **📝 歌词获取**: 自动获取和显示歌词信息
- **🖼️ 封面下载**: 自动下载专辑封面图片
- **💾 缓存机制**: 智能缓存搜索结果，提高响应速度

### 🎨 用户界面
- **🎨 现代化设计**: 采用现代化的UI设计，支持深色主题
- **📱 响应式布局**: 完美适配桌面端、平板和移动端
- **🔍 实时搜索**: 支持实时搜索和过滤功能
- **🎮 播放控制**: 集成音乐播放器，支持播放控制
- **📊 数据统计**: 实时显示音乐库统计信息

### 🔧 系统管理
- **⚙️ 设置管理**: 完整的系统设置界面
- **🔄 数据同步**: 一键同步本地与在线音乐数据
- **🔍 刮削功能**: 自动获取音乐元数据信息
- **📈 性能监控**: 内存使用和系统性能监控

## 🚀 快速开始

### 环境要求
- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器
- 支持的操作系统：Windows、macOS、Linux

### 安装步骤

1. **克隆项目**
```bash
git clone https://gitee.com/yanfanVIP/nas-music.git
cd nas-music-server
```

2. **安装依赖**
```bash
npm install
```

3. **启动服务器**
```bash
npm start
```

4. **访问应用**
打开浏览器访问 `http://localhost:3000`

### 开发模式
```bash
npm run dev
```

## 📁 项目结构

```
music-server/
├── src/                    # 后端源代码
│   ├── api/               # API 路由
│   ├── client/            # 数据库客户端
│   ├── middlewares/       # 中间件
│   ├── plugins/           # 插件系统
│   └── utils/             # 工具函数
├── web/                   # 前端源代码
│   ├── components/        # React 组件
│   ├── views/             # 页面组件
│   └── hooks/             # 自定义 Hooks
├── db/                    # 数据库文件
├── music/                 # 音乐文件目录
└── package.json           # 项目配置
```

## 🛠️ 技术栈

### 后端技术
- **Node.js**: 服务器运行环境
- **Koa**: Web 框架
- **SQLite**: 轻量级数据库
- **better-sqlite3**: SQLite 数据库驱动
- **music-metadata**: 音乐元数据解析

### 前端技术
- **React**: 用户界面框架
- **React Router**: 路由管理
- **CSS3**: 样式设计
- **Fetch API**: 网络请求

### 开发工具
- **Vite**: 前端构建工具
- **Nodemon**: 开发环境自动重启
- **ESLint**: 代码质量检查

## 📊 数据库设计

### 主要数据表
- **music**: 音乐文件信息
- **albums**: 专辑信息
- **artists**: 艺术家信息
- **online_music**: 在线音乐缓存
- **config**: 系统配置

### 在线音乐缓存机制
系统会自动将在线搜索的音乐结果缓存到 `online_music` 表中：

```sql
CREATE TABLE online_music (
  id TEXT PRIMARY KEY,           -- musicId + albumId 的 MD5 哈希
  musicId TEXT NOT NULL,         -- MusicBrainz 音乐 ID
  score INTEGER NOT NULL,        -- 搜索匹配度
  title TEXT NOT NULL,           -- 歌曲标题
  artist TEXT NOT NULL,          -- 艺术家
  album TEXT NOT NULL,           -- 专辑名称
  coverImage TEXT,               -- 专辑封面 URL
  lyrics TEXT,                   -- 歌词内容
  created_at TEXT,               -- 创建时间
  updated_at TEXT                -- 更新时间
)
```

## 🔌 API 接口

### 音乐管理
- `GET /api/music/tracks` - 获取音乐列表
- `GET /api/music/albums` - 获取专辑列表
- `GET /api/music/artists` - 获取艺术家列表
- `PUT /api/music/tracks/:id/favorite` - 设置收藏状态

### 在线搜索
- `GET /api/online/search/music` - 搜索在线音乐
- `GET /api/online/search/album` - 搜索专辑信息
- `GET /api/online/lyrics` - 获取歌词

### 系统设置
- `GET /api/settings/media-libraries` - 获取媒体库列表
- `POST /api/settings/media-libraries` - 添加媒体库
- `POST /api/settings/data-sync` - 数据同步
- `POST /api/settings/scraping/start` - 启动刮削

## 🎯 使用指南

### 1. 添加媒体库
1. 打开设置页面
2. 在"媒体库管理"区域输入音乐文件夹路径
3. 点击"添加媒体库"按钮
4. 系统会自动扫描并导入音乐文件

### 2. 数据同步
1. 在设置页面找到"数据同步"区域
2. 点击"立即同步"按钮
3. 系统会与在线音乐服务同步数据

### 3. 音乐搜索
1. 在音乐列表页面使用搜索框
2. 支持按标题、艺术家、专辑搜索
3. 实时显示搜索结果

### 4. 在线音乐搜索
1. 在音乐详情页面点击"在线搜索"
2. 系统会从多个平台搜索相关信息
3. 自动缓存搜索结果以提高性能

## 🔧 配置说明

### 环境变量
```bash
# 服务器端口
PORT=3000

# 数据库路径
DB_PATH=./db/music.db

# 音乐文件目录
MUSIC_PATH=./music
```

### 配置文件
系统配置存储在 `db/config` 表中，包括：
- 媒体库路径列表
- 刮削功能开关
- 在线搜索配置
- 系统偏好设置

## 🐛 故障排除

### 常见问题

1. **媒体库扫描失败**
   - 检查文件路径是否正确
   - 确认文件格式是否支持
   - 查看控制台错误信息

2. **在线搜索无结果**
   - 检查网络连接
   - 确认 API 配置正确
   - 尝试清除缓存数据

3. **内存占用过高**
   - 减少同时扫描的文件数量
   - 启用垃圾回收功能
   - 定期清理缓存数据

### 日志查看
```bash
# 查看应用日志
npm start > app.log 2>&1

# 查看错误日志
tail -f app.log | grep ERROR
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 项目
2. 创建功能分支
3. 提交代码更改
4. 创建 Pull Request

### 代码规范
- 使用 ESLint 进行代码检查
- 遵循项目现有的代码风格
- 添加必要的注释和文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目的支持：
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [music-metadata](https://github.com/Borewit/music-metadata)
- [Koa](https://koajs.com/)
- [React](https://reactjs.org/)

## 📞 联系方式

- 项目主页：https://github.com/your-username/nas-music-server
- 问题反馈：https://github.com/your-username/nas-music-server/issues
- 邮箱：your-email@example.com

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
