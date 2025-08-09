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
  const [muted, setMuted] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [playMode, setPlayMode] = useState('none'); // none | one | all | shuffle

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
                src={currentMusic.coverImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0xNiA4TDIyIDE2TDE2IDI0TDEwIDE2TDE2IDhaIiBmaWxsPSIjY2NjIi8+Cjwvc3ZnPg=='}
                alt="封面"
                className="player-cover"
              />
              <div className="player-info">
                <div className="player-title">{currentMusic.title}</div>
                <div className="player-artist">{currentMusic.artist}</div>
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
                  !isShuffled && onShuffleToggle && onShuffleToggle();
                } else if (playMode === 'shuffle') {
                  isShuffled && onShuffleToggle && onShuffleToggle();
                }
                if (onRepeatModeChange) onRepeatModeChange();
              }}
              className={`control-btn ${playMode !== 'none' ? 'active' : ''}`}
              title={`播放模式: ${playMode}`}
              disabled={!currentMusic}
            >
              {playMode === 'shuffle' ? '🔀' : playMode === 'one' ? '🔂' : '🔁'}
            </button>
            <button 
              onClick={onPrev} 
              className="control-btn" 
              title="上一首"
              disabled={!currentMusic || playlist.length === 0}
            >
              ‹
            </button>
            <button 
              onClick={currentMusic ? (isPlaying ? onPause : onPlay) : null}
              className="play-btn-main"
              title={currentMusic ? (isPlaying ? '暂停' : '播放') : '请先选择音乐'}
              disabled={!currentMusic}
            >
              {currentMusic ? (isPlaying ? '❚❚' : '▶') : '▶'}
            </button>
            <button 
              onClick={onNext} 
              className="control-btn" 
              title="下一首"
              disabled={!currentMusic || playlist.length === 0}
            >
              ›
            </button>
            {/* 收藏 */}
            <button
              onClick={() => {
                if (!currentMusic) return;
                const id = currentMusic._id || currentMusic.id;
                fetch(`/api/music/tracks/${id}/favorite`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorite: !favorite }) })
                  .then(() => setFavorite(!favorite))
                  .catch(() => {});
              }}
              className={`control-btn ${favorite ? 'active' : ''}`}
              title={favorite ? '取消收藏' : '收藏'}
              disabled={!currentMusic}
            >
              ⭐
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

          {showLyrics && currentMusic && (
            <div className="controls-lyrics">
              <span className="lyrics-text">{currentLyricLine || ''}</span>
            </div>
          )}
        </div>

        <div className="player-volume">
          <button className="control-btn" title={muted ? '取消静音' : '静音'} onClick={() => { setMuted(!muted); onVolumeChange(muted ? volume : 0); }}>
            {muted ? '🔈' : '🔊'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={muted ? 0 : volume}
            onChange={(e) => {
              const vol = parseFloat(e.target.value);
              onVolumeChange(vol);
              if (vol > 0 && muted) setMuted(false);
            }}
            className="volume-slider"
          />
          <button 
            onClick={onLyricsToggle}
            className={`control-btn lyrics-toggle ${showLyrics ? 'active' : ''}`}
            title="歌词"
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
        <>
          <div className="playlist-overlay" onClick={() => setShowPlaylist(false)} />
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
        </>
      )}

      {/* KTV式浮动歌词（保留，可按需与 inline 同时显示或仅保留一个） */}
    </>
  );
};

export default Player;
