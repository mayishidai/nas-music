import React, { useEffect, useMemo, useRef, useState } from 'react';
import './TrackDetail.css';

const TrackDetailPage = ({ router, player }) => {
  const [track, setTrack] = useState(null);
  const [form, setForm] = useState({ 
    title: '', 
    artist: '', 
    album: '', 
    year: '', 
    lyrics: ''
  });
  const [coverPreview, setCoverPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [favorite, setFavorite] = useState(false);

  // 从路由数据获取track信息
  const trackData = router.getCurrentData().track;
  console.log(trackData);
  const trackId = trackData?.id || trackData?._id;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/music/tracks/${trackId}`);
        const json = await res.json();
        if (json?.success) {
          setTrack(json.data);
          setFavorite(json.data.favorite);
        }
      } catch (error) {
        console.error('加载音乐详情失败:', error);
      } finally {
        setLoading(false);
      }
    };
    if (trackId) load();
  }, [trackId]);

  useEffect(() => {
    if (track) {
      setForm({
        title: track.title || '',
        artist: track.artist || '',
        album: track.album || '',
        year: track.year || '',
        lyrics: track.lyrics || ''
      });
      setCoverPreview(track.coverImage || '');
    }
  }, [track]);

  // 解析文件路径与文件名
  const { fileName, folderPath } = useMemo(() => {
    const raw = track?.path || track?.filepath || track?.filename || '';
    const normalized = String(raw || '').replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const name = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
    const folder = lastSlash >= 0 ? normalized.slice(0, lastSlash) : '';
    return { fileName: name, folderPath: folder };
  }, [track]);

  const handleChooseCover = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSaveTags = async () => {
    if (!track) return;
    setLoading(true);
    try {
      // 使用music.js API的PUT /tracks/:id接口
      const response = await fetch(`/api/music/tracks/${trackId}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          title: form.title, 
          artist: form.artist, 
          album: form.album, 
          year: form.year, 
          lyrics: form.lyrics
        })
      });
      
      const result = await response.json();
      if (result.success) {
        // 更新本地track数据
        setTrack(prev => ({ ...prev, ...form }));
        alert('保存成功');
      } else {
        alert('保存失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOnlineSearch = async () => {
    if (!form.title.trim() && !form.artist.trim()) {
      alert('请输入歌曲名称或艺术家名称');
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (form.title.trim()) params.append('title', form.title.trim());
      if (form.artist.trim()) params.append('artist', form.artist.trim());
      
      const res = await fetch(`/api/online/search/music?${params.toString()}`);
      const json = await res.json();
      
      if (json?.success) {
        setSearchResults(json.data);
        setShowSearchPanel(true);
      } else {
        alert('搜索失败: ' + (json.error || '未知错误'));
      }
    } catch (error) {
      console.error('在线搜索失败:', error);
      alert('搜索失败，请检查网络连接');
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePlayMusic = () => {
    if (track) {
      player.playMusic(track);
    }
  };

  const handleAddToPlaylist = () => {
    if (track) {
      player.addToPlaylist(track);
    }
  };

  const handleFavorite = async () => {
    if (!track) return;
    try {
      await fetch(`/api/music/tracks/${trackId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !favorite })
      });
      setFavorite(!favorite);
    } catch (error) {
      console.error('收藏操作失败:', error);
    }
  };

  if (!trackData) {
    return <div className="page-container">音乐不存在</div>;
  }

  if (loading) {
    return <div className="page-container">加载中...</div>;
  }

  const onOnlineDataReplace = async (data) => {
    setForm(prev => ({
      ...prev,
      title: data.title || prev.title,
      artist: data.artist || prev.artist,
      album: data.album || prev.album,
      year: data.date || prev.year,
      coverImage: data.cover || prev.coverImage,
    }));
    setCoverPreview(data.cover || '/images/default_cover.png');
    setShowSearchPanel(false);
  };

  return (
    <div className="track-detail">
      <div className="td-header">
        <button className="td-back" onClick={router.goBack}>← 返回</button>
        <h2 className="td-title">音乐详情</h2>
        <div className="td-title-actions">
          <button className="td-btn" onClick={handlePlayMusic} title="播放">
            ▶️
          </button>
          <button className="td-btn" onClick={handleAddToPlaylist} title="添加到播放列表">
            📋
          </button>
          <button 
            className={`td-btn ${favorite ? 'active' : ''}`} 
            onClick={handleFavorite} 
            title={favorite ? '取消收藏' : '收藏'}
          >
            {favorite ? '❤️' : '🤍'}
          </button>
          <button className="td-btn" disabled={searchLoading} onClick={handleOnlineSearch}>
            {searchLoading ? '搜索中…' : '在线搜索'}
          </button>
        </div>
      </div>

      <div className="td-content">
        <div className="td-main">
          <div className="td-cover-section">
            <div className="td-cover-wrap">
              <img 
                className="td-cover" 
                src={coverPreview || track?.coverImage || '/images/default_cover.png'} 
                alt="封面" 
              />
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleChooseCover} 
                className="td-cover-input" 
                id="cover-input"
              />
              <label htmlFor="cover-input" className="td-cover-label">选择封面</label>
            </div>
            
            {/* 文件信息移动到封面区域 */}
            <div className="td-file-info">
              <div className="td-file-info-header">
                <h4>📁 文件信息</h4>
              </div>
              <div className="td-file-info-content">
                <div className="td-file-info-item">
                  <span className="td-file-info-label">📄 文件名</span>
                  <span className="td-file-info-value">{fileName}</span>
                </div>
                <div className="td-file-info-item">
                  <span className="td-file-info-label">📂 文件路径</span>
                  <span className="td-file-info-value">{folderPath}</span>
                </div>
                {track && (
                  <>
                    <div className="td-file-info-item">
                      <span className="td-file-info-label">💾 文件大小</span>
                      <span className="td-file-info-value">
                        {track.size ? `${(track.size / 1024 / 1024).toFixed(2)} MB` : '未知'}
                      </span>
                    </div>
                    <div className="td-file-info-item">
                      <span className="td-file-info-label">⏱️ 时长</span>
                      <span className="td-file-info-value">
                        {track.duration ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : '未知'}
                      </span>
                    </div>
                    <div className="td-file-info-item">
                      <span className="td-file-info-label">🎵 比特率</span>
                      <span className="td-file-info-value">
                        {track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '未知'}
                      </span>
                    </div>
                    <div className="td-file-info-item">
                      <span className="td-file-info-label">▶️ 播放次数</span>
                      <span className="td-file-info-value">
                        {track.playCount || 0}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="td-form">
            <div className="td-form-row">
              <label>歌曲名</label>
              <input 
                type="text" 
                value={form.title} 
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="歌曲名称"
              />
            </div>
            <div className="td-form-row">
              <label>艺术家</label>
              <input 
                type="text" 
                value={form.artist} 
                onChange={(e) => setForm(prev => ({ ...prev, artist: e.target.value }))}
                placeholder="艺术家名称"
              />
            </div>
            <div className="td-form-row">
              <label>专辑</label>
              <input 
                type="text" 
                value={form.album} 
                onChange={(e) => setForm(prev => ({ ...prev, album: e.target.value }))}
                placeholder="专辑名称"
              />
            </div>
            <div className="td-form-row">
              <label>年份</label>
              <input 
                type="text" 
                value={form.year} 
                onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))}
                placeholder="发行年份"
              />
            </div>
          </div>

          <div className="td-lyrics-wrap">
            <div className="td-form-row">
              <label>歌词</label>
              <textarea 
                className="td-lyrics" 
                value={form.lyrics} 
                onChange={(e) => setForm(prev => ({ ...prev, lyrics: e.target.value }))}
                placeholder="歌词内容" 
              />
            </div>
          </div>

          <div className="td-actions">
            <button 
              className="td-save-btn" 
              onClick={handleSaveTags}
              disabled={loading}
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* 在线搜索结果面板 */}
        {showSearchPanel && (
          <div className="td-drawer">
            <div className="td-drawer-mask" onClick={() => setShowSearchPanel(false)} />
            <div className="td-drawer-content">
              <div className="td-drawer-header">
                <h3>🔍 在线搜索结果</h3>
                <button className="td-drawer-close" onClick={() => setShowSearchPanel(false)}>✕</button>
              </div>
              <div className="td-drawer-body">
                {searchLoading ? (
                  <div className="search-loading">
                    <div className="loading-spinner"></div>
                    <p>搜索中...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="no-results">
                    <div className="no-results-icon">🔍</div>
                    <p>未找到相关结果</p>
                    <p className="no-results-tip">请尝试其他关键词或检查网络连接</p>
                  </div>
                ) : (
                  <div className="search-results-list">
                    {searchResults.map((result, idx) => (
                      <div key={idx} className="search-result-item" onClick={() => { onOnlineDataReplace(result); }}>
                        <div className="result-cover">
                          <img src={result.cover} alt={result.title} onError={e => { e.target.src = '/images/default_cover.png' }}/>
                        </div>
                        <div className="result-info">
                          <div className="result-title">{result.title}</div>
                          <div className="result-artist">{result.artist}</div>
                          {result.album && <div className="result-album">{result.album}</div>}
                          <div className="result-source">来源: {result.source}</div>
                        </div>
                        <div className="result-score">
                          匹配度: {Math.round((result.score || 0))}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackDetailPage;


