import React, { useEffect, useMemo, useState } from 'react';
import './index.css';

const DEFAULT_PAGE_SIZE = 10;

/**
 * 格式化时长显示
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长
 */
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--:--';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 音乐列表组件
 * 提供音乐列表展示、分页、排序等功能
 */
const MusicList = ({
  default_pageSize = DEFAULT_PAGE_SIZE,
  showCover = true,
  searchKeyword,
  filters = {},
  mode = 'tracks', // 'tracks' | 'recent' | 'random'
  isFavoriteList = false
}) => {
  // 数据状态
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 排序状态
  const [sortKey, setSortKey] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(default_pageSize);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  
  // 更多操作菜单状态
  const [showMoreMenu, setShowMoreMenu] = useState(null);

  /**
   * 播放音乐
   */
  const handlePlay = (track) => {
    // 触发自定义事件，让主组件处理播放
    window.dispatchEvent(new CustomEvent('playMusic', { 
      detail: { track, playlistTracks: null } 
    }));
  };

  /**
   * 添加到播放列表
   */
  const handleAddToPlaylist = (track) => {
    // 触发自定义事件，让主组件处理添加到播放列表
    window.dispatchEvent(new CustomEvent('addToPlaylist', { 
      detail: { track } 
    }));
  };

  /**
   * 收藏/取消收藏
   */
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

  /**
   * 查看详情
   */
  const handleDetails = (track) => {
    // 触发自定义事件，让主组件处理详情页面
    window.dispatchEvent(new CustomEvent('openTrackDetail', { 
      detail: { track } 
    }));
  };

  /**
   * 记录播放
   */
  const handleRecordPlay = async (trackId) => {
    try {
      await fetch(`/api/music/recently-played/${trackId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('记录播放失败:', error);
    }
  };

  /**
   * 加载音乐数据
   */
  const loadTracks = async (targetPage = 1) => {
    setIsLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', String(pageSize));
      params.set('sort', sortKey);
      params.set('order', sortOrder);
      
      if (searchKeyword) {
        params.set('search', searchKeyword);
      }
      
      // 添加过滤器
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });

      let url;
      if (mode === 'recent') {
        // 最近播放模式
        params.delete('page');
        params.set('limit', String(pageSize));
        params.set('offset', String((targetPage - 1) * pageSize));
        url = `/api/music/recently-played?${params.toString()}`;
      } else if (isFavoriteList) {
        // 收藏列表模式
        url = `/api/music/favorites?${params.toString()}`;
      } else {
        // 普通音乐列表模式
        url = `/api/music/tracks?${params.toString()}`;
      }

      const response = await fetch(url);
      const json = await response.json();

      if (response.ok) {
        let tracksData, paginationData;
        
        if (mode === 'recent') {
          tracksData = json.data || json;
          paginationData = { total: json.total || tracksData.length };
        } else {
          tracksData = json.data || json;
          paginationData = json.pagination || { total: tracksData.length };
        }

        // 处理数据映射
        const processedTracks = tracksData.map(t => ({
          id: t.id || t._id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          year: t.year,
          filename: t.filename,
          fileSize: t.size, // 映射数据库中的size字段
          bitrate: t.bitrate,
          sampleRate: t.sampleRate,
          coverImage: t.coverImage,
          favorite: t.favorite,
          playCount: t.playCount,
          lastPlayed: t.lastPlayed
        }));

        setTracks(processedTracks);
        setTotal(paginationData.total);
        setPages(Math.ceil(paginationData.total / pageSize));
        setPage(targetPage);
      } else {
        setError(json.message || '加载失败');
      }
    } catch (error) {
      console.error('加载音乐列表失败:', error);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理排序
   */
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  /**
   * 处理分页
   */
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pages) {
      loadTracks(newPage);
    }
  };

  /**
   * 处理每页数量变化
   */
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
    loadTracks(1);
  };

  /**
   * 获取页码数组
   */
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(pages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pageNumbers.push(i);
    }
    
    return pageNumbers;
  };

  // 监听搜索关键词和过滤器变化
  useEffect(() => {
    loadTracks(1);
  }, [searchKeyword, sortKey, sortOrder, pageSize, ...Object.values(filters)]);

  // 处理双击播放
  const handleDoubleClick = (track) => {
    handlePlay(track);
    handleRecordPlay(track.id);
  };

  return (
    <div className="music-list-container">
      {/* 错误提示 */}
      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={() => loadTracks(1)}>重试</button>
        </div>
      )}

      {/* 音乐列表 */}
      <div className="music-list">
        <table className="music-table">
          <thead>
            <tr>
              <th className="col-cover" style={{ width: showCover ? '60px' : '0' }}>
                {showCover && '封面'}
              </th>
              <th 
                className="col-title sortable"
                onClick={() => handleSort('title')}
              >
                标题
                {sortKey === 'title' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-artist sortable"
                onClick={() => handleSort('artist')}
              >
                艺术家
                {sortKey === 'artist' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-album sortable"
                onClick={() => handleSort('album')}
              >
                专辑
                {sortKey === 'album' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-duration sortable"
                onClick={() => handleSort('duration')}
              >
                时长
                {sortKey === 'duration' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-filesize sortable"
                onClick={() => handleSort('size')}
              >
                文件大小
                {sortKey === 'size' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th className="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr 
                key={track.id} 
                className="music-row"
                onDoubleClick={() => handleDoubleClick(track)}
              >
                <td className="col-cover">
                  {showCover && (
                    <div className="cover-container">
                      <img src={track.coverImage || '/images/default_cover.png'} alt="封面" className="cover-image" />
                      <div className="cover-placeholder">
                        <span>🎵</span>
                      </div>
                    </div>
                  )}
                </td>
                <td className="col-title">
                  <div className="title-cell">
                    <span className="title-text">{track.title || '未知标题'}</span>
                  </div>
                </td>
                <td className="col-artist">
                  {track.artist || '未知艺术家'}
                </td>
                <td className="col-album">
                  {track.album || '未知专辑'}
                </td>
                <td className="col-duration">
                  {formatDuration(track.duration)}
                </td>
                <td className="col-filesize">
                  {formatFileSize(track.fileSize)}
                </td>
                <td className="col-actions">
                  <div className="action-buttons">
                    <button 
                      className="action-btn play-btn"
                      onClick={() => {
                        handlePlay(track);
                        handleRecordPlay(track.id);
                      }}
                      title="播放"
                    >
                      ▶️
                    </button>
                    <button 
                      className="action-btn add-btn"
                      onClick={() => handleAddToPlaylist(track)}
                      title="添加到播放列表"
                    >
                      ➕
                    </button>
                    <button 
                      className={`action-btn favorite-btn ${track.favorite ? 'favorited' : ''}`}
                      onClick={() => handleFavorite(track)}
                      title={track.favorite ? '取消收藏' : '收藏'}
                    >
                      {track.favorite ? '⭐' : '☆'}
                    </button>
                    <button 
                      className="action-btn details-btn"
                      onClick={() => handleDetails(track)}
                      title="详情"
                    >
                      ℹ️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* 加载状态 */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">🔄</div>
            <p>加载中...</p>
          </div>
        )}
        
        {/* 空状态 */}
        {!isLoading && tracks.length === 0 && (
          <div className="empty-state">
            <h3>暂无音乐</h3>
            <p>没有找到符合条件的音乐</p>
          </div>
        )}
      </div>

      {/* 分页控件 */}
      <div className="pagination">
        <div className="pagination-info">
          <span className="track-count">共 {total} 首</span>
          <span className="page-info">
            第 {page} 页，共 {pages} 页
          </span>
        </div>
        
        <div className="pagination-controls">
          <select 
            value={pageSize} 
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={10}>10 首/页</option>
            <option value={20}>20 首/页</option>
            <option value={50}>50 首/页</option>
            <option value={100}>100 首/页</option>
          </select>
          
          <div className="page-buttons">
            <button 
              className="page-btn"
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              上一页
            </button>
            
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                className={`page-btn ${pageNum === page ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}
            
            <button 
              className="page-btn"
              disabled={page === pages}
              onClick={() => handlePageChange(page + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicList;


