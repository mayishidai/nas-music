import { useState, useEffect, useCallback } from 'react';
import { MusicList } from '../../components';
import { useNavigate } from 'react-router-dom';
import { useUrlState } from '../../hooks';
import './Music.css';

const MusicPage = ({ player }) => {
  const navigate = useNavigate();
  
  // 使用URL状态管理
  const { state, setPage, setPageSize, setSort, setSearch } = useUrlState({
    page: 1,
    pageSize: 10,
    sortKey: 'title',
    sortOrder: 'asc',
    search: ''
  });

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  // 加载音乐数据
  const loadTracks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
      params.set('sort', state.sortKey);
      params.set('order', state.sortOrder);
      
      if (state.search) {
        params.set('search', state.search);
      }

      const response = await fetch(`/api/music/tracks?${params.toString()}`);
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
          lastPlayed: t.lastPlayed,
          lyrics: t.lyrics
        }));
        setTracks(processedTracks);
        setTotal(paginationData.total);
        setPages(Math.ceil(paginationData.total / state.pageSize));
      } else {
        setError(result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载音乐列表失败:', error);
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [state.page, state.pageSize, state.sortKey, state.sortOrder, state.search]);

  // 处理搜索变化
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearch('');
  };

  // 执行搜索
  const handleSearch = () => {
    // 搜索状态已经通过setSearch更新，会自动触发loadTracks
  };

  // 处理回车键搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 处理页码变化
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  // 处理每页数量变化
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
  };

  // 处理排序
  const handleSort = (key) => {
    if (state.sortKey === key) {
      setSort(key, state.sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key, 'asc');
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
  const handleOpenDetail = (track) => navigate(`/track/${track.id}`);

  // 处理收藏
  const handleFavorite = async (track) => {
    try {
      const response = await fetch(`/api/music/tracks/${track.id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !track.favorite })
      });
      
      if (response.ok) {
        // 更新本地状态
        setTracks(prev => prev.map(t => 
          t.id === track.id ? { ...t, favorite: !t.favorite } : t
        ));
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

  // 当状态变化时重新加载数据
  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  return (
    <div className="page-container music-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => player.switchSidebar()}> ☰ </button>
          <h2>🎵 音乐库</h2>
        </div>
        <div className="fav-actions">
          <div className="search-container">
            <input
              className="fav-search"
              placeholder="搜索音乐..."
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
      <div className="music-view">
        <MusicList 
          tracks={tracks}
          showCover={true}
          isLoading={loading}
          error={error}
          currentPage={state.page}
          pageSize={state.pageSize}
          total={total}
          pages={pages}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          sortKey={state.sortKey}
          sortOrder={state.sortOrder}
          onSort={handleSort}
          onPlayMusic={handlePlayMusic}
          onAddToPlaylist={handleAddToPlaylist}
          onOpenDetail={handleOpenDetail}
          onFavorite={handleFavorite}
          onArtistClick={handleArtistClick}
          onAlbumClick={handleAlbumClick}
        />
        
        {tracks.length === 0 && !loading && !error && (
          <div className="empty-state">
            <h3>暂无音乐</h3>
            <p>音乐库中还没有音乐信息</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicPage;
