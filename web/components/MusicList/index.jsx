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
 * 格式化音乐品质信息
 * @param {Object} track - 音乐信息
 * @returns {string} 格式化后的品质信息
 */
function formatQuality(track) {
  const ext = (track?.filename?.split('.').pop() || '').toUpperCase();
  const kbps = track?.bitrate ? Math.round(track.bitrate / 1000) : null;
  const khz = track?.sampleRate ? Math.round(track.sampleRate / 1000) : null;
  const parts = [];
  if (ext) parts.push(ext);
  if (kbps) parts.push(`${kbps}kbps`);
  if (khz) parts.push(`${khz}kHz`);
  return parts.join(' ') || '—';
}

/**
 * 音乐列表组件
 * 提供音乐列表展示、分页、排序等功能
 */
const MusicList = ({
  pageSize = DEFAULT_PAGE_SIZE,
  showCover = true,
  searchKeyword,
  onAddToPlaylist,
  onFavorite,
  onDetails,
  onOnlineSearch,
  onPlay,
  filters = {},
  mode = 'tracks', // 'tracks' | 'recent' | 'random'
  onNavigateToAlbum,
  onNavigateToArtist,
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
  const [limit, setLimit] = useState(pageSize);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  
  // 更多操作菜单状态
  const [showMoreMenu, setShowMoreMenu] = useState(null);

  /**
   * 加载音乐列表
   */
  const loadTracks = async (targetPage = page) => {
    setIsLoading(true);
    setError('');
    try {
      let url = '/api/music/tracks';
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(limit),
        sort: sortKey,
        order: sortOrder,
        search: searchKeyword || ''
      });
      if (filters.genre) params.set('genre', filters.genre);
      if (filters.artist) params.set('artist', filters.artist);
      if (filters.album) params.set('album', filters.album);
      if (filters.yearFrom) params.set('yearFrom', String(filters.yearFrom));
      if (filters.yearTo) params.set('yearTo', String(filters.yearTo));
      if (filters.decade) params.set('decade', String(filters.decade));
      if (filters.minBitrate) params.set('minBitrate', String(filters.minBitrate));
      if (filters.maxBitrate) params.set('maxBitrate', String(filters.maxBitrate));
      if (typeof filters.favorite !== 'undefined') params.set('favorite', String(filters.favorite));

      if (mode === 'recent') {
        url = '/api/music/recently-played';
        // 最近播放不使用排序参数
        params.delete('sort');
        params.delete('order');
      }

      const res = await fetch(`${url}?${params.toString()}`);
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || '加载失败');

      const docs = Array.isArray(json.data) ? json.data : [];
      let mapped = docs.map((t) => ({
        id: t._id || t.id,
        _id: t._id || t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        year: t.year,
        genre: t.genre,
        bitrate: t.bitrate,
        sampleRate: t.sampleRate,
        filename: t.filename,
        coverImage: t.coverImage || null, // 新增封面图片字段
      }));

      // 随机模式：打乱顺序
      if (mode === 'random') {
        const arr = [...mapped];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        mapped = arr;
      }

      setTracks(mapped);
      const pgn = json.pagination || {};
      setTotal(pgn.total || mapped.length || 0);
      setPages(pgn.pages || Math.ceil((pgn.total || mapped.length || 0) / limit));
      setPage(pgn.page || targetPage);
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理排序
   */
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  /**
   * 生成页码数组
   */
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = 5;
    
    if (pages <= maxVisible) {
      for (let i = 1; i <= pages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(pages);
      } else if (page >= pages - 2) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = pages - 3; i <= pages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = page - 1; i <= page + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(pages);
      }
    }
    
    return pageNumbers;
  };

  // 计算分页状态
  const canPrev = page > 1;
  const canNext = pages > 0 && page < pages;

  /**
   * 跳转到指定页面
   */
  const jumpTo = (val) => {
    const n = Math.min(Math.max(1, Number(val) || 1), Math.max(1, pages || 1));
    loadTracks(n);
  };

  // 监听搜索词和排序变化
  useEffect(() => {
    loadTracks(1);
  }, [searchKeyword, sortKey, sortOrder, limit]);

  // 小屏下统一每页数量为5
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      if (mq.matches) {
        setLimit(5);
      } else {
        setLimit(pageSize);
      }
    };
    apply();
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', apply) : mq.removeListener(apply);
    };
  }, [pageSize]);

  return (
    <div className="music-list">
      {/* 音乐列表表格 */}
      <div className="ml-table">
        <div className="ml-thead">
          <div className="ml-th ml-col-title" onClick={() => handleSort('title')}>
            标题 {sortKey === 'title' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
          </div>
          <div className="ml-th ml-col-album" onClick={() => handleSort('album')}>
            专辑 {sortKey === 'album' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
          </div>
          <div className="ml-th ml-col-artist" onClick={() => handleSort('artist')}>
            歌手 {sortKey === 'artist' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
          </div>
          <div className="ml-th ml-col-duration">时长</div>
          <div className="ml-th ml-col-quality">品质</div>
          <div className="ml-th ml-col-actions">操作</div>
        </div>

        <div className="ml-tbody">
          {isLoading && (<div className="ml-row ml-loading">加载中...</div>)}
          {!isLoading && error && (<div className="ml-row ml-error">{error}</div>)}
          {!isLoading && !error && tracks.length === 0 && (<div className="ml-row ml-empty">暂无数据</div>)}

          {!isLoading && !error && tracks.map((t) => (
            <div key={t.id} className="ml-row" onDoubleClick={() => (onPlay ? onPlay(t) : null)}>
              <div className="ml-td ml-col-title">
                <div className="ml-title-wrap">
                  {showCover && (
                    <img
                      className="ml-cover"
                      src={t.coverImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0xNiA4TDIyIDE2TDE2IDI0TDEwIDE2TDE2IDhaIiBmaWxsPSIjY2NjIi8+Cjwvc3ZnPg=='}
                      alt="封面"
                    />
                  )}
                  <div className="ml-title-text">
                    <div className="ml-title" title={t.title}>{t.title}</div>
                    <div className="ml-sub">{t.artist}</div>
                  </div>
                </div>
              </div>
              <div className="ml-td ml-col-album" title={t.album}>
                {onNavigateToAlbum ? (
                  <button className="ml-link" onClick={(e) => { e.stopPropagation(); onNavigateToAlbum(t.album, t.artist); }}>
                    {t.album}
                  </button>
                ) : t.album}
              </div>
              <div className="ml-td ml-col-artist" title={t.artist}>
                {onNavigateToArtist ? (
                  <button className="ml-link" onClick={(e) => { e.stopPropagation(); onNavigateToArtist(t.artist); }}>
                    {t.artist}
                  </button>
                ) : t.artist}
              </div>
              <div className="ml-td ml-col-duration">{formatDuration(t.duration)}</div>
              <div className="ml-td ml-col-quality">{formatQuality(t)}</div>
              <div className="ml-td ml-col-actions">
                <button 
                  className="ml-btn play" 
                  title="播放" 
                  onClick={() => (onPlay ? onPlay(t) : null)}
                >
                  ▶️
                </button>
                {isFavoriteList ? (
                  <button
                    className="ml-btn"
                    title="删除收藏"
                    onClick={async () => {
                      try {
                        await fetch(`/api/music/tracks/${t._id || t.id}/favorite`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ favorite: false })
                        });
                        loadTracks(page);
                      } catch (e) {
                        alert('取消收藏失败');
                      }
                    }}
                  >
                    🗑️
                  </button>
                ) : (
                  <button 
                    className="ml-btn" 
                    title="添加到播放列表" 
                    onClick={() => (onAddToPlaylist ? onAddToPlaylist(t) : alert('已添加到播放列表：' + (t.title || '')))}
                  >
                    ➕
                  </button>
                )}
                <div className="ml-more-container">
                  <button 
                    className="ml-btn more" 
                    title="更多操作"
                    onClick={() => setShowMoreMenu(showMoreMenu === t.id ? null : t.id)}
                  >
                    ⋯
                  </button>
                  {showMoreMenu === t.id && (
                    <div className="ml-more-menu">
                      <button 
                        className="ml-more-item"
                        onClick={() => {
                          onFavorite ? onFavorite(t) : alert('已点击收藏：' + (t.title || ''));
                          setShowMoreMenu(null);
                        }}
                      >
                        ⭐ 收藏
                      </button>
                      <button 
                        className="ml-more-item"
                        onClick={() => {
                          if (onDetails) {
                            onDetails(t);
                          } else if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('openTrackDetail', { detail: { track: t } }));
                          }
                          setShowMoreMenu(null);
                        }}
                      >
                        ℹ️ 详情
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 分页控件 */}
      <div className="ml-pagination">
        <div className="ml-pg-info">
          共 {total} 条，第 {page} 页，共 {pages || 1} 页
        </div>
        
        <div className="ml-pg-ctrls">
          <button disabled={!canPrev} onClick={() => loadTracks(page - 1)} className="ml-pg-btn prev">
            ◀ 上一页
          </button>
          
          {getPageNumbers().map((pageNum, index) => (
            <button
              key={index}
              className={`ml-pg-btn ${pageNum === page ? 'active' : ''} ${pageNum === '...' ? 'ellipsis' : ''}`}
              onClick={() => {
                if (pageNum !== '...') {
                  loadTracks(pageNum);
                }
              }}
              disabled={pageNum === '...'}
            >
              {pageNum}
            </button>
          ))}
          
          <button disabled={!canNext} onClick={() => loadTracks(page + 1)} className="ml-pg-btn next">
            下一页 ▶
          </button>
        </div>
        
        <div className="ml-pg-settings">
          <select 
            value={limit} 
            onChange={(e) => { setLimit(Number(e.target.value)); }} 
            title="每页数量"
            className="ml-pg-select"
          >
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>{n}/页</option>
            ))}
          </select>
          
          <div className="ml-pg-jump">
            <span>跳转到：</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, pages || 1)}
              defaultValue={page}
              onKeyDown={(e) => { 
                if (e.key === 'Enter') {
                  jumpTo(e.currentTarget.value);
                  e.currentTarget.blur();
                }
              }}
              onBlur={(e) => { e.currentTarget.value = String(page); }}
              className="ml-pg-jump-input"
            />
            <span>页</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicList;


