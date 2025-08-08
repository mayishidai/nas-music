import React from 'react';
import './ArtistsView.css';

/**
 * 艺术家视图组件
 * 展示艺术家列表
 */
const ArtistsView = ({ artists = [], onArtistClick }) => {
  return (
    <div className="artists-view">
      <div className="artists-grid">
        {artists.map(artist => (
          <div 
            key={artist.id} 
            className="artist-card"
            onClick={() => onArtistClick && onArtistClick(artist)}
          >
            <div className="artist-avatar">
              <div className="avatar-placeholder">
                <span>{artist.name ? artist.name.charAt(0).toUpperCase() : '?'}</span>
              </div>
            </div>
            <div className="artist-info">
              <h3 className="artist-name">{artist.name}</h3>
              <p className="artist-albums">{artist.albumCount || 0} 张专辑</p>
              <p className="artist-tracks">{artist.trackCount || 0} 首歌曲</p>
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
