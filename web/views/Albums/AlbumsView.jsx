import React from 'react';
import './AlbumsView.css';

/**
 * 专辑视图组件
 * 展示专辑网格布局
 */
const AlbumsView = ({ albums = [], onAlbumClick }) => {
  return (
    <div className="albums-view">
      <div className="albums-grid">
        {albums.map(album => (
          <div 
            key={album.id} 
            className="album-card"
            onClick={() => onAlbumClick && onAlbumClick(album)}
          >
            <div className="album-cover">
              <img 
                src={album.coverImage || `/api/music/cover/${album.id}`} 
                alt={album.name}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="album-cover-placeholder">
                <span>💿</span>
              </div>
            </div>
            <div className="album-info">
              <h3 className="album-name">{album.name}</h3>
              <p className="album-artist">{album.artist}</p>
              <p className="album-tracks">{album.trackCount || 0} 首歌曲</p>
            </div>
          </div>
        ))}
      </div>
      
      {albums.length === 0 && (
        <div className="empty-state">
          <h3>暂无专辑</h3>
          <p>音乐库中还没有专辑信息</p>
        </div>
      )}
    </div>
  );
};

export default AlbumsView;
