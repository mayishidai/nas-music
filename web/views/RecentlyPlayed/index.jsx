import React, { useState, useEffect, useCallback } from 'react';
import { MusicList } from '../../components/index';
import '../Pages.css';
import './RecentlyPlayed.css';

/**
 * 最近播放页面组件
 */
const RecentlyPlayedPage = ({ router, player }) => {
  const [recentTracks, setRecentTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const pageSize = 10;

  // 加载最近播放数据
  const loadRecentTracks = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/music/recently-played?page=${targetPage}&pageSize=${pageSize}&search=${search}`);
      const result = await response.json();
      
      if (result.success) {
        const newTracks = result.data || [];
        const pagination = result.pagination || {};
        
        if (targetPage === 1) {
          setRecentTracks(newTracks);
        } else {
          setRecentTracks(prev => [...prev, ...newTracks]);
        }
        
        setTotal(pagination.total || 0);
        setHasMore(pagination.page < pagination.pages);
        setPage(targetPage);
      }
    } catch (error) {
      console.error('加载最近播放列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // 加载下一页
  const loadNext = useCallback(() => {
    if (!loading && hasMore) {
      loadRecentTracks(page + 1);
    }
  }, [loading, hasMore, page, loadRecentTracks]);

  // 处理搜索变化
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
    setRecentTracks([]);
    setHasMore(true);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    setRecentTracks([]);
    setHasMore(true);
  };

  // 执行搜索
  const handleSearch = () => {
    setPage(1);
    setRecentTracks([]);
    setHasMore(true);
    loadRecentTracks(1);
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 搜索变化时重新加载
  useEffect(() => {
    loadRecentTracks(1);
  }, [search]);

  // 初始加载
  useEffect(() => {
    loadRecentTracks(1);
  }, []);

  return (
    <div className="page-container recently-played-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => router.switchSidebar()}> ☰ </button>
          <h2>🕒 最近播放</h2>
        </div>
        <div className="fav-actions">
          <div className="search-container">
            <input
              className="fav-search"
              placeholder="搜索最近播放..."
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
      <div className="recently-played-view">
        <MusicList 
          tracks={recentTracks}
          showCover={true}
          onPlayMusic={(track) => player.playMusic(track)}
          onAddToPlaylist={(track) => player.addToPlaylist(track)}
          onOpenDetail={(track) => router.navigate('track-detail', { track })}
        />
        {recentTracks.length === 0 && !loading && (
          <div className="empty-state">
            <h3>暂无播放记录</h3>
            <p>您还没有播放过任何音乐</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentlyPlayedPage;
