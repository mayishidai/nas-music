import React, { useState, useEffect, useCallback } from 'react';
import { MusicList } from '../../components/index';
import '../Pages.css';
import './Favorites.css';

/**
 * 收藏页面组件
 */
const FavoritesPage = ({ router, player }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const pageSize = 10;

  // 加载收藏数据
  const loadFavorites = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/music/favorites?page=${targetPage}&pageSize=${pageSize}&search=${search}`);
      const result = await response.json();
      
      if (result.success) {
        const newFavorites = result.data || [];
        const pagination = result.pagination || {};
        
        if (targetPage === 1) {
          setFavorites(newFavorites);
        } else {
          setFavorites(prev => [...prev, ...newFavorites]);
        }
        
        setTotal(pagination.total || 0);
        setHasMore(pagination.page < pagination.pages);
        setPage(targetPage);
      }
    } catch (error) {
      console.error('加载收藏列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // 加载下一页
  const loadNext = useCallback(() => {
    if (!loading && hasMore) {
      loadFavorites(page + 1);
    }
  }, [loading, hasMore, page, loadFavorites]);

  // 处理搜索变化
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
    setFavorites([]);
    setHasMore(true);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    setFavorites([]);
    setHasMore(true);
  };

  // 执行搜索
  const handleSearch = () => {
    setPage(1);
    setFavorites([]);
    setHasMore(true);
    loadFavorites(1);
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 搜索变化时重新加载
  useEffect(() => {
    loadFavorites(1);
  }, [search]);

  // 初始加载
  useEffect(() => {
    loadFavorites(1);
  }, []);

  return (
    <div className="page-container favorites-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => router.switchSidebar()}> ☰ </button>
          <h2>⭐ 收藏</h2>
        </div>
        <div className="fav-actions">
          <div className="search-container">
            <input
              className="fav-search"
              placeholder="搜索收藏..."
              value={search}
              onChange={handleSearchChange}
              onKeyPress={handleSearchKeyPress}
            />
            {search && (
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
      <div className="favorites-view">
        <MusicList 
          tracks={favorites}
          showCover={true}
          onPlayMusic={(track) => player.playMusic(track)}
          onAddToPlaylist={(track) => player.addToPlaylist(track)}
          onOpenDetail={(track) => router.navigate('track-detail', { track })}
        />
        
        {favorites.length === 0 && !loading && (
          <div className="empty-state">
            <h3>暂无收藏</h3>
            <p>您还没有收藏任何音乐</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;
