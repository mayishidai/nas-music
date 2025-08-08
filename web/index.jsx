import React, { useState, useEffect, useRef } from 'react';
import { MusicList, Player } from './components';
import {
  MusicPage,
  AlbumsPage,
  ArtistsPage,
  GenresPage,
  FavoritesPage,
  RecentlyPlayedPage,
  SettingsPage
} from './views';
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
    tracks: [],
    albums: [],
    artists: [],
    genres: [],
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
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [currentLyricLine, setCurrentLyricLine] = useState('');
  const [showLyricsPanel, setShowLyricsPanel] = useState(false);
  const [parsedLyrics, setParsedLyrics] = useState([]);
  
  // Tag编辑器状态
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [tagSearchResults, setTagSearchResults] = useState([]);
  
  const audioRef = useRef(null);

  /**
   * 加载音乐库统计信息
   */
  const loadStats = async () => {
    try {
      const response = await fetch('/api/music/stats');
      const result = await response.json();
      if (result.success) {
        setMusicData(prev => ({ ...prev, stats: result.data }));
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  /**
   * 加载专辑列表
   */
  const loadAlbums = async (page = 1, search = '') => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/music/albums?page=${page}&limit=20&search=${search}`);
      const result = await response.json();
      if (result.success) {
        setMusicData(prev => ({ ...prev, albums: result.data }));
      }
    } catch (error) {
      console.error('加载专辑列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 加载艺术家列表
   */
  const loadArtists = async (page = 1, search = '') => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/music/artists?page=${page}&limit=20&search=${search}`);
      const result = await response.json();
      if (result.success) {
        setMusicData(prev => ({ ...prev, artists: result.data }));
      }
    } catch (error) {
      console.error('加载艺术家列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 加载流派列表
   */
  const loadGenres = async () => {
    try {
      const response = await fetch('/api/music/genres');
      const result = await response.json();
      if (result.success) {
        setMusicData(prev => ({ ...prev, genres: result.data }));
      }
    } catch (error) {
      console.error('加载流派列表失败:', error);
    }
  };

  /**
   * 播放音乐
   * @param {Object} track - 音乐信息
   * @param {Array} playlistTracks - 播放列表
   */
  const playMusic = (track, playlistTracks = null) => {
    if (playlistTracks) {
      setPlaylist(playlistTracks);
      const index = playlistTracks.findIndex(t => t.id === track.id);
      setCurrentPlaylistIndex(index);
    }
    
    if (currentMusic?.id === track.id) {
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
      setCurrentMusic(track);
      setIsPlaying(true);
      loadRecommendations(track.id);
      loadLyrics(track.id);
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
        setRecommendations(result.data);
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
        setShowLyrics(true);
      } else {
        setLyrics('暂无歌词');
        setParsedLyrics([]);
        setShowLyrics(false);
      }
    } catch (error) {
      console.error('加载歌词失败:', error);
      setLyrics('暂无歌词');
      setParsedLyrics([]);
      setShowLyrics(false);
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
        loadData();
      } else {
        alert('更新失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存Tag失败:', error);
      alert('保存失败');
    }
  };

  /**
   * 加载数据
   */
  const loadData = () => {
    switch (currentView) {
      case 'music':
        // 交由 MusicList 内部加载
        break;
      case 'albums':
        loadAlbums(1, searchQuery);
        break;
      case 'artists':
        loadArtists(1, searchQuery);
        break;
      case 'genres':
        loadGenres();
        break;
    }
  };

  /**
   * 处理页面切换
   */
  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  /**
   * 处理设置按钮点击
   */
  const handleSettingsClick = () => {
    setCurrentView('settings');
  };

  /**
   * 处理音乐库管理按钮点击
   */
  const handleLibraryManageClick = () => {
    setCurrentView('music');
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
    loadData();
  }, [currentView, searchQuery]);

  /**
   * 渲染当前页面内容
   */
  const renderCurrentPage = () => {
    switch (currentView) {
      case 'music':
        return (
          <MusicPage
            stats={musicData.stats}
            searchQuery={searchQuery}
            onPlay={(t) => playMusic(t)}
            onAddToPlaylist={(t) => setPlaylist((prev) => [...prev, t])}
            onFavorite={(t) => alert('已收藏：' + (t.title || ''))}
            onDetails={(t) => openTagEditor(t)}
          />
        );
      case 'albums':
        return (
          <AlbumsPage
            albums={musicData.albums}
            onAlbumClick={setSelectedAlbum}
          />
        );
      case 'artists':
        return (
          <ArtistsPage
            artists={musicData.artists}
            onArtistClick={setSelectedArtist}
          />
        );
      case 'genres':
        return (
          <GenresPage
            genres={musicData.genres}
          />
        );
      case 'favorites':
        return <FavoritesPage />;
      case 'recently-played':
        return <RecentlyPlayedPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <MusicPage />;
    }
  };

  return (
    <div className="nas-music-player">
      {/* 左侧树形菜单 */}
      <div className="sidebar">
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
              onClick={() => handleViewChange('albums')}
            >
              💿 专辑 ({musicData.stats.albums || 0})
            </button>
            <button 
              className={currentView === 'artists' ? 'active' : ''}
              onClick={() => handleViewChange('artists')}
            >
              👤 艺术家 ({musicData.stats.artists || 0})
            </button>
            <button 
              className={currentView === 'genres' ? 'active' : ''}
              onClick={() => handleViewChange('genres')}
            >
              🎭 流派 ({musicData.stats.genres || 0})
            </button>
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
            <button className="nav-item">
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

      {/* 主内容区 */}
      <div className="main-content">
        {/* 顶部工具栏 */}
        <div className="top-bar">
          <div className="search-container">
            <input
              type="text"
              placeholder="搜索音乐、专辑、艺术家..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button className="search-btn">🔍</button>
          </div>
          
          <div className="view-controls">
            <button 
              className="view-btn" 
              title="音乐库管理"
              onClick={handleLibraryManageClick}
            >
              📋
            </button>
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