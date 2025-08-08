import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const Player = ({
  currentMusic,
  isPlaying,
  currentTime,
  duration,
  volume,
  playlist,
  currentPlaylistIndex,
  isShuffled,
  repeatMode,
  lyrics,
  showLyrics,
  currentLyricLine,
  lyricsLoading,
  parsedLyrics,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onVolumeChange,
  onTimeChange,
  onShuffleToggle,
  onRepeatModeChange,
  onPlaylistToggle,
  onLyricsToggle,
  onPlaylistItemClick,
  onPlaylistItemRemove,
  onPlaylistClear
}) => {
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showLyricsPanel, setShowLyricsPanel] = useState(false);

  // 格式化时间
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* 底部播放器 - 始终显示 */}
      <div className="bottom-player">
        <div className="player-track-info">
          {currentMusic ? (
            <>
              <img 
                src={`/api/music/cover/${currentMusic.id}`}
                alt="封面"
                className="player-cover"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0zMCAxNUw0NSAzMEwzMCA0NUwxNSAzMEwzMCAxNVoiIGZpbGw9IiNjY2MiLz4KPC9zdmc+';
                }}
              />
              <div className="player-info">
                <div className="player-title">{currentMusic.title}</div>
                <div className="player-artist">{currentMusic.artist}</div>
                {showLyrics && currentLyricLine && (
                  <div className="player-lyrics">
                    {currentLyricLine}
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
          <div className="control-buttons">
            <button 
              onClick={onShuffleToggle}
              className={`control-btn ${isShuffled ? 'active' : ''}`}
              title="随机播放"
              disabled={!currentMusic}
            >
              🔀
            </button>
            <button 
              onClick={onPrev} 
              className="control-btn" 
              title="上一首"
              disabled={!currentMusic || playlist.length === 0}
            >
              ⏮️
            </button>
            <button 
              onClick={currentMusic ? (isPlaying ? onPause : onPlay) : null}
              className="play-btn-main"
              title={currentMusic ? (isPlaying ? '暂停' : '播放') : '请先选择音乐'}
              disabled={!currentMusic}
            >
              {currentMusic ? (isPlaying ? '⏸️' : '▶️') : '▶️'}
            </button>
            <button 
              onClick={onNext} 
              className="control-btn" 
              title="下一首"
              disabled={!currentMusic || playlist.length === 0}
            >
              ⏭️
            </button>
            <button 
              onClick={onRepeatModeChange}
              className={`control-btn ${repeatMode !== 'none' ? 'active' : ''}`}
              title={`重复模式: ${repeatMode === 'none' ? '关闭' : repeatMode === 'one' ? '单曲' : '全部'}`}
              disabled={!currentMusic}
            >
              {repeatMode === 'one' ? '🔂' : '🔁'}
            </button>
          </div>
          
          <div className="progress-section">
            <span className="time-display">{formatTime(currentTime)}</span>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => {
                  const time = parseFloat(e.target.value);
                  onTimeChange(time);
                }}
                className="progress-slider"
                disabled={!currentMusic}
              />
            </div>
            <span className="time-display">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-volume">
          <span>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              const vol = parseFloat(e.target.value);
              onVolumeChange(vol);
            }}
            className="volume-slider"
          />
          <button 
            onClick={() => setShowLyricsPanel(!showLyricsPanel)}
            className={`control-btn ${showLyricsPanel ? 'active' : ''}`}
            title="歌词面板"
            disabled={lyricsLoading || !currentMusic}
          >
            {lyricsLoading ? '⏳' : '📝'}
          </button>
          <button 
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`control-btn ${showPlaylist ? 'active' : ''}`}
            title="播放列表"
          >
            📋
          </button>
        </div>
      </div>

      {/* 播放列表面板 */}
      {showPlaylist && (
        <div className="playlist-panel">
          <div className="playlist-header">
            <h3>播放列表 ({playlist.length})</h3>
            <div className="playlist-controls">
              <button 
                onClick={onPlaylistClear}
                className="playlist-clear-btn"
                disabled={playlist.length === 0}
              >
                清空
              </button>
              <button 
                onClick={() => setShowPlaylist(false)}
                className="playlist-close-btn"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="playlist-tracks">
            {playlist.length === 0 ? (
              <div className="playlist-empty">
                <p>播放列表为空</p>
                <p>双击音乐或点击播放按钮添加音乐</p>
              </div>
            ) : (
              playlist.map((track, index) => (
                <div 
                  key={track.id} 
                  className={`playlist-item ${currentPlaylistIndex === index ? 'active' : ''}`}
                  onClick={() => onPlaylistItemClick(track, index)}
                >
                  <div className="playlist-item-info">
                    <div className="playlist-item-title">{track.title}</div>
                    <div className="playlist-item-artist">{track.artist}</div>
                  </div>
                  <div className="playlist-item-duration">{formatTime(track.duration)}</div>
                  <button 
                    className="playlist-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaylistItemRemove(index);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 歌词面板 */}
      {showLyricsPanel && (
        <div className="lyrics-panel">
          <div className="lyrics-header">
            <h3>歌词</h3>
            <div className="lyrics-controls">
              <button 
                onClick={onLyricsToggle}
                className={`lyrics-toggle-btn ${showLyrics ? 'active' : ''}`}
                title={showLyrics ? '关闭歌词显示' : '开启歌词显示'}
              >
                {showLyrics ? '👁️' : '👁️‍🗨️'}
              </button>
              <button 
                onClick={() => setShowLyricsPanel(false)}
                className="lyrics-close-btn"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="lyrics-content">
            {lyricsLoading ? (
              <div className="lyrics-loading">
                <div className="loading-spinner">⏳</div>
                <p>加载歌词中...</p>
              </div>
            ) : parsedLyrics.length > 0 ? (
              <div className="lyrics-list">
                {parsedLyrics.map((line, index) => (
                  <div 
                    key={index}
                    className={`lyrics-line ${currentLyricLine === line.text ? 'active' : ''}`}
                  >
                    {line.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="lyrics-empty">
                <p>暂无歌词</p>
                <p>该歌曲没有找到歌词文件</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Player;
