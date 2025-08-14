import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import './index.css';

const Player = forwardRef((props, ref) => {
  // 播放器状态 - 完全自管理
  const [currentMusic, setCurrentMusic] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playlist, setPlaylist] = useState([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(-1);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none'); // none, one, all
  
  // 界面状态
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [muted, setMuted] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [playMode, setPlayMode] = useState('none'); // none | one | all | shuffle
  
  // 歌词相关状态
  const [lyrics, setLyrics] = useState('');
  const [parsedLyrics, setParsedLyrics] = useState([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const audioRef = useRef(null);

  // 格式化时间
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 解析歌词时间轴
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

  // 加载歌词
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

  // 添加到播放列表
  const addToPlaylist = (track) => {
    const normalizedTrack = { ...track, id: track._id || track.id };
    setPlaylist(prev => [...prev, normalizedTrack]);
  };

  // 播放音乐
  const playMusic = async (track, playlistTracks = null) => {
    if (!track) return;
    
    // 如果是新的播放列表，更新播放列表
    if (playlistTracks) {
      setPlaylist(playlistTracks);
      const trackIndex = playlistTracks.findIndex(t => t.id === track.id);
      setCurrentPlaylistIndex(trackIndex);
    }
    
    setCurrentMusic(track);
    setIsPlaying(true);
    
    // 检查收藏状态
    try {
      const response = await fetch(`/api/music/favorites/${track.id}`);
      const result = await response.json();
      if (result.success) {
        setFavorite(result.data.favorite || false);
      }
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      setFavorite(false);
    }
    
    // 加载歌词
    loadLyrics(track.id);
  };

  // 播放下一首
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

  // 播放上一首
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

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    playMusic,
    nextTrack,
    prevTrack,
    addToPlaylist,
    loadLyrics
  }));

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack();
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [repeatMode]);

  // 音频源更新
  useEffect(() => {
    if (currentMusic && audioRef.current) {
      audioRef.current.src = `/api/music/stream/${currentMusic.id}`;
      if (isPlaying) {
        audioRef.current.play();
      }
    }
  }, [currentMusic]);

  // 音量控制
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <>
      {/* 底部播放器 - 始终显示 */}
      <div className="bottom-player">
        {/* 音频元素 */}
        <audio ref={audioRef} preload="metadata" />
        <div className="player-track-info">
          {currentMusic ? (
            <>
              <img src={currentMusic.coverImage || '/images/default_cover.png'} alt="封面" className="player-cover" />
              <div className="player-info">
                <div className="player-title">{currentMusic.title}</div>
                <div className="player-artist">{currentMusic.artist}</div>
                {parsedLyrics.length > 0 && (
                  <div className="player-lyrics">
                    {parsedLyrics.find(lyric => lyric.time <= currentTime)?.text || ''}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="player-cover-placeholder">
                🎵
              </div>
              <div className="player-info">
                <div className="player-title">未选择音乐</div>
                <div className="player-artist">请从音乐列表中选择一首歌曲</div>
              </div>
            </>
          )}
        </div>

        <div className="player-controls">
          <div className="controls-left">
            <div className="control-buttons">
              {/* 播放模式：合并随机/循环/单曲 */}
              <button
                onClick={() => {
                  const modes = ['none', 'shuffle', 'all', 'one'];
                  const idx = modes.indexOf(playMode);
                  setPlayMode(modes[(idx + 1) % modes.length]);
                  // 同步外部状态
                  if (modes[(idx + 1) % modes.length] === 'shuffle') {
                    !isShuffled && setIsShuffled(true);
                  } else if (playMode === 'shuffle') {
                    isShuffled && setIsShuffled(false);
                  }
                  const nextMode = modes[(idx + 1) % modes.length];
                  if (nextMode === 'one') {
                    setRepeatMode('one');
                  } else if (nextMode === 'all') {
                    setRepeatMode('all');
                  } else {
                    setRepeatMode('none');
                  }
                }}
                className={`control-btn ${playMode !== 'none' ? 'active' : ''}`}
                title={`播放模式: ${playMode}`}
                disabled={!currentMusic}
              >
                {playMode === 'shuffle' ? '🔀' : playMode === 'one' ? '🔂' : '🔁'}
              </button>
              <button 
                onClick={prevTrack}
                className="control-btn"
                disabled={!currentMusic || playlist.length === 0}
                title="上一首"
              >
                ⏮️
              </button>
              <button 
                onClick={() => {
                  if (isPlaying) {
                    audioRef.current.pause();
                  } else {
                    audioRef.current.play();
                  }
                }}
                className="play-btn-main"
                disabled={!currentMusic}
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              <button 
                onClick={nextTrack}
                className="control-btn"
                disabled={!currentMusic || playlist.length === 0}
                title="下一首"
              >
                ⏭️
              </button>
              
              {/* 收藏按钮 */}
              <button
                onClick={async () => {
                  if (!currentMusic) return;
                  try {
                    const response = await fetch(`/api/music/favorites/${currentMusic.id}`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ favorite: !favorite })
                    });
                    const result = await response.json();
                    if (result.success) {
                      setFavorite(!favorite);
                    }
                  } catch (error) {
                    console.error('收藏操作失败:', error);
                  }
                }}
                className={`control-btn ${favorite ? 'active' : ''}`}
                disabled={!currentMusic}
                title={favorite ? '取消收藏' : '收藏'}
              >
                {favorite ? '❤️' : '🤍'}
              </button>
            </div>

            <div className="progress-section">
              <span className="time-display">{formatTime(currentTime)}</span>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => {
                    const newTime = parseFloat(e.target.value);
                    if (audioRef.current) {
                      audioRef.current.currentTime = newTime;
                    }
                    setCurrentTime(newTime);
                  }}
                  className="progress-slider"
                />
              </div>
              <span className="time-display">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="controls-right">
            {/* 歌词显示 */}
            {parsedLyrics.length > 0 ? (
              <div className="controls-lyrics">
                <div className="lyrics-text">
                  {parsedLyrics.find(lyric => lyric.time <= currentTime)?.text || ''}
                </div>
              </div>
            ) : (
              <div className="controls-lyrics">
                <div className="lyrics-text">暂无歌词</div>
              </div>
            )}
          </div>
        </div>

        <div className="player-volume">
          {/* 音量控制 */}
          <button
            onClick={() => {
              setMuted(!muted);
              if (audioRef.current) {
                audioRef.current.muted = !muted;
              }
            }}
            className="control-btn"
            title={muted ? '取消静音' : '静音'}
          >
            {muted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={muted ? 0 : volume}
            onChange={(e) => {
              const newVolume = parseFloat(e.target.value);
              setVolume(newVolume);
              if (audioRef.current) {
                audioRef.current.volume = newVolume;
              }
            }}
            className="volume-slider"
          />
          
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className="control-btn"
            title="播放列表"
          >
            📋
          </button>
        </div>
      </div>

      {/* 播放列表面板 */}
      {showPlaylist && (
        <>
          <div className="playlist-overlay" onClick={() => setShowPlaylist(false)} />
          <div className="playlist-panel">
            <div className="playlist-header">
              <h3>播放列表 ({playlist.length})</h3>
              <div className="playlist-controls">
                <button 
                  onClick={() => {
                    setPlaylist([]);
                    setCurrentPlaylistIndex(-1);
                    setCurrentMusic(null);
                    setIsPlaying(false);
                  }}
                  className="playlist-clear-btn"
                  disabled={playlist.length === 0}
                >
                  清空
                </button>
                <button 
                  onClick={() => setShowPlaylist(false)}
                  className="playlist-close-btn"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="playlist-tracks">
              {playlist.length === 0 ? (
                <div className="playlist-empty">
                  <p>播放列表为空</p>
                  <p>从音乐列表中添加歌曲到播放列表</p>
                </div>
              ) : (
                playlist.map((track, index) => (
                  <div
                    key={track.id}
                    className={`playlist-item ${index === currentPlaylistIndex ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentPlaylistIndex(index);
                      playMusic(track);
                    }}
                  >
                    <div className="playlist-item-info">
                      <div className="playlist-item-title">{track.title}</div>
                      <div className="playlist-item-artist">{track.artist}</div>
                    </div>
                    <div className="playlist-item-duration">
                      {formatTime(track.duration || 0)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newPlaylist = playlist.filter((_, i) => i !== index);
                        setPlaylist(newPlaylist);
                        if (index === currentPlaylistIndex) {
                          if (newPlaylist.length > 0) {
                            const nextIndex = index >= newPlaylist.length ? 0 : index;
                            setCurrentPlaylistIndex(nextIndex);
                            playMusic(newPlaylist[nextIndex]);
                          } else {
                            setCurrentPlaylistIndex(-1);
                            setCurrentMusic(null);
                            setIsPlaying(false);
                          }
                        } else if (index < currentPlaylistIndex) {
                          setCurrentPlaylistIndex(currentPlaylistIndex - 1);
                        }
                      }}
                      className="playlist-item-remove"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* 浮动歌词 */}
      {parsedLyrics.length > 0 && (
        <div className="floating-lyrics">
          <div className="floating-lyrics-line">
            {parsedLyrics.find(lyric => lyric.time <= currentTime)?.text || ''}
          </div>
        </div>
      )}
    </>
  );
});

Player.displayName = 'Player';

export default Player;
