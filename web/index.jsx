import React, { useState, useEffect, useRef } from 'react';
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
  ShufflePage
} from './views';
import './index.css';

/**
 * NAS音乐播放器主组件
 * 提供完整的音乐播放、管理功能
 */
const NASMusicPlayer = () => {
  // 路由状态
  const [currentView, setCurrentView] = useState('music');
  const [viewData, setViewData] = useState({});
  
  const playerRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 900;
    }
    return true;
  });
  const [isSmallScreen, setIsSmallScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));

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

  // 监听键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSmallScreen && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSmallScreen, sidebarOpen]);

  /**
   * 路由控制方法
   */
  const router = {
    // 导航到指定页面
    navigate: (view, data = {}) => {
      setCurrentView(view);
      setViewData(data);
      // 小屏：切换视图后关闭侧边抽屉；大屏保持展开
      if (isSmallScreen) setSidebarOpen(false);
    },
    
    // 返回上一页
    goBack: () => {
      const backMap = {
        'album-detail': 'albums',
        'artist-detail': 'artists',
        'track-detail': 'music'
      };
      const backView = backMap[currentView];
      if (backView) {
        setCurrentView(backView);
        setViewData({});
        if (isSmallScreen) setSidebarOpen(false);
      }
    },
    
    // 获取当前页面数据
    getCurrentData: () => viewData,
    
    // 获取当前页面名称
    getCurrentView: () => currentView,

    // 切换侧边栏
    switchSidebar: () => setSidebarOpen(!sidebarOpen)
  };

  /**
   * 播放器控制方法
   */
  const player = {
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
  const handleSidebarClick = (e) => {
    e.stopPropagation();
  };

  // 渲染当前页面
  const renderCurrentPage = () => {
    const commonProps = {
      router,
      player
    };

    switch (currentView) {
      case 'music':
        return <MusicPage {...commonProps} />;
      case 'albums':
        return <AlbumsPage {...commonProps} />;
      case 'artists':
        return <ArtistsPage {...commonProps} />;
      case 'favorites':
        return <FavoritesPage {...commonProps} />;
      case 'recent':
        return <RecentlyPlayedPage {...commonProps} />;
      case 'shuffle':
        return <ShufflePage {...commonProps} />;
      case 'settings':
        return <SettingsPage {...commonProps} />;
      case 'album-detail':
        return <AlbumDetailView {...commonProps} />;
      case 'artist-detail':
        return <ArtistDetailView {...commonProps} />;
      case 'track-detail':
        return <TrackDetailPage {...commonProps} />;
      default:
        return <MusicPage {...commonProps} />;
    }
  };

  return (
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
            <button 
              className={`nav-item ${currentView === 'music' ? 'active' : ''}`}
              onClick={() => router.navigate('music')}
            >
              🎵 音乐
            </button>
            <button 
              className={`nav-item ${currentView === 'albums' ? 'active' : ''}`}
              onClick={() => router.navigate('albums')}
            >
              💿 专辑
            </button>
            <button 
              className={`nav-item ${currentView === 'artists' ? 'active' : ''}`}
              onClick={() => router.navigate('artists')}
            >
              👤 艺术家
            </button>
            <button 
              className={`nav-item ${currentView === 'favorites' ? 'active' : ''}`}
              onClick={() => router.navigate('favorites')}
            >
              ⭐ 收藏
            </button>
            <button 
              className={`nav-item ${currentView === 'recent' ? 'active' : ''}`}
              onClick={() => router.navigate('recent')}
            >
              🕒 最近播放
            </button>
            <button 
              className={`nav-item ${currentView === 'shuffle' ? 'active' : ''}`}
              onClick={() => router.navigate('shuffle')}
            >
              🔀 随机播放
            </button>
            <button 
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => router.navigate('settings')}
            >
              ⚙️ 设置
            </button>
          </nav>
        </div>

        {/* 主内容区域 */}
        <div className="main-content">
        {renderCurrentPage()}
        </div>
      </div>
      {/* 播放器组件 */}
      <Player ref={playerRef} />
    </div>
  );
};

export default NASMusicPlayer;