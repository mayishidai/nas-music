import React, { useState, useEffect, useCallback } from 'react';
import { MusicList } from '../../components';
import { useNavigate } from 'react-router-dom';
import './Favorites.css';

const FavoritesPage = ({ player }) => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [sortKey, setSortKey] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');

  // 加载收藏数据
  const loadFavorites = useCallback(async (targetPage = 1, searchKeyword = search) => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', String(pageSize));
      params.set('sort', sortKey);
      params.set('order', sortOrder);
      
      if (searchKeyword) {
        params.set('search', searchKeyword);
      }

      const response = await fetch(`/api/music/favorites?${params.toString()}`);
      const result = await response.json();

      if (response.ok) {
        const tracksData = result.data || [];
        const paginationData = result.pagination || { total: tracksData.length };

        // 处理数据映射
        const processedTracks = tracksData.map(t => ({
          id: t.id || t._id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          year: t.year,
          filename: t.filename,
          fileSize: t.size,
          bitrate: t.bitrate,
          sampleRate: t.sampleRate,
          coverImage: t.coverImage,
          favorite: t.favorite,
          playCount: t.playCount,
          lastPlayed: t.lastPlayed
        }));

        setFavorites(processedTracks);
        setTotal(paginationData.total);
        setPages(Math.ceil(paginationData.total / pageSize));
        setPage(targetPage);
      } else {
        setError(result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载收藏列表失败:', error);
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [pageSize, sortKey, sortOrder, search]);

  // 处理搜索变化
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    setFavorites([]);
    setTotal(0);
    setPages(0);
  };

  // 执行搜索
  const handleSearch = () => {
    setPage(1);
    loadFavorites(1, search);
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 处理页码变化
  const handlePageChange = (newPage) => {
    loadFavorites(newPage);
  };

  // 处理每页数量变化
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
    loadFavorites(1);
  };

  // 处理排序
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // 处理播放音乐
  const handlePlayMusic = (track) => {
    player.playMusic(track);
  };

  // 处理添加到播放列表
  const handleAddToPlaylist = (track) => {
    player.addToPlaylist(track);
  };

  // 处理打开详情
  const handleOpenDetail = (track) => {
    navigate(`/track/${track.id}`);
  };

  // 处理收藏
  const handleFavorite = async (track) => {
    try {
      const response = await fetch(`/api/music/tracks/${track.id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !track.favorite })
      });
      
      if (response.ok) {
        // 从收藏列表中移除
        setFavorites(prev => prev.filter(t => t.id !== track.id));
        setTotal(prev => prev - 1);
        setPages(Math.ceil((total - 1) / pageSize));
      } else {
        console.error('收藏操作失败');
      }
    } catch (error) {
      console.error('收藏操作出错:', error);
    }
  };

  // 处理艺术家点击
  const handleArtistClick = (artist) => {
    navigate(`/artist/${artist}`);
  };

  // 处理专辑点击
  const handleAlbumClick = (album) => {
    navigate(`/album/${album}`);
  };

  // 搜索变化时重新加载
  useEffect(() => {
    loadFavorites(1);
  }, [sortKey, sortOrder]);

  // 初始加载
  useEffect(() => {
    loadFavorites(1);
  }, []);

  return (
    <div className="page-container favorites-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => player.switchSidebar()}> ☰ </button>
          <h2>❤️ 我的收藏</h2>
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
          isLoading={loading}
          error={error}
          currentPage={page}
          pageSize={pageSize}
          total={total}
          pages={pages}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
          onPlayMusic={handlePlayMusic}
          onAddToPlaylist={handleAddToPlaylist}
          onOpenDetail={handleOpenDetail}
          onFavorite={handleFavorite}
          onArtistClick={handleArtistClick}
          onAlbumClick={handleAlbumClick}
        />
        
        {favorites.length === 0 && !loading && !error && (
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
