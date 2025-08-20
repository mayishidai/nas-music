import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InfiniteScroll } from '../../components/common';
import { useNavigate } from 'react-router-dom';
import { useUrlState } from '../../hooks';
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
const AlbumsPage = ({ player }) => {
  const navigate = useNavigate();
  
  // 使用URL状态管理
  const { state, setSearch } = useUrlState({
    search: ''
  });

  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeoutRef = useRef(null);

  // 加载专辑数据
  const loadAlbums = async (clearData = false, searchKeyword = state.search) => {
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
      loadAlbums(false, state.search);
    }
  };

  // 处理搜索变化
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

  // 清除搜索
  const handleClearSearch = () => {
    setSearch('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    loadAlbums(true, '');
  };

  // 执行搜索
  const handleSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    loadAlbums(true, state.search);
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 处理专辑点击
  const handleAlbumClick = (album) => {
    navigate(`/album/${album.id || album._id}`);
  };

  // 当搜索状态变化时重新加载
  useEffect(() => {
    loadAlbums(true, state.search);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [state.search]);

  return (
    <div className="page-container albums-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => player.switchSidebar()}> ☰ </button>
          <h2>💿 专辑库</h2>
        </div>
        <div className="fav-actions">
          <div className="search-container">
            <input 
              className="fav-search" 
              placeholder="搜索专辑..." 
              value={state.search} 
              onChange={handleSearchChange}
              onKeyPress={handleSearchKeyPress}
            />
            {state.search && (
              <button 
                className="search-clear-btn"
                onClick={handleClearSearch}
                title="清除搜索"
              >
                ✕
              </button>
            )}
            <button 
              className="search-btn"
              onClick={handleSearch}
              title="搜索"
            >
              🔍
            </button>
          </div>
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
                      <h3 className="album-name">{album.title}</h3>
                      <div className="album-meta">
                        <span className="album-artist">{album.artist || album.albums}</span>
                        {album.trackCount && (
                          <>
                            <span className="album-separator">•</span>
                            <span className="album-track-count">{album.trackCount} 首歌曲</span>
                          </>
                        )}
                      </div>
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
