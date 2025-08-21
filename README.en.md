# 🎵 NAS Music Server

A powerful Node.js-based music server that supports local music management, online music search, and data synchronization features.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

## 📸 Screenshots

### 🏠 Homepage
![Homepage](https://via.placeholder.com/800x450/2c3e50/ffffff?text=Homepage)

### 🎵 Music List
![Music List](https://via.placeholder.com/800x450/34495e/ffffff?text=Music+List)

### 💿 Album Management
![Album Management](https://via.placeholder.com/800x450/3498db/ffffff?text=Album+Management)

### ⚙️ Settings Page
![Settings Page](https://via.placeholder.com/800x450/9b59b6/ffffff?text=Settings+Page)

## ✨ Features

### 🎵 Local Music Management
- **📁 Media Library Scanning**: Automatically scan local music files, supporting multiple audio formats
- **🏷️ Metadata Extraction**: Automatically extract music file tag information (title, artist, album, etc.)
- **📊 Smart Classification**: Automatically classify and manage by album, artist, genre, etc.
- **🔄 Data Synchronization**: Synchronize with online music services to obtain more complete music information
- **❤️ Favorites**: Support music favorites and playback history

### 🔍 Online Music Search
- **🌐 Multi-platform Search**: Support mainstream platforms like NetEase Cloud Music, QQ Music, Kugou Music, etc.
- **🎯 Smart Matching**: Intelligently match online resources based on local music information
- **📝 Lyrics Retrieval**: Automatically obtain and display lyrics information
- **🖼️ Cover Download**: Automatically download album cover images
- **💾 Caching Mechanism**: Intelligently cache search results to improve response speed

### 🎨 User Interface
- **🎨 Modern Design**: Adopt modern UI design with dark theme support
- **📱 Responsive Layout**: Perfectly adapt to desktop, tablet, and mobile devices
- **🔍 Real-time Search**: Support real-time search and filtering functions
- **🎮 Playback Control**: Integrated music player with playback control
- **📊 Data Statistics**: Real-time display of music library statistics

### 🔧 System Management
- **⚙️ Settings Management**: Complete system settings interface
- **🔄 Data Synchronization**: One-click synchronization of local and online music data
- **🔍 Scraping Function**: Automatically obtain music metadata information
- **📈 Performance Monitoring**: Memory usage and system performance monitoring

## 🚀 Quick Start

### Requirements
- Node.js 18.0 or higher
- npm or yarn package manager
- Supported operating systems: Windows, macOS, Linux

### Installation Steps

1. **Clone the project**
```bash
git clone https://github.com/your-username/nas-music-server.git
cd nas-music-server
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

4. **Access the application**
Open your browser and visit `http://localhost:3000`

### Development Mode
```bash
npm run dev
```

## 📁 Project Structure

```
music-server/
├── src/                    # Backend source code
│   ├── api/               # API routes
│   ├── client/            # Database client
│   ├── middlewares/       # Middlewares
│   ├── plugins/           # Plugin system
│   └── utils/             # Utility functions
├── web/                   # Frontend source code
│   ├── components/        # React components
│   ├── views/             # Page components
│   └── hooks/             # Custom Hooks
├── db/                    # Database files
├── music/                 # Music files directory
└── package.json           # Project configuration
```

## 🛠️ Technology Stack

### Backend Technologies
- **Node.js**: Server runtime environment
- **Koa**: Web framework
- **SQLite**: Lightweight database
- **better-sqlite3**: SQLite database driver
- **music-metadata**: Music metadata parsing

### Frontend Technologies
- **React**: User interface framework
- **React Router**: Route management
- **CSS3**: Style design
- **Fetch API**: Network requests

### Development Tools
- **Vite**: Frontend build tool
- **Nodemon**: Development environment auto-restart
- **ESLint**: Code quality checking

## 📊 Database Design

### Main Data Tables
- **music**: Music file information
- **albums**: Album information
- **artists**: Artist information
- **online_music**: Online music cache
- **config**: System configuration

### Online Music Caching Mechanism
The system automatically caches online search results to the `online_music` table:

```sql
CREATE TABLE online_music (
  id TEXT PRIMARY KEY,           -- MD5 hash of musicId + albumId
  musicId TEXT NOT NULL,         -- MusicBrainz music ID
  score INTEGER NOT NULL,        -- Search match score
  title TEXT NOT NULL,           -- Song title
  artist TEXT NOT NULL,          -- Artist
  album TEXT NOT NULL,           -- Album name
  coverImage TEXT,               -- Album cover URL
  lyrics TEXT,                   -- Lyrics content
  created_at TEXT,               -- Creation time
  updated_at TEXT                -- Update time
)
```

## 🔌 API Endpoints

### Music Management
- `GET /api/music/tracks` - Get music list
- `GET /api/music/albums` - Get album list
- `GET /api/music/artists` - Get artist list
- `PUT /api/music/tracks/:id/favorite` - Set favorite status

### Online Search
- `GET /api/online/search/music` - Search online music
- `GET /api/online/search/album` - Search album information
- `GET /api/online/lyrics` - Get lyrics

### System Settings
- `GET /api/settings/media-libraries` - Get media library list
- `POST /api/settings/media-libraries` - Add media library
- `POST /api/settings/data-sync` - Data synchronization
- `POST /api/settings/scraping/start` - Start scraping

## 🎯 User Guide

### 1. Add Media Library
1. Open the settings page
2. Enter the music folder path in the "Media Library Management" section
3. Click the "Add Media Library" button
4. The system will automatically scan and import music files

### 2. Data Synchronization
1. Find the "Data Synchronization" section on the settings page
2. Click the "Sync Now" button
3. The system will synchronize data with online music services

### 3. Music Search
1. Use the search box on the music list page
2. Support search by title, artist, album
3. Real-time display of search results

### 4. Online Music Search
1. Click "Online Search" on the music details page
2. The system will search for related information from multiple platforms
3. Automatically cache search results to improve performance

## 🔧 Configuration

### Environment Variables
```bash
# Server port
PORT=3000

# Database path
DB_PATH=./db/music.db

# Music files directory
MUSIC_PATH=./music
```

### Configuration Files
System configuration is stored in the `db/config` table, including:
- Media library path list
- Scraping function switch
- Online search configuration
- System preference settings

## 🐛 Troubleshooting

### Common Issues

1. **Media Library Scan Failure**
   - Check if the file path is correct
   - Confirm if the file format is supported
   - Check console error messages

2. **No Online Search Results**
   - Check network connection
   - Confirm API configuration is correct
   - Try clearing cache data

3. **High Memory Usage**
   - Reduce the number of files scanned simultaneously
   - Enable garbage collection function
   - Regularly clean cache data

### Log Viewing
```bash
# View application logs
npm start > app.log 2>&1

# View error logs
tail -f app.log | grep ERROR
```

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

### Development Process
1. Fork the project
2. Create a feature branch
3. Submit code changes
4. Create a Pull Request

### Code Standards
- Use ESLint for code checking
- Follow the project's existing code style
- Add necessary comments and documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Thanks to the following open source projects:
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [music-metadata](https://github.com/Borewit/music-metadata)
- [Koa](https://koajs.com/)
- [React](https://reactjs.org/)

## 📞 Contact

- Project Homepage: https://github.com/your-username/nas-music-server
- Issue Feedback: https://github.com/your-username/nas-music-server/issues
- Email: your-email@example.com

---

⭐ If this project helps you, please give it a star!