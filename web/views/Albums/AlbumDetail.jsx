import React, { useMemo, useState } from 'react';
import './AlbumDetail.css';

/**
 * 专辑详情视图
 */
const AlbumDetailView = ({ album, onBack, onPlay, onPlayAll, onAddToPlaylist, onFavorite }) => {
  const [showMoreMenu, setShowMoreMenu] = useState(null);
  const tracks = useMemo(() => (album?.tracks || []).filter(Boolean), [album]);
  const cover = useMemo(() => {
    return album?.coverImage || tracks.find(t => t?.coverImage)?.coverImage || null;
  }, [album, tracks]);

  return (
    <div className="album-detail">
      <div className="album-detail-header">
        <button className="ad-back" onClick={onBack}>← 返回</button>
        <div className="ad-cover-wrap">
          {cover ? (
            <img className="ad-cover" src={cover} alt={album?.name || '专辑'} />
          ) : (
            <div className="ad-cover placeholder">💿</div>
          )}
        </div>
        <div className="ad-meta">
          <h2 className="ad-title">{album?.name || '未知专辑'}</h2>
          <div className="ad-sub">{album?.artist || album?.albumArtist || '未知艺术家'} · {tracks.length} 首</div>
          <div className="ad-actions">
            <button className="ad-btn primary" onClick={onPlayAll}>▶ 播放全部</button>
            <button className="ad-btn" onClick={() => tracks.forEach(t => onAddToPlaylist && onAddToPlaylist(t))}>➕ 加入播放列表</button>
          </div>
        </div>
      </div>

      <div className="album-detail-tracks">
          <div className="ad-tracks-header">
          <div className="th th-no">#</div>
          <div className="th th-title">标题</div>
          <div className="th th-artist">艺术家</div>
          <div className="th th-duration">时长</div>
          <div className="th th-actions">操作</div>
        </div>
        <div className="ad-tracks-body">
          {tracks.map((t, idx) => (
            <div
              key={t._id || t.id}
              className="tr"
              onDoubleClick={() => onPlay && onPlay(t)}
            >
              <div className="td td-no">{idx + 1}</div>
              <div className="td td-title">
                <div className="title-wrap">
                  {t.coverImage && <img className="td-cover" src={t.coverImage} alt="封面" />}
                  <div className="title-text">
                    <div className="title" title={t.title}>{t.title}</div>
                    <div className="sub" title={t.album}>{t.album}</div>
                  </div>
                </div>
              </div>
              <div className="td td-artist">{t.artist}</div>
              <div className="td td-duration">{formatDuration(t.duration)}</div>
              <div className="td td-actions">
                <button className="ml-btn play" title="播放" onClick={() => onPlay && onPlay(t)}>▶️</button>
                <button
                  className="ml-btn"
                  title="添加到播放列表"
                  onClick={() => onAddToPlaylist && onAddToPlaylist(t)}
                >
                  ➕
                </button>
                <div className="ml-more-container">
                  <button
                    className="ml-btn more"
                    title="更多操作"
                    onClick={() => setShowMoreMenu(showMoreMenu === (t._id || t.id) ? null : (t._id || t.id))}
                  >
                    ⋯
                  </button>
                  {showMoreMenu === (t._id || t.id) && (
                    <div className="ml-more-menu">
                      <button
                        className="ml-more-item"
                        onClick={() => {
                          onFavorite && onFavorite(t, !t.favorite);
                          setShowMoreMenu(null);
                        }}
                      >
                        {t.favorite ? '⭐ 取消收藏' : '⭐ 收藏'}
                      </button>
                      <button
                        className="ml-more-item"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            const ev = new CustomEvent('openTrackDetail', { detail: { track: t } });
                            window.dispatchEvent(ev);
                          }
                          setShowMoreMenu(null);
                        }}
                      >
                        ℹ️ 详情
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {tracks.length === 0 && (
            <div className="tr empty">暂无曲目</div>
          )}
        </div>
      </div>
    </div>
  );
};

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--:--';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default AlbumDetailView;


