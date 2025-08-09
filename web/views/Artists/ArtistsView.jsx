import React from 'react';
import './ArtistsView.css';

/**
 * 艺术家视图组件
 * 展示艺术家列表 - 卡片：上半区背景为歌手照片/占位，下半区展示信息
 */
const ArtistsView = ({ artists = [], onArtistClick }) => {
  return (
    <div className="artists-view">
      <div className="artists-grid">
        {artists.map(artist => (
          <div 
            key={artist.id || artist._id} 
            className="artist-card"
            onClick={() => onArtistClick && onArtistClick(artist)}
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
        ))}
      </div>
      
      {artists.length === 0 && (
        <div className="empty-state">
          <h3>暂无艺术家</h3>
          <p>音乐库中还没有艺术家信息</p>
        </div>
      )}
    </div>
  );
};

export default ArtistsView;
