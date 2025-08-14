import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InfiniteScroll } from '../../components/common';
import '../Pages.css';
import './Albums.css';

const pageData = {
  nextPage: 1,
  hasMore: true,
  loading: false,
  data: [],
}
/**
 * 专辑页面组件
 */
const AlbumsPage = ({ router, player }) => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // 加载专辑数据
  const loadAlbums = async (clearData = false, searchKeyword = '') => {
    if (pageData.loading) return;
    if (clearData)  {
      pageData.nextPage = 1;
      pageData.hasMore = true;
      pageData.data = [];
    }
    try {
      pageData.loading = true;
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(pageData.nextPage));
      params.set('pageSize', String(10));
      if (searchKeyword) {
        params.set('query', searchKeyword);
      }
      const result = await fetch(`/api/music/albums?${params.toString()}`).then(res => res.json())
      const pagination = result.pagination || {};
      pageData.nextPage = pageData.nextPage + 1;
      pageData.hasMore = pagination.page < pagination.pages;
      pageData.data = [...pageData.data, ...result.data];
    } finally {
      pageData.loading = false;
      setAlbums(pageData.data);
      setHasMore(pageData.hasMore);
      setLoading(false);
    }
  };

  // 加载下一页
  const loadNext = () => {
    if (!pageData.loading && pageData.hasMore) {
      loadAlbums(false, search);
    }
  };

  // 处理搜索变化（带防抖）
  const handleSearchChange = (e) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadAlbums(true, newSearch);
    }, 300);
  };

  // 处理专辑点击
  const handleAlbumClick = (album) => {
    router.navigate('album-detail', { album });
  };

  // 初始加载
  useEffect(() => {
    loadAlbums(true, '');
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="page-container albums-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => router.switchSidebar()}> ☰ </button>
          <h2>💿 专辑库</h2>
        </div>
        <div className="fav-actions">
          <input className="fav-search" placeholder="搜索专辑..." value={search} onChange={handleSearchChange} />
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
                  style={{
                    backgroundImage: album.coverImage ? `url(${album.coverImage})` : `url(/images/default_albums.png)`
                  }}
                >
                  <div className="album-overlay">
                    <div className="album-info">
                      <h3 className="album-name">{album.normalizedTitle}</h3>
                      <p className="album-artist">{album.artist || album.albumArtist}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {albums.length === 0 && !loading && (
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
