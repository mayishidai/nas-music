import React, { useState, useEffect, useCallback } from 'react';
import { MusicList } from '../../components';
import './Shuffle.css';

const ShufflePage = ({ router, player }) => {
  const [shuffleTracks, setShuffleTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [sortKey, setSortKey] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');

  // 加载随机播放数据
  const loadShuffleTracks = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', String(pageSize));
      params.set('sort', sortKey);
      params.set('order', sortOrder);

      const response = await fetch(`/api/music/random?${params.toString()}`);
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

        setShuffleTracks(processedTracks);
        setTotal(10);
        setPages(1);
        setPage(1);
      } else {
        setError(result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载随机播放列表失败:', error);
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [pageSize, sortKey, sortOrder]);

  // 处理刷新
  const handleRefresh = () => {
    setPage(1);
    loadShuffleTracks(1);
  };

  // 处理页码变化
  const handlePageChange = (newPage) => {
    loadShuffleTracks(newPage);
  };

  // 处理每页数量变化
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
    loadShuffleTracks(1);
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
    router.navigate('track-detail', { track });
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
        // 更新本地状态
        setShuffleTracks(prev => prev.map(t => 
          t.id === track.id ? { ...t, favorite: !t.favorite } : t
        ));
      } else {
        console.error('收藏操作失败');
      }
    } catch (error) {
      console.error('收藏操作出错:', error);
    }
  };

  // 搜索变化时重新加载
  useEffect(() => {
    loadShuffleTracks(1);
  }, [sortKey, sortOrder]);

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
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            title="刷新"
            disabled={loading}
          >
            🔄
          </button>
        </div>
      </div>
      <div className="shuffle-view">
        <MusicList 
          showPagination={false}
          tracks={shuffleTracks}
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
        />
        
        {shuffleTracks.length === 0 && !loading && !error && (
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


