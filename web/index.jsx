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
  TrackDetailPage
} from './views';
import ShufflePage from './views/shuffle';
import ArtistDetailView from './views/Artists/ArtistDetail';
import './index.css';

/**
 * NAS音乐播放器主组件
 * 提供完整的音乐播放、管理功能
 */
const NASMusicPlayer = () => {
  // 视图状态 - 默认打开音乐页面
  const [currentView, setCurrentView] = useState('music');
  
  // 音乐数据状态
  const [musicData, setMusicData] = useState({
    stats: {}
  });
  
  // 播放器状态
  const [currentMusic, setCurrentMusic] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  
  // 界面状态
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  
  // 播放列表状态
  const [playlist, setPlaylist] = useState([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(-1);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none'); // none, one, all
  
  // 歌词相关状态
  const [lyrics, setLyrics] = useState('');
  const [showLyrics, setShowLyrics] = useState(true);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [currentLyricLine, setCurrentLyricLine] = useState('');
  const [showLyricsPanel, setShowLyricsPanel] = useState(false);
  const [parsedLyrics, setParsedLyrics] = useState([]);
  
  // Tag编辑器状态
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [tagSearchResults, setTagSearchResults] = useState([]);
  
  const audioRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 900;
    }
    return true;
  });
  const [isSmallScreen, setIsSmallScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));

  /**
   * 加载音乐库统计信息
   */
  const loadStats = async () => {
    try {
      const response = await fetch('/api/settings/music-stats');
      const result = await response.json();
      if (result.success) {
        setMusicData(prev => ({ ...prev, stats: result.data }));
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  /**
   * 播放音乐
   * @param {Object} track - 音乐信息
   * @param {Array} playlistTracks - 播放列表
   */
  const playMusic = (track, playlistTracks = null) => {
    const normId = track?._id || track?.id;
    const normalizedTrack = { ...track, id: normId };

    if (playlistTracks) {
      // 确保播放列表内元素都有 id 字段
      const normList = playlistTracks.map((t) => ({ ...t, id: t._id || t.id }));
      setPlaylist(normList);
      const index = normList.findIndex(t => (t._id || t.id) === normId);
      setCurrentPlaylistIndex(index);
    }
    
    const currentId = currentMusic ? (currentMusic._id || currentMusic.id) : null;
    if (currentId && currentId === normId) {
      // 如果点击的是当前播放的音乐，则切换播放/暂停状态
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      // 播放新的音乐
      // 若未传入新的播放列表：
      // - 如果当前曲目不在播放列表中，插入到第一位
      // - 如果已存在，则不改变顺序，仅定位到该曲目
      if (!playlistTracks) {
        const existingIndex = playlist.findIndex((t) => (t?._id || t?.id) === normId);
        if (existingIndex === -1) {
          setPlaylist((prev) => [ normalizedTrack, ...prev ]);
          setCurrentPlaylistIndex(0);
        } else {
          setCurrentPlaylistIndex(existingIndex);
        }
      }
      setCurrentMusic(normalizedTrack);
      setIsPlaying(true);
      loadRecommendations(normId);
      loadLyrics(normId);
      // 记录最近播放
      try {
        fetch(`/api/music/recently-played/${normId}`, { method: 'POST' });
      } catch (e) {}
    }
  };

  /** 打开艺术家详情 */
  const openArtist = async (artist) => {
    try {
      setIsLoading(true);
      const artistId = artist.id || artist._id;
      const res = await fetch(`/api/music/artists/${artistId}`);
      const json = await res.json();
      if (json?.success) {
        const data = json.data || {};
        // 规范化
        const normTracks = (data.tracks || []).filter(Boolean).map((t) => ({ ...t, id: t._id || t.id }));
        const normAlbums = (data.albums || []).filter(Boolean);
        setSelectedArtist({ ...data, tracks: normTracks, albums: normAlbums });
      } else {
        setSelectedArtist(artist);
      }
    } catch (e) {
      console.error('加载艺术家详情失败:', e);
      setSelectedArtist(artist);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 播放下一首
   */
  const nextTrack = () => {
    if (playlist.length === 0) return;
    
    let nextIndex;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = currentPlaylistIndex + 1;
      if (nextIndex >= playlist.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          return;
        }
      }
    }
    
    setCurrentPlaylistIndex(nextIndex);
    playMusic(playlist[nextIndex]);
  };

  /**
   * 播放上一首
   */
  const prevTrack = () => {
    if (playlist.length === 0) return;
    
    let prevIndex = currentPlaylistIndex - 1;
    if (prevIndex < 0) {
      if (repeatMode === 'all') {
        prevIndex = playlist.length - 1;
      } else {
        return;
      }
    }
    
    setCurrentPlaylistIndex(prevIndex);
    playMusic(playlist[prevIndex]);
  };

  /**
   * 加载推荐音乐
   */
  const loadRecommendations = async (trackId) => {
    try {
      const response = await fetch(`/api/music/recommendations/${trackId}?limit=10`);
      const result = await response.json();
      if (result.success) {
        const recs = Array.isArray(result.data)
          ? result.data.map((t) => ({ ...t, id: t._id || t.id }))
          : [];
        setRecommendations(recs);
      }
    } catch (error) {
      console.error('加载推荐失败:', error);
    }
  };

  /**
   * 加载歌词
   */
  const loadLyrics = async (trackId) => {
    try {
      setLyricsLoading(true);
      const response = await fetch(`/api/music/lyrics/${trackId}`);
      const result = await response.json();
      if (result.success && result.data) {
        setLyrics(result.data);
        const parsed = parseLyrics(result.data);
        setParsedLyrics(parsed);
      } else {
        setLyrics('暂无歌词');
        setParsedLyrics([]);
      }
    } catch (error) {
      console.error('加载歌词失败:', error);
      setLyrics('暂无歌词');
      setParsedLyrics([]);
    } finally {
      setLyricsLoading(false);
    }
  };

  /**
   * 解析歌词时间轴
   */
  const parseLyrics = (lyricsText) => {
    if (!lyricsText) return [];
    
    const lines = lyricsText.split('\n');
    const lyricsArray = [];
    
    lines.forEach(line => {
      // 支持多种时间格式：[mm:ss.xx] 或 [mm:ss:xx]
      const timeMatch = line.match(/\[(\d{2}):(\d{2})[\.:](\d{2,3})\]/);
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1]);
        const seconds = parseInt(timeMatch[2]);
        const milliseconds = parseInt(timeMatch[3]);
        const time = minutes * 60 + seconds + milliseconds / 1000;
        const text = line.replace(/\[\d{2}:\d{2}[\.:]\d{2,3}\]/, '').trim();
        if (text) {
          lyricsArray.push({ time, text });
        }
      }
    });
    
    return lyricsArray.sort((a, b) => a.time - b.time);
  };

  /**
   * 获取当前歌词行
   */
  const getCurrentLyricLine = (currentTime, lyricsArray) => {
    if (!lyricsArray || lyricsArray.length === 0) return '';
    
    for (let i = lyricsArray.length - 1; i >= 0; i--) {
      if (currentTime >= lyricsArray[i].time) {
        return lyricsArray[i].text;
      }
    }
    return '';
  };

  /**
   * 打开Tag编辑器
   */
  const openTagEditor = (track) => {
    setEditingTrack({ ...track });
    setShowTagEditor(true);
  };

  /**
   * 打开专辑详情
   */
  const openAlbum = async (album) => {
    try {
      setIsLoading(true);
      const albumId = album.id || album._id;
      const res = await fetch(`/api/music/albums/${albumId}`);
      const json = await res.json();
      if (json?.success) {
        const data = json.data || {};
        const normalizedTracks = (data.tracks || []).filter(Boolean).map((t) => ({ ...t, id: t._id || t.id }));
        setSelectedAlbum({ ...data, tracks: normalizedTracks });
      } else {
        setSelectedAlbum(album);
      }
    } catch (e) {
      console.error('加载专辑详情失败:', e);
      setSelectedAlbum(album);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 在线搜索Tag
   */
  const searchTags = async (query) => {
    try {
      const response = await fetch(`/api/music/search-tags?query=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (result.success) {
        setTagSearchResults(result.data);
      }
    } catch (error) {
      console.error('搜索Tag失败:', error);
    }
  };

  /**
   * 保存Tag修改
   */
  const saveTagChanges = async () => {
    try {
      const response = await fetch(`/api/music/tracks/${editingTrack.id}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editingTrack.title,
          artist: editingTrack.artist,
          album: editingTrack.album,
          albumArtist: editingTrack.albumArtist,
          year: editingTrack.year,
          genre: editingTrack.genre,
          track: editingTrack.track
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Tag更新成功！');
        setShowTagEditor(false);
      } else {
        alert('更新失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存Tag失败:', error);
      alert('保存失败');
    }
  };

  /**
   * 处理页面切换
   */
  const handleViewChange = (view) => {
    setCurrentView(view);
    // 小屏：切换视图后关闭侧边抽屉；大屏保持展开
    if (isSmallScreen) setSidebarOpen(false);
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
    const openTrackDetail = (e) => {
      const t = e.detail?.track;
      if (t) {
        setEditingTrack({ ...t, id: t._id || t.id });
        setCurrentView('track-detail');
      }
    };
    const handlePlayMusic = (e) => {
      const { track, playlistTracks } = e.detail;
      playMusic(track, playlistTracks);
    };
    const handleAddToPlaylist = (e) => {
      const { track } = e.detail;
      setPlaylist((prev) => [...prev, track]);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
      window.addEventListener('openTrackDetail', openTrackDetail);
      window.addEventListener('playMusic', handlePlayMusic);
      window.addEventListener('addToPlaylist', handleAddToPlaylist);
      onResize();
      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('openTrackDetail', openTrackDetail);
        window.removeEventListener('playMusic', handlePlayMusic);
        window.removeEventListener('addToPlaylist', handleAddToPlaylist);
      };
    }
  }, []);

  /**
   * 处理设置按钮点击
   */
  const handleSettingsClick = () => {
    setCurrentView('settings');
  };

  // 处理搜索按钮点击/回车
  const handleSearch = () => {
    if (currentView === 'albums' && selectedAlbum) {
      setSelectedAlbum(null);
    }
    if (currentView === 'artists' && selectedArtist) {
      setSelectedArtist(null);
    }
    // 其余视图保持不变，依赖 useEffect 根据 searchQuery 自动刷新
  };

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      // 更新当前歌词行
      if (lyrics && showLyrics) {
        const lyricsArray = parseLyrics(lyrics);
        const currentLine = getCurrentLyricLine(time, lyricsArray);
        setCurrentLyricLine(currentLine);
      }
    };
    
    const handleDurationChange = () => setDuration(audio.duration);
    
    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack();
      }
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [currentMusic, repeatMode, lyrics, showLyrics]);

  // 当前音乐改变时更新音频源
  useEffect(() => {
    if (currentMusic && audioRef.current) {
      audioRef.current.src = `/api/music/stream/${currentMusic.id}`;
      if (isPlaying) {
        audioRef.current.play();
      }
    }
  }, [currentMusic]);

  // 组件加载时初始化
  useEffect(() => {
    loadStats();
  }, []);

  /**
   * 渲染当前页面内容
   */
  const renderCurrentPage = () => {
    switch (currentView) {
      case 'music':
        return <MusicPage />;
      case 'albums':
        return selectedAlbum ? (
          <AlbumDetailView
            album={selectedAlbum}
            onBack={() => setSelectedAlbum(null)}
            onPlay={(t) => playMusic(t, selectedAlbum?.tracks || null)}
            onPlayAll={() => {
              const tracks = (selectedAlbum?.tracks || []).filter(Boolean);
              if (tracks.length) {
                playMusic(tracks[0], tracks);
              }
            }}
            onAddToPlaylist={(t) => setPlaylist((prev) => [...prev, t])}
            onFavorite={async (t, next) => {
              try {
                await fetch(`/api/music/tracks/${t._id || t.id}/favorite`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorite: next }) });
              } catch (e) {}
            }}
          />
        ) : (
          <AlbumsPage onAlbumClick={openAlbum} />
        );
      case 'artists':
        return selectedArtist ? (
          <ArtistDetailView
            artist={selectedArtist}
            onBack={() => setSelectedArtist(null)}
            onPlay={(t) => playMusic(t)}
            onAddToPlaylist={(t) => setPlaylist((prev) => [...prev, t])}
          />
        ) : (
          <ArtistsPage onArtistClick={openArtist} />
        );
      case 'favorites':
        return <FavoritesPage />;
      case 'recently-played':
        return <RecentlyPlayedPage />;
      case 'shuffle':
        return <ShufflePage />;
      case 'settings':
        return <SettingsPage />;
      case 'track-detail':
        return (
          <TrackDetailPage
            trackId={editingTrack?.id}
            onBack={() => setCurrentView('music')}
          />
        );
      default:
        return <MusicPage />;
    }
  };

  return (
    <div className="nas-music-player">
      {/* 左侧树形菜单 */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="logo">
          <h2>🎵 NAS音乐</h2>
        </div>
        
        <div className="nav-section">
          <h3>浏览</h3>
          <nav className="nav-menu">
            <button 
              className={currentView === 'music' ? 'active' : ''}
              onClick={() => handleViewChange('music')}
            >
              🎵 音乐 ({musicData.stats.tracks || 0})
            </button>
            <button 
              className={currentView === 'albums' ? 'active' : ''}
              onClick={() => { setSelectedAlbum(null); handleViewChange('albums'); }}
            >
              💿 专辑 ({musicData.stats.albums || 0})
            </button>
            <button 
              className={currentView === 'artists' ? 'active' : ''}
              onClick={() => { setSelectedArtist(null); handleViewChange('artists'); }}
            >
              👤 艺术家 ({musicData.stats.artists || 0})
            </button>
            {/* 已移除流派入口 */}
          </nav>
        </div>

        <div className="nav-section">
          <h3>个人</h3>
          <nav className="nav-menu">
            <button 
              className={currentView === 'favorites' ? 'active' : ''}
              onClick={() => handleViewChange('favorites')}
            >
              ⭐ 收藏
            </button>
            <button 
              className={currentView === 'recently-played' ? 'active' : ''}
              onClick={() => handleViewChange('recently-played')}
            >
              🕒 最近播放
            </button>
            <button 
              className={currentView === 'shuffle' ? 'active' : ''}
              onClick={() => handleViewChange('shuffle')}
            >
              🔀 随机播放
            </button>
          </nav>
        </div>

        {/* 推荐音乐 */}
        {recommendations.length > 0 && (
          <div className="nav-section">
            <h3>推荐音乐</h3>
            <div className="recommendations">
              {recommendations.slice(0, 5).map(track => (
                <div 
                  key={track.id} 
                  className="recommendation-item"
                  onClick={() => playMusic(track)}
                >
                  <img 
                    src={track.coverImage || `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0yMCAxMEwyOCAyMEwyMCAzMEwxMiAyMEwyMCAxMFoiIGZpbGw9IiNjY2MiLz4KPC9zdmc+`}
                    alt="封面"
                  />
                  <div className="recommendation-info">
                    <div className="title">{track.title}</div>
                    <div className="artist">{track.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 移动端侧边遮罩 */}
      {isSmallScreen && sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* 主内容区 */}
      <div className="main-content">
        {/* 顶部工具栏 */}
        <div className="top-bar">
          <div className="top-leading">
            {isSmallScreen && (
              <button
                className="menu-btn"
                title="菜单"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                ☰
              </button>
            )}
            <div className="logo-mini">🎵 NAS音乐</div>
          </div>
          <div className="search-container">
            <input
              type="text"
              placeholder="搜索音乐、专辑、艺术家..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                title="清空"
                onClick={() => {
                  setSearchQuery('');
                  // 清空后也确保从详情返回列表
                  if (currentView === 'albums' && selectedAlbum) setSelectedAlbum(null);
                  if (currentView === 'artists' && selectedArtist) setSelectedArtist(null);
                }}
              >
                ✕
              </button>
            )}
            <button className="search-btn" onClick={handleSearch}>🔍</button>
          </div>
          
          <div className="view-controls">
            <button 
              className="view-btn" 
              title="设置"
              onClick={handleSettingsClick}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* 内容区域 - React Switch */}
        <div className="content-area">
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner">🔄</div>
              <p>加载中...</p>
            </div>
          )}

          {renderCurrentPage()}
        </div>
      </div>

      {/* 播放器组件 - 始终显示 */}
      <Player
        currentMusic={currentMusic}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        playlist={playlist}
        currentPlaylistIndex={currentPlaylistIndex}
        isShuffled={isShuffled}
        repeatMode={repeatMode}
        lyrics={lyrics}
        showLyrics={showLyrics}
        currentLyricLine={currentLyricLine}
        lyricsLoading={lyricsLoading}
        parsedLyrics={parsedLyrics}
        onPlay={() => playMusic(currentMusic)}
        onPause={() => {
          audioRef.current.pause();
          setIsPlaying(false);
        }}
        onNext={nextTrack}
        onPrev={prevTrack}
        onVolumeChange={(vol) => {
          setVolume(vol);
          audioRef.current.volume = vol;
        }}
        onTimeChange={(time) => {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
        }}
        onShuffleToggle={() => setIsShuffled(!isShuffled)}
        onRepeatModeChange={() => {
          const modes = ['none', 'one', 'all'];
          const currentIndex = modes.indexOf(repeatMode);
          const nextMode = modes[(currentIndex + 1) % modes.length];
          setRepeatMode(nextMode);
        }}
        onLyricsToggle={() => setShowLyrics(!showLyrics)}
        onPlaylistItemClick={(track, index) => {
          setCurrentPlaylistIndex(index);
          playMusic(track);
        }}
        onPlaylistItemRemove={(index) => {
          const newPlaylist = [...playlist];
          newPlaylist.splice(index, 1);
          setPlaylist(newPlaylist);
          
          // 如果删除的是当前播放的歌曲之前的歌曲，需要调整当前索引
          if (index < currentPlaylistIndex) {
            setCurrentPlaylistIndex(currentPlaylistIndex - 1);
          }
          // 如果删除的是当前播放的歌曲，播放下一首
          else if (index === currentPlaylistIndex) {
            if (newPlaylist.length > 0) {
              const newIndex = Math.min(index, newPlaylist.length - 1);
              setCurrentPlaylistIndex(newIndex);
              playMusic(newPlaylist[newIndex]);
            } else {
              setCurrentPlaylistIndex(-1);
            }
          }
        }}
        onPlaylistClear={() => setPlaylist([])}
      />

      {/* Tag编辑器模态框 */}
      {showTagEditor && editingTrack && (
        <div className="modal-overlay">
          <div className="tag-editor-modal">
            <div className="modal-header">
              <h3>编辑音乐信息</h3>
              <button 
                onClick={() => setShowTagEditor(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <div className="tag-form">
                <div className="form-group">
                  <label>标题</label>
                  <input
                    type="text"
                    value={editingTrack.title}
                    onChange={(e) => setEditingTrack({...editingTrack, title: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>艺术家</label>
                  <input
                    type="text"
                    value={editingTrack.artist}
                    onChange={(e) => setEditingTrack({...editingTrack, artist: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>专辑</label>
                  <input
                    type="text"
                    value={editingTrack.album}
                    onChange={(e) => setEditingTrack({...editingTrack, album: e.target.value})}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>年份</label>
                    <input
                      type="number"
                      value={editingTrack.year || ''}
                      onChange={(e) => setEditingTrack({...editingTrack, year: parseInt(e.target.value) || null})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>音轨号</label>
                    <input
                      type="number"
                      value={editingTrack.track || ''}
                      onChange={(e) => setEditingTrack({...editingTrack, track: parseInt(e.target.value) || null})}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>流派</label>
                  <input
                    type="text"
                    value={editingTrack.genre}
                    onChange={(e) => setEditingTrack({...editingTrack, genre: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>在线搜索</label>
                  <div className="search-tags">
                    <input
                      type="text"
                      placeholder="搜索歌曲信息..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          searchTags(e.target.value);
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        searchTags(input.value);
                      }}
                    >
                      搜索
                    </button>
                  </div>
                  
                  {tagSearchResults.length > 0 && (
                    <div className="search-results">
                      {tagSearchResults.map((result, index) => (
                        <div 
                          key={index} 
                          className="search-result-item"
                          onClick={() => {
                            setEditingTrack({
                              ...editingTrack,
                              title: result.title,
                              artist: result.artist,
                              album: result.album,
                              year: result.year
                            });
                          }}
                        >
                          <div className="result-title">{result.title}</div>
                          <div className="result-info">{result.artist} - {result.album}</div>
                          {result.year && <div className="result-year">{result.year}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowTagEditor(false)}
                className="cancel-btn"
              >
                取消
              </button>
              <button 
                onClick={saveTagChanges}
                className="save-btn"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 隐藏的音频元素 */}
      <audio ref={audioRef} />
    </div>
  );
};

export default NASMusicPlayer;