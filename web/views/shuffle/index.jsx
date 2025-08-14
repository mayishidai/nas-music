import React, { useState, useEffect, useCallback } from 'react';
import { MusicList } from '../../components/index';
import '../Pages.css';
import './Shuffle.css';

/**
 * 随机播放页面组件
 */
const ShufflePage = ({ router, player }) => {
  const [shuffleTracks, setShuffleTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const pageSize = 10;

  // 加载随机播放数据
  const loadShuffleTracks = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/music/tracks?page=${targetPage}&pageSize=${pageSize}&search=${search}&shuffle=true`);
      const result = await response.json();
      
      if (result.success) {
        const newTracks = result.data || [];
        const pagination = result.pagination || {};
        
        if (targetPage === 1) {
          setShuffleTracks(newTracks);
        } else {
          setShuffleTracks(prev => [...prev, ...newTracks]);
        }
        
        setTotal(pagination.total || 0);
        setHasMore(pagination.page < pagination.pages);
        setPage(targetPage);
      }
    } catch (error) {
      console.error('加载随机播放列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // 加载下一页
  const loadNext = useCallback(() => {
    if (!loading && hasMore) {
      loadShuffleTracks(page + 1);
    }
  }, [loading, hasMore, page, loadShuffleTracks]);

  // 处理搜索变化
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
    setShuffleTracks([]);
    setHasMore(true);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    setShuffleTracks([]);
    setHasMore(true);
  };

  // 执行搜索
  const handleSearch = () => {
    setPage(1);
    setShuffleTracks([]);
    setHasMore(true);
    loadShuffleTracks(1);
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 搜索变化时重新加载
  useEffect(() => {
    loadShuffleTracks(1);
  }, [search]);

  // 初始加载
  useEffect(() => {
    loadShuffleTracks(1);
  }, []);

  return (
    <div className="page-container shuffle-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => router.switchSidebar()}> ☰ </button>
          <h2>🔀 随机播放</h2>
        </div>
        <div className="fav-actions">
          <div className="search-container">
            <input
              className="fav-search"
              placeholder="搜索随机播放..."
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
      <div className="shuffle-view">
        <MusicList 
          tracks={shuffleTracks}
          showCover={true}
          onPlayMusic={(track) => player.playMusic(track)}
          onAddToPlaylist={(track) => player.addToPlaylist(track)}
          onOpenDetail={(track) => router.navigate('track-detail', { track })}
        />
        
        {shuffleTracks.length === 0 && !loading && (
          <div className="empty-state">
            <h3>暂无音乐</h3>
            <p>音乐库中还没有音乐信息</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShufflePage;


