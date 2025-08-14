import React, { useState, useEffect, useCallback } from 'react';
import { InfiniteScroll } from '../../components/common';
import '../Pages.css';
import './Albums.css';

/**
 * 专辑页面组件
 */
const AlbumsPage = ({ router, player }) => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const pageSize = 10;

  // 加载专辑数据
  const loadAlbums = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/music/albums?page=${targetPage}&pageSize=${pageSize}`);
      const result = await response.json();
      
      if (result.success) {
        const newAlbums = result.data || [];
        const pagination = result.pagination || {};
        
        if (targetPage === 1) {
          setAlbums(newAlbums);
        } else {
          setAlbums(prev => [...prev, ...newAlbums]);
        }
        
        setTotal(pagination.total || 0);
        setHasMore(pagination.page < pagination.pages);
        setPage(targetPage);
      }
    } catch (error) {
      console.error('加载专辑列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载下一页
  const loadNext = useCallback(() => {
    if (!loading && hasMore) {
      loadAlbums(page + 1);
    }
  }, [loading, hasMore, page, loadAlbums]);

  // 处理专辑点击
  const handleAlbumClick = (album) => {
    router.navigate('album-detail', { album });
  };

  // 初始加载
  useEffect(() => {
    loadAlbums(1);
  }, []);

  return (
    <div className="page-container albums-container">
      <div className="fav-toolbar">
        <h2>💿 专辑库</h2>
        <div className="fav-actions">
          <input
            className="fav-search"
            placeholder="搜索专辑..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <InfiniteScroll
        loadNext={loadNext}
        hasMore={hasMore}
        loading={loading}
        threshold={100}
        loadingText="正在加载更多专辑..."
        endText="已加载全部专辑"
      >
        <div className="albums-view">
          <div className="albums-grid">
            {albums.map((album, index) => {
              return (
                <div 
                  key={album.id || album._id} 
                  className="album-card"
                  onClick={() => handleAlbumClick(album)}
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
          
          {albums.length === 0 && (
            <div className="empty-state">
              <h3>暂无专辑</h3>
              <p>音乐库中还没有专辑信息</p>
            </div>
          )}
        </div>
      </InfiniteScroll>
    </div>
  );
};

export default AlbumsPage;
