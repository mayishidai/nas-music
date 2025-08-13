import React, { useState, useEffect, useRef, useCallback } from 'react';
import AlbumsView from './AlbumsView';
import '../Pages.css';

/**
 * 专辑页面组件
 */
const AlbumsPage = ({ onAlbumClick }) => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const observer = useRef();
  const pageSize = 10;

  // 加载专辑数据
  const loadAlbums = useCallback(async (targetPage = 1, searchQuery = '') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/music/albums?page=${targetPage}&pageSize=${pageSize}&query=${searchQuery}`);
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

  // 搜索处理
  const handleSearch = useCallback((searchQuery) => {
    setSearch(searchQuery);
    setPage(1);
    setHasMore(true);
    loadAlbums(1, searchQuery);
  }, [loadAlbums]);

  // 滚动加载更多
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadAlbums(page + 1, search);
    }
  }, [loading, hasMore, page, search, loadAlbums]);

  // 设置滚动观察器
  const lastAlbumElementRef = useCallback(node => {
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
    loadAlbums(1, search);
  }, []);

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="albums-toolbar">
          <h2>💿 专辑 ({total})</h2>
          <div className="albums-actions">
            <input
              className="albums-search"
              placeholder="搜索专辑..."
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
        <AlbumsView
          albums={albums}
          onAlbumClick={onAlbumClick}
          loading={loading}
          hasMore={hasMore}
          lastAlbumElementRef={lastAlbumElementRef}
        />
      </div>
    </div>
  );
};

export default AlbumsPage;
