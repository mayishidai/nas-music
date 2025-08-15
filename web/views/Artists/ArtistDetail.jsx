import React, { useState, useEffect } from 'react';
import { MusicList } from '../../components';
import './ArtistDetail.css';

const ArtistDetailView = ({ router, player }) => {
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  // 从路由数据获取artist信息
  const artistData = router.getCurrentData().artist;
  const artistId = artistData?.id || artistData?._id;

  // 加载艺术家详情
  useEffect(() => {
    const loadArtistDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 检查是否已经有完整的artist数据
        if (artistData && artistData.tracks) {
          setArtist(artistData);
          return;
        }
        
        // 否则通过API获取数据
        const res = await fetch(`/api/music/artists/${artistId}`);
        const json = await res.json();
        
        if (json?.success) {
          setArtist(json.data);
        } else {
          setError(json?.error || '获取艺术家信息失败');
        }
      } catch (error) {
        console.error('加载艺术家详情失败:', error);
        setError('加载艺术家详情失败');
      } finally {
        setLoading(false);
      }
    };

    if (artistId) {
      loadArtistDetail();
    }
  }, [artistId, artistData]);

  // 加载艺术家的音乐列表
  const loadTracks = async (page = 1, size = pageSize, searchKeyword = search) => {
    if (!artist?.name) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: size.toString(),
        filter: JSON.stringify({
          artist: artist.name
        })
      });
      
      // 添加搜索关键词
      if (searchKeyword) {
        params.set('search', searchKeyword);
      }
      
      const res = await fetch(`/api/music/tracks?${params}`).then(res => res.json()); 
      const data = res.data || []; 
      const pagination = res.pagination || {};
      console.log(data);
      if (res?.success) {
        setTracks(data);
        setTotal(pagination.total || 0);
        setPages(pagination.pages || 0);
        setCurrentPage(page);
      } else {
        setError(res?.error || '获取音乐列表失败');
      }
    } catch (error) {
      console.error('加载音乐列表失败:', error);
      setError('加载音乐列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 当艺术家信息加载完成后，加载音乐列表
  useEffect(() => {
    if (artist?.name) {
      loadTracks(1, pageSize, search);
    }
  }, [artist?.name, pageSize, search]);

  // 处理页码变化
  const handlePageChange = (newPage) => {
    loadTracks(newPage, pageSize, search);
  };

  // 处理每页数量变化
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    loadTracks(1, newPageSize, search);
  };

  // 处理搜索变化
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理搜索清除
  const handleClearSearch = () => {
    setSearch('');
    setCurrentPage(1);
  };

  // 处理播放音乐
  const handlePlayMusic = (track) => {
    player.playMusic(track, tracks);
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
      const res = await fetch(`/api/music/tracks/${track.id || track._id}/favorite`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ favorite: !track.favorite }),
      });
      
      if (res.ok) {
        // 更新本地状态
        setTracks(prevTracks => 
          prevTracks.map(t => 
            (t.id === track.id || t._id === track._id)
              ? { ...t, favorite: !t.favorite }
              : t
          )
        );
      }
    } catch (error) {
      console.error('更新收藏状态失败:', error);
    }
  };

  if (loading && !artist) {
    return (
      <div className="artist-detail">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h3>加载中...</h3>
          <p>正在获取艺术家信息</p>
        </div>
      </div>
    );
  }

  if (error && !artist) {
    return (
      <div className="artist-detail">
        <div className="error-container">
          <h3>加载失败</h3>
          <p>{error}</p>
          <button className="ad-btn" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="artist-detail">
        <div className="error-container">
          <h3>艺术家不存在</h3>
          <p>无法找到指定的艺术家信息</p>
        </div>
      </div>
    );
  }

  const name = artist?.name || '未知艺术家';
  const cover = artist?.photo || artist?.coverImage || '/images/default_artists.png';
  const stats = {
    albums: artist?.albumCount || (artist?.albums?.length || 0),
    tracks: total || artist?.trackCount || (artist?.tracks?.length || 0)
  };

  return (
    <div className="artist-detail">
      {/* 背景图片区域 */}
      <div className="ad-background-section">
        <div 
          className="ad-background-image" 
          style={{ backgroundImage: `url(${cover})` }}
        />
        <div className="ad-background-overlay" />
        
        {/* 返回按钮 */}
        <button className="ad-back" onClick={router.goBack}>← 返回</button>
        
        {/* 艺术家信息 */}
        <div className="ad-artist-info">
          <div className="ad-artist-photo">
            <img src={cover} alt={name} className="ad-photo-image" />
          </div>
          <div className="ad-artist-details">
            <h1 className="ad-name">{name}</h1>
            <div className="ad-stats">
              <span>{stats.albums} 张专辑</span>
              <span className="dot">•</span>
              <span>{stats.tracks} 首歌曲</span>
            </div>
            <div className="ad-desc">暂无简介</div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="ad-content">
        <div className="ad-tracks">
          <div className="ad-tracks-header">
            <h3 className="ad-tracks-title">歌曲列表</h3>
            <div className="ad-search-container">
              <input 
                className="ad-search-input" 
                placeholder="搜索歌曲..." 
                value={search} 
                onChange={handleSearchChange}
              />
              {search && (
                <button 
                  className="ad-search-clear"
                  onClick={handleClearSearch}
                  title="清除搜索"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <MusicList
            tracks={tracks}
            isLoading={loading}
            error={error}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            pages={pages}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onPlayMusic={handlePlayMusic}
            onAddToPlaylist={handleAddToPlaylist}
            onOpenDetail={handleOpenDetail}
            onFavorite={handleFavorite}
          />
        </div>
      </div>
    </div>
  );
};

export default ArtistDetailView;


