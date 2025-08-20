import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './AlbumDetail.css';

/**
 * 专辑详情视图
 */
const AlbumDetailView = ({ player }) => {
  const navigate = useNavigate();
  const { albumId } = useParams();
  const [album, setAlbum] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 加载专辑详情和歌曲列表
  useEffect(() => {
    const loadAlbumDetail = async () => {
      if (!albumId) {
        setError('专辑ID不存在');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 获取专辑详情
        const albumResponse = await fetch(`/api/music/albums/${albumId}`);
        const albumResult = await albumResponse.json();

        if (!albumResult.success) {
          throw new Error(albumResult.error || '获取专辑信息失败');
        }

        const albumInfo = albumResult.data;
        setAlbum(albumInfo);
        setTracks(albumInfo.tracks || []);

      } catch (err) {
        console.error('加载专辑详情失败:', err);
        setError(err.message || '加载专辑详情失败');
      } finally {
        setLoading(false);
      }
    };

    loadAlbumDetail();
  }, [albumId]);

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
        const updatedTracks = tracks.map(t => 
          t.id === track.id ? { ...t, favorite } : t
        );
        setTracks(updatedTracks);
      }
    } catch (error) {
      console.error('更新收藏状态失败:', error);
    }
  };

  // 处理打开详情
  const handleOpenDetail = (track) => {
    navigate(`/track/${track}`);
  };

  // 处理艺术家点击
  const handleArtistClick = (artist) => {
    navigate(`/artist/${artist}`);
  };

  // 获取专辑封面
  const getAlbumCover = () => {
    if (album?.coverImage) return album.coverImage;
    if (tracks.length > 0) {
      const trackWithCover = tracks.find(t => t.coverImage);
      return trackWithCover?.coverImage;
    }
    return null;
  };

  // 加载状态
  if (loading) {
    return (
      <div className="album-detail">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载专辑信息...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="album-detail">
        <div className="error-container">
          <h3>加载失败</h3>
          <p>{error}</p>
          <button className="ad-btn" onClick={() => navigate(-1)}>返回</button>
        </div>
      </div>
    );
  }

  // 专辑不存在
  if (!album) {
    return (
      <div className="album-detail">
        <div className="error-container">
          <h3>专辑不存在</h3>
          <p>该专辑可能已被删除或不存在</p>
          <button className="ad-btn" onClick={() => navigate(-1)}>返回</button>
        </div>
      </div>
    );
  }

  const cover = getAlbumCover();

  return (
    <div className="album-detail">
      <div className="album-detail-header">
        <button className="ad-back" onClick={() => navigate(-1)}>← 返回</button>
        <div className="ad-cover-wrap">
          {cover ? (
            <img className="ad-cover" src={cover} alt={album.title || '专辑'} />
          ) : (
            <div className="ad-cover placeholder">💿</div>
          )}
        </div>
        <div className="ad-meta">
          <h2 className="ad-title">{album.title || '未知专辑'}</h2>
          <div className="ad-sub">
            {album.artist || '未知艺术家'} · {tracks.length} 首歌曲
            {album.year && ` · ${album.year}`}
          </div>
          <div className="ad-actions">
            <button 
              className="ad-btn primary" 
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
            >
              ▶ 播放全部
            </button>
            <button 
              className="ad-btn" 
              onClick={() => tracks.forEach(t => handleAddToPlaylist(t))}
              disabled={tracks.length === 0}
            >
              ➕ 加入播放列表
            </button>
          </div>
        </div>
      </div>

      <div className="album-detail-tracks">
        <div className="ad-tracks-header">
          <div className="th th-no">#</div>
          <div className="th th-title">标题</div>
          <div className="th th-artist">艺术家</div>
          <div className="th th-duration">时长</div>
          <div className="th th-actions"><div className='center'>操作</div></div>
        </div>
        <div className="ad-tracks-body">
          {tracks.length === 0 ? (
            <div className="tr empty">
              <div>暂无歌曲</div>
            </div>
          ) : (
            tracks.map((track, idx) => (
              <div
                key={track.id || track._id}
                className="tr"
                onDoubleClick={() => handlePlay(track)}
              >
                <div className="td td-no">{idx + 1}</div>
                <div className="td td-title">
                  <div className="title-wrap">
                    <img className="td-cover" src={track.coverImage || '/images/default_albums.png'} alt="封面" />
                    <div className="title-text">
                      <div className="title" title={track.title}>
                        {track.title || '未知标题'}
                      </div>
                      <div className="sub" title={track.album}>
                        {track.album || album.title}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="td td-artist">
                  <span 
                    className={`artist-link ${track.artist && track.artist !== '未知艺术家' ? 'clickable' : ''}`}
                    onClick={() => handleArtistClick(track.artist)}
                    title={track.artist && track.artist !== '未知艺术家' ? `查看 ${track.artist} 的歌曲` : ''}
                  >
                    {track.artist || '未知艺术家'}
                  </span>
                </div>
                <div className="td td-duration">
                  {formatDuration(track.duration)}
                </div>
                <div className="td td-actions">
                  <div className="action-buttons">
                    <button 
                      className="action-btn play-btn"
                      onClick={() => handlePlay(track)}
                      title="播放"
                    >
                      ▶️
                    </button>
                    <button 
                      className="action-btn add-btn"
                      onClick={() => handleAddToPlaylist(track)}
                      title="添加到播放列表"
                    >
                      ➕
                    </button>
                    <button 
                      className={`action-btn favorite-btn ${track.favorite ? 'favorited' : ''}`}
                      onClick={() => handleFavorite(track, !track.favorite)}
                      title={track.favorite ? '取消收藏' : '收藏'}
                    >
                      {track.favorite ? '⭐' : '☆'}
                    </button>
                    <button 
                      className="action-btn details-btn"
                      onClick={() => handleOpenDetail(track)}
                      title="详情"
                    >
                      ℹ️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailView;


