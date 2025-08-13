import React, { useState, useEffect, useRef, useCallback } from 'react';
import ArtistsView from './ArtistsView';
import '../Pages.css';

/**
 * 艺术家页面组件
 */
const ArtistsPage = ({ onArtistClick }) => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const observer = useRef();
  const pageSize = 10;

  // 加载艺术家数据
  const loadArtists = useCallback(async (targetPage = 1, searchQuery = '') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/music/artists?page=${targetPage}&pageSize=${pageSize}&query=${searchQuery}`);
      const result = await response.json();
      
      if (result.success) {
        const newArtists = result.data || [];
        const pagination = result.pagination || {};
        
        if (targetPage === 1) {
          setArtists(newArtists);
        } else {
          setArtists(prev => [...prev, ...newArtists]);
        }
        
        setTotal(pagination.total || 0);
        setHasMore(pagination.page < pagination.pages);
        setPage(targetPage);
      }
    } catch (error) {
      console.error('加载艺术家列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 搜索处理
  const handleSearch = useCallback((searchQuery) => {
    setSearch(searchQuery);
    setPage(1);
    setHasMore(true);
    loadArtists(1, searchQuery);
  }, [loadArtists]);

  // 滚动加载更多
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadArtists(page + 1, search);
    }
  }, [loading, hasMore, page, search, loadArtists]);

  // 设置滚动观察器
  const lastArtistElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, loadMore]);

  // 初始加载
  useEffect(() => {
    loadArtists(1, search);
  }, []);

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="artists-toolbar">
          <h2>👤 艺术家 ({total})</h2>
          <div className="artists-actions">
            <input
              className="artists-search"
              placeholder="搜索艺术家..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(e.target.value);
                }
              }}
            />
            <button 
              className="search-btn"
              onClick={() => handleSearch(search)}
            >
              搜索
            </button>
          </div>
        </div>
        <ArtistsView
          artists={artists}
          onArtistClick={onArtistClick}
          loading={loading}
          hasMore={hasMore}
          lastArtistElementRef={lastArtistElementRef}
        />
      </div>
    </div>
  );
};

export default ArtistsPage;
