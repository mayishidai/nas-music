import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InfiniteScroll } from '../../components/common';
import { useNavigate } from 'react-router-dom';
import { useUrlState } from '../../hooks';
import '../Pages.css';
import './Artists.css';

const pageData = {
  nextPage: 1,
  hasMore: true,
  loading: false,
  data: [],
}

/**
 * 艺术家页面组件
 */
const ArtistsPage = ({ player }) => {
  const navigate = useNavigate();
  
  // 使用URL状态管理
  const { state, setSearch } = useUrlState({
    search: ''
  });

  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeoutRef = useRef(null);

  // 加载艺术家数据
  const loadArtists = async (clearData = false, searchKeyword = state.search) => {
    if (pageData.loading) return;
    if (clearData) {
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
      const result = await fetch(`/api/music/artists?${params.toString()}`).then(res => res.json())
      const pagination = result.pagination || {};
      pageData.nextPage = pageData.nextPage + 1;
      pageData.hasMore = pagination.page < pagination.pages;
      pageData.data = [...pageData.data, ...result.data];
    } catch (error) {
      console.error('加载艺术家列表失败:', error);
    } finally {
      pageData.loading = false;
      setArtists(pageData.data);
      setHasMore(pageData.hasMore);
      setLoading(false);
    }
  };

  // 加载下一页
  const loadNext = () => {
    if (!pageData.loading && pageData.hasMore) {
      loadArtists(false, state.search);
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
      loadArtists(true, newSearch);
    }, 300);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearch('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    loadArtists(true, '');
  };

  // 执行搜索
  const handleSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    loadArtists(true, state.search);
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 处理艺术家点击
  const handleArtistClick = (artist) => {
    navigate(`/artist/${artist.id || artist._id}`);
  };

  // 当搜索状态变化时重新加载
  useEffect(() => {
    loadArtists(true, state.search);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [state.search]);

  return (
    <div className="page-container artists-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => player.switchSidebar()}> ☰ </button>
          <h2>👤 艺术家库</h2>
        </div>
        <div className="fav-actions">
          <div className="search-container">
            <input 
              className="fav-search" 
              placeholder="搜索艺术家..." 
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
        loadingText="正在加载更多艺术家..."
        endText="已加载全部艺术家"
      >
        <div className="artists-view">
          <div className="artists-grid">
            {artists.map((artist, index) => {
              return (
                <div 
                  key={artist.id || artist._id} 
                  className="artist-card"
                  onClick={() => handleArtistClick(artist)}
                  style={{
                    backgroundImage: artist.photo ? `url(${artist.photo})` : `url(/images/default_artists.png)`
                  }}
                >
                  <div className="artist-overlay">
                    <div className="artist-info">
                      <h3 className="artist-name">{artist.name}</h3>
                      <p className="artist-stats">{artist.trackCount || 0} 首歌曲 • {artist.albumCount || 0} 张专辑</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {artists.length === 0 && !loading && (
            <div className="empty-state">
              <h3>暂无艺术家</h3>
              <p>音乐库中还没有艺术家信息</p>
            </div>
          )}
        </div>
      </InfiniteScroll>
    </div>
  );
};

export default ArtistsPage;
