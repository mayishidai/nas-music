import { useState, useEffect, useRef } from 'react';
import { StaticRouter, HashRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { Player } from './components';
import {
  MusicPage,
  AlbumsPage,
  ArtistsPage,
  FavoritesPage,
  RecentlyPlayedPage,
  SettingsPage,
  AlbumDetailView,
  TrackDetailPage,
  ArtistDetailView,
  ShufflePage,
} from './views';
import './index.css';

const Router = typeof window === 'undefined' ? StaticRouter : HashRouter;
/**
 * NAS音乐播放器主组件
 * 提供完整的音乐播放、管理功能
 */
const NASMusicPlayer = (props) => {
  const playerRef = useRef(null);
  const [isSmallScreen, setIsSmallScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 900 : true));

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const smallScreen = window.innerWidth <= 900;
      setIsSmallScreen(smallScreen);
      
      // 如果从小屏幕变为大屏幕，自动打开侧边栏
      if (!smallScreen && !sidebarOpen) {
        setSidebarOpen(true);
      }
      // 如果从大屏幕变为小屏幕，自动关闭侧边栏
      if (smallScreen && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

   /**
   * 播放器控制方法
   */
  const player = {
    switchSidebar: () => setSidebarOpen(!sidebarOpen),
    // 播放音乐
    playMusic: (track, playlistTracks = null) => {
      if (playerRef.current) {
        playerRef.current.playMusic(track, playlistTracks);
      }
    },
    
    // 添加到播放列表
    addToPlaylist: (track) => {
      if (playerRef.current) {
        playerRef.current.addToPlaylist(track);
      }
    },
    
    // 下一首
    nextTrack: () => {
      if (playerRef.current) {
        playerRef.current.nextTrack();
      }
    },
    
    // 上一首
    prevTrack: () => {
      if (playerRef.current) {
        playerRef.current.prevTrack();
      }
    }
  };

  // 处理点击空白处关闭侧边栏
  const handleOverlayClick = () => {
    if (isSmallScreen && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  // 处理侧边栏点击事件（阻止冒泡）
  const handleSidebarClick = (e) => { e.stopPropagation(); };

  return (
    <Router>
      <div className="app-container">
        <div className="main-container">
          {/* 移动端遮罩层 */}
          {isSmallScreen && sidebarOpen && (
            <div className="sidebar-overlay" onClick={handleOverlayClick} />
          )}
          
          <div className={`sidebar ${sidebarOpen ? 'open' : ''}`} onClick={handleSidebarClick}>
            <div className="sidebar-header">
              <h1>🎵 NAS音乐</h1>
            </div>
            <nav className="sidebar-nav">
              <Link to='/' className={`nav-item`}>🎵 音乐</Link>
              <Link to='/albums' className={`nav-item`}>💿 专辑</Link>
              <Link to='/artists' className={`nav-item`}>👤 艺术家</Link>
              <Link to='/favorites' className={`nav-item`}>⭐ 收藏</Link>
              <Link to='/recent' className={`nav-item`}>🕒 最近播放</Link>
              <Link to='/shuffle' className={`nav-item`}>🔀 随机播放</Link>
              <Link to='/settings' className={`nav-item`}>⚙️ 设置</Link>
            </nav>
          </div>

          {/* 主内容区域 */}
          <div className="main-content">
            <Routes>
              <Route path="/" element={<MusicPage player={player}/>} />
              <Route path="/albums" element={<AlbumsPage player={player}/>} />
              <Route path="/artists" element={<ArtistsPage player={player}/>} />
              <Route path="/favorites" element={<FavoritesPage player={player}/>} />
              <Route path="/recent" element={<RecentlyPlayedPage player={player}/>} />
              <Route path="/shuffle" element={<ShufflePage player={player}/>} />
              <Route path="/settings" element={<SettingsPage player={player}/>} />
              <Route path="/album/:id" element={<AlbumDetailView player={player}/>} />
              <Route path="/artist/:id" element={<ArtistDetailView player={player}/>} />
              <Route path="/track/:trackId" element={<TrackDetailPage player={player}/>} />
              <Route path="*" element={<Navigate replace to="/" />} />
            </Routes>
          </div>
        </div>
        {/* 播放器组件 */}
        <Player ref={playerRef} />
      </div>
    </Router>
  );
};

export default NASMusicPlayer;