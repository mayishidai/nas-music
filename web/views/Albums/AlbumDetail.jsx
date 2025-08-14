import React, { useMemo, useState } from 'react';
import './AlbumDetail.css';

/**
 * 专辑详情视图
 */
const AlbumDetailView = ({ router, player }) => {
  const [showMoreMenu, setShowMoreMenu] = useState(null);
  const album = router.getCurrentData().album;
  const tracks = useMemo(() => (album?.tracks || []).filter(Boolean), [album]);
  const cover = useMemo(() => {
    return album?.coverImage || tracks.find(t => t?.coverImage)?.coverImage || null;
  }, [album, tracks]);

  // 格式化时长
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 处理播放全部
  const handlePlayAll = () => {
    if (tracks.length > 0) {
      player.playMusic(tracks[0], tracks);
    }
  };

  // 处理播放单首
  const handlePlay = (track) => {
    player.playMusic(track, tracks);
  };

  // 处理添加到播放列表
  const handleAddToPlaylist = (track) => {
    player.addToPlaylist(track);
  };

  // 处理收藏
  const handleFavorite = async (track, favorite) => {
    try {
      const response = await fetch(`/api/music/tracks/${track.id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite })
      });
      if (response.ok) {
        // 更新本地状态
        track.favorite = favorite;
      }
    } catch (error) {
      console.error('更新收藏状态失败:', error);
    }
  };

  // 处理打开详情
  const handleOpenDetail = (track) => {
    router.navigate('track-detail', { track });
  };

  if (!album) {
    return <div className="page-container">专辑不存在</div>;
  }

  return (
    <div className="album-detail">
      <div className="album-detail-header">
        <button className="ad-back" onClick={router.goBack}>← 返回</button>
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
            <button className="ad-btn primary" onClick={handlePlayAll}>▶ 播放全部</button>
            <button className="ad-btn" onClick={() => tracks.forEach(t => handleAddToPlaylist(t))}>➕ 加入播放列表</button>
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
              onDoubleClick={() => handlePlay(t)}
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
                <button className="ml-btn play" title="播放" onClick={() => handlePlay(t)}>▶️</button>
                <button
                  className="ml-btn"
                  title="添加到播放列表"
                  onClick={() => handleAddToPlaylist(t)}
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
                          handleFavorite(t, !t.favorite);
                          setShowMoreMenu(null);
                        }}
                      >
                        {t.favorite ? '⭐ 取消收藏' : '⭐ 收藏'}
                      </button>
                      <button
                        className="ml-more-item"
                        onClick={() => {
                          handleOpenDetail(t);
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
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailView;


