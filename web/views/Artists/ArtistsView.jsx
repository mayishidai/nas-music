import React from 'react';
import './ArtistsView.css';

/**
 * 艺术家视图组件
 * 展示艺术家列表 - 卡片：上半区背景为歌手照片/占位，下半区展示信息
 */
const ArtistsView = ({ 
  artists = [], 
  onArtistClick, 
  loading = false, 
  hasMore = false, 
  lastArtistElementRef 
}) => {
  return (
    <div className="artists-view">
      <div className="artists-grid">
        {artists.map((artist, index) => {
          const isLast = index === artists.length - 1;
          return (
            <div 
              key={artist.id || artist._id} 
              className="artist-card"
              onClick={() => onArtistClick && onArtistClick(artist)}
              ref={isLast ? lastArtistElementRef : null}
            >
              <div
                className="artist-banner"
                style={{
                  backgroundImage: artist.photo || artist.coverImage
                    ? `url(${artist.photo || artist.coverImage})`
                    : undefined
                }}
              >
                {!artist.photo && !artist.coverImage && (
                  <div className="artist-banner-placeholder">👤</div>
                )}
              </div>
              <div className="artist-info">
                <h3 className="artist-name">{artist.name || '未知艺术家'}</h3>
                <div className="artist-meta">
                  <span>{artist.albumCount || 0} 张专辑</span>
                  <span className="dot">•</span>
                  <span>{artist.trackCount || 0} 首歌曲</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner">🔄</div>
          <p>加载中...</p>
        </div>
      )}
      
      {!loading && artists.length === 0 && (
        <div className="empty-state">
          <h3>暂无艺术家</h3>
          <p>音乐库中还没有艺术家信息</p>
        </div>
      )}
      
      {!loading && !hasMore && artists.length > 0 && (
        <div className="end-state">
          <p>已加载全部艺术家</p>
        </div>
      )}
    </div>
  );
};

export default ArtistsView;
