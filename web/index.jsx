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

  // 监听窗口尺寸，控制侧边栏开关可用性
  useEffect(() => {
    const onResize = () => {
      const small = window.innerWidth <= 900;
      setIsSmallScreen(small);
      if (!small) {
        // 大屏：强制展开，禁用关闭
        setSidebarOpen(true);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onResize);
      }
    };
  }, []);

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
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
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