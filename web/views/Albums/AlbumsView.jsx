import React from 'react';
import './AlbumsView.css';

/**
 * 专辑视图组件
 * 展示专辑网格布局
 */
const AlbumsView = ({ 
  albums = [], 
  onAlbumClick, 
  loading = false, 
  hasMore = false, 
  lastAlbumElementRef 
}) => {
  return (
    <div className="albums-view">
      <div className="albums-grid">
        {albums.map((album, index) => {
          const isLast = index === albums.length - 1;
          return (
            <div 
              key={album.id || album._id} 
              className="album-card"
              onClick={() => onAlbumClick && onAlbumClick(album)}
              ref={isLast ? lastAlbumElementRef : null}
            >
              <div className="album-cover">
                {album.coverImage ? (
                  <img 
                    src={album.coverImage}
                    alt={album.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="album-cover-placeholder">
                  <span>💿</span>
                </div>
              </div>
              <div className="album-info">
                <h3 className="album-name">{album.name}</h3>
                <p className="album-artist">{album.artist || album.albumArtist}</p>
                <p className="album-tracks">{album.trackCount || (album.tracks?.length || 0)} 首歌曲</p>
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
      
      {!loading && albums.length === 0 && (
        <div className="empty-state">
          <h3>暂无专辑</h3>
          <p>音乐库中还没有专辑信息</p>
        </div>
      )}
      
      {!loading && !hasMore && albums.length > 0 && (
        <div className="end-state">
          <p>已加载全部专辑</p>
        </div>
      )}
    </div>
  );
};

export default AlbumsView;
