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
 * Loading组件
 */
const Loading = ({ visible, message = '加载中...' }) => {
  if (!visible) return null;
  
  return (
    <div className="global-loading-overlay">
      <div className="global-loading-content">
        <div className="global-loading-spinner"></div>
        <div className="global-loading-message">{message}</div>
      </div>
    </div>
  );
};

/**
 * Toast组件
 */
const Toast = ({ visible, message, type = 'info', onClose }) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className={`global-toast global-toast-${type}`}>
      <div className="global-toast-content">
        <div className="global-toast-icon">
          {type === 'success' && '✅'}
          {type === 'error' && '❌'}
          {type === 'warning' && '⚠️'}
          {type === 'info' && 'ℹ️'}
        </div>
        <div className="global-toast-message">{message}</div>
        <button className="global-toast-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

/**
 * NAS音乐播放器主组件
 * 提供完整的音乐播放、管理功能
 */
const NASMusicPlayer = (props) => {
  const playerRef = useRef(null);
  const [isSmallScreen, setIsSmallScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 900 : true));

  // Loading状态
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载中...');

  // Toast状态
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');

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
   * 显示Loading
   */
  const showLoading = (message = '加载中...') => {
    setLoadingMessage(message);
    setLoadingVisible(true);
  };

  /**
   * 隐藏Loading
   */
  const hideLoading = () => {
    setLoadingVisible(false);
  };

  /**
   * 显示Toast消息
   */
  const showToastMessage = (message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  /**
   * 隐藏Toast消息
   */
  const hideToast = () => {
    setToastVisible(false);
  };

   /**
   * 播放器控制方法
   */
  const player = {
    onMobileCloseSidebar: () => {
      if (isSmallScreen && sidebarOpen) {
        setSidebarOpen(false);
      }
    },
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
    },

    // 全局Loading方法
    showLoading,
    hideLoading,

    // 全局Toast方法
    showToastMessage,
    hideToast
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
              <Link to='/' className={`nav-item`} onClick={() => player.onMobileCloseSidebar()}>🎵 音乐</Link>
              <Link to='/albums' className={`nav-item`} onClick={() => player.onMobileCloseSidebar()}>💿 专辑</Link>
              <Link to='/artists' className={`nav-item`} onClick={() => player.onMobileCloseSidebar()}>👤 艺术家</Link>
              <Link to='/favorites' className={`nav-item`} onClick={() => player.onMobileCloseSidebar()}>⭐ 收藏</Link>
              <Link to='/recent' className={`nav-item`} onClick={() => player.onMobileCloseSidebar()}>🕒 最近播放</Link>
              <Link to='/shuffle' className={`nav-item`} onClick={() => player.onMobileCloseSidebar()}>🔀 随机播放</Link>
              <Link to='/settings' className={`nav-item`} onClick={() => player.onMobileCloseSidebar()}>⚙️ 设置</Link>
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
              <Route path="/album/:albumId" element={<AlbumDetailView player={player}/>} />
              <Route path="/artist/:artistId" element={<ArtistDetailView player={player}/>} />
              <Route path="/track/:trackId" element={<TrackDetailPage player={player}/>} />
              <Route path="*" element={<Navigate replace to="/" />} />
            </Routes>
          </div>
        </div>
        {/* 播放器组件 */}
        <Player ref={playerRef} />
        
        {/* 全局Loading组件 */}
        <Loading visible={loadingVisible} message={loadingMessage} />
        
        {/* 全局Toast组件 */}
        <Toast 
          visible={toastVisible} 
          message={toastMessage} 
          type={toastType} 
          onClose={hideToast} 
        />
      </div>
    </Router>
  );
};

export default NASMusicPlayer;