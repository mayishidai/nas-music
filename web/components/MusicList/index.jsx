import React, { useState } from 'react';
import './index.css';

/**
 * 检测是否为移动端
 */
function isMobile() {
  return window.innerWidth <= 900;
}

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
 * 纯展示组件，通过props接收数据
 */
const MusicList = ({
  tracks = [],
  showCover = true,
  isLoading = false,
  error = '',
  // 分页相关
  currentPage = 1,
  pageSize = 10,
  total = 0,
  pages = 0,
  onPageChange,
  onPageSizeChange,
  // 排序相关
  sortKey = 'title',
  sortOrder = 'asc',
  onSort,
  disableSort = false,
  // 操作回调
  onPlayMusic,
  onAddToPlaylist,
  onOpenDetail,
  onFavorite
}) => {
  // 更多操作菜单状态
  const [showMoreMenu, setShowMoreMenu] = useState(null);

  /**
   * 处理排序
   */
  const handleSort = (key) => {
    if (onSort) {
      onSort(key);
    }
  };

  /**
   * 处理页码变化
   */
  const handlePageChange = (newPage) => {
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  /**
   * 处理每页数量变化
   */
  const handlePageSizeChange = (newPageSize) => {
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    }
  };

  /**
   * 获取页码数组
   */
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return pageNumbers;
  };

  /**
   * 处理播放音乐
   */
  const handlePlay = (track) => {
    if (onPlayMusic) {
      onPlayMusic(track);
    }
  };

  /**
   * 处理添加到播放列表
   */
  const handleAddToPlaylist = (track) => {
    if (onAddToPlaylist) {
      onAddToPlaylist(track);
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = (track) => {
    if (onOpenDetail) {
      onOpenDetail(track);
    }
  };

  /**
   * 处理收藏
   */
  const handleFavorite = (track) => {
    if (onFavorite) {
      onFavorite(track);
    }
  };

  /**
   * 处理双击播放
   */
  const handleDoubleClick = (track) => {
    handlePlay(track);
  };

  return (
    <div className="music-list-container">
      {/* 错误提示 */}
      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={() => onPageChange(1)}>重试</button>
        </div>
      )}

      {/* 音乐列表 */}
      <div className="music-list">
        <table className={`music-table ${showCover ? 'show-cover' : ''}`}>
          <thead>
            <tr>
              <th className="col-cover">
                {showCover && '封面'}
              </th>
              <th 
                className={`col-title ${!disableSort ? 'sortable' : ''}`}
                onClick={() => !disableSort && handleSort('title')}
              >
                标题
                {!disableSort && sortKey === 'title' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className={`col-artist ${!disableSort ? 'sortable' : ''}`}
                onClick={() => !disableSort && handleSort('artist')}
              >
                艺术家
                {!disableSort && sortKey === 'artist' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className={`col-album ${!disableSort ? 'sortable' : ''}`}
                onClick={() => !disableSort && handleSort('album')}
              >
                专辑
                {!disableSort && sortKey === 'album' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className={`col-duration ${!disableSort ? 'sortable' : ''}`}
                onClick={() => !disableSort && handleSort('duration')}
              >
                时长
                {!disableSort && sortKey === 'duration' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className={`col-filesize ${!disableSort ? 'sortable' : ''}`}
                onClick={() => !disableSort && handleSort('filesize')}
              >
                文件大小
                {!disableSort && sortKey === 'filesize' && (
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
                onClick={() => {
                  // 在移动端，点击行直接播放
                  if (isMobile()) {
                    handlePlay(track);
                  }
                }}
                style={{ cursor: isMobile() ? 'pointer' : 'default' }}
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
                  {formatFileSize(track.size || track.fileSize)}
                </td>
                <td className="col-actions">
                  <div className="action-buttons">
                    <button 
                      className="action-btn play-btn"
                      onClick={() => {
                        handlePlay(track);
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
                      onClick={() => handleOpenDetail(track)}
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
            第 {currentPage} 页，共 {pages} 页
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
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              上一页
            </button>
            
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                className={`page-btn ${pageNum === currentPage ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}
            
            <button 
              className="page-btn"
              disabled={currentPage === pages}
              onClick={() => handlePageChange(currentPage + 1)}
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


