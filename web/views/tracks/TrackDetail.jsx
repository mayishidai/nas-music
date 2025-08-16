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
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' | 'error'

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

  // 将图片URL转换为base64格式
  const convertImageUrlToBase64 = async (imageUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // 处理跨域问题
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置最大尺寸为500x500
        const maxSize = 500;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 转换为base64，使用0.8的质量
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      };
      
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      img.src = imageUrl;
    });
  };

  const handleChooseCover = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    
    // 检查文件大小 (限制为5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('图片文件大小不能超过5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      // 压缩图片并转换为base64
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置最大尺寸为500x500
        const maxSize = 500;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 转换为base64，使用0.8的质量
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setCoverPreview(base64);
      };
      img.src = reader.result;
    }; 
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
          lyrics: form.lyrics,
          coverImage: coverPreview
        })
      });
      
      const result = await response.json();
      if (result.success) {
        // 更新本地track数据
        setTrack(prev => ({ ...prev, ...form, coverImage: coverPreview }));
        showToastMessage('保存成功！', 'success');
      } else {
        showToastMessage('保存失败: ' + (result.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('保存失败:', error);
      showToastMessage('保存失败，请检查网络连接', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOnlineSearch = async () => {
    if (!form.title.trim() && !form.artist.trim()) {
      showToastMessage('请输入歌曲名称或艺术家名称', 'error');
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
        showToastMessage('搜索失败: ' + (json.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('在线搜索失败:', error);
      showToastMessage('搜索失败，请检查网络连接', 'error');
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

  const onOnlineDataReplace = async (data) => {
    setLoading(true);
    setForm(prev => ({
      ...prev,
      title: data.title || prev.title,
      artist: data.artist || prev.artist,
      album: data.album || prev.album,
      year: data.date || prev.year,
      coverImage: data.cover || prev.coverImage,
    }));
    
    // 处理封面图片，如果是URL则转换为base64
    if (data.cover && data.cover.startsWith('http')) {
      try {
        const base64Image = await convertImageUrlToBase64(data.cover);
        setCoverPreview(base64Image);
        setForm(prev => ({
          ...prev,
          coverImage: base64Image,
        }));
      } catch (error) {
        console.error('转换封面图片失败:', error);
        setCoverPreview(data.cover || '/images/default_cover.png');
      }
    } else {
      setCoverPreview(data.cover || '/images/default_cover.png');
    }
    
    // 自动搜索并设置歌词
    try {
      const params = new URLSearchParams();
      params.append('title', data.title.trim());
      params.append('artist', data.artist.trim());
      const res = await fetch(`/api/online/lyrics?${params.toString()}`);
      const json = await res.json();
      if (json?.success) {
        setForm(prev => ({
          ...prev,
          lyrics: json.data.lyrics || prev.lyrics,
        }));
        console.log(`已自动设置歌词，来源: ${json.data.source}，匹配度: ${Math.round((json.data.score || 0) * 100)}%`);
      }
    } catch (error) {
      console.error('自动搜索歌词失败:', error);
    }
    setLoading(false);
    setShowSearchPanel(false);
  };

  // 显示Toast消息的函数
  const showToastMessage = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // 1.7秒后开始关闭动画，2秒后完全隐藏
    setTimeout(() => {
      const toastElement = document.querySelector('.toast');
      if (toastElement) {
        toastElement.classList.add('hiding');
      }
    }, 1700);
    
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  return (
    <div className="track-detail">
      {/* 浮动Loading遮罩层 */}
      {loading && (
        <div className="floating-loading-overlay">
          <div className="floating-loading-content">
            <div className="floating-loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      )}
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
          <button 
            className={`td-btn ${searchLoading ? 'loading' : ''}`} 
            disabled={searchLoading} 
            onClick={handleOnlineSearch}
          >
            {searchLoading ? (
              <>
                <div className="btn-loading-spinner"></div>
                <span>搜索中…</span>
              </>
            ) : (
              '在线搜索'
            )}
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
                disabled={loading}
              />
              <label 
                htmlFor="cover-input" 
                className={`td-cover-label ${loading ? 'disabled' : ''}`}
              >
                选择封面
              </label>
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
                disabled={loading}
              />
            </div>
            <div className="td-form-row">
              <label>艺术家</label>
              <input 
                type="text" 
                value={form.artist} 
                onChange={(e) => setForm(prev => ({ ...prev, artist: e.target.value }))}
                placeholder="艺术家名称"
                disabled={loading}
              />
            </div>
            <div className="td-form-row">
              <label>专辑</label>
              <input 
                type="text" 
                value={form.album} 
                onChange={(e) => setForm(prev => ({ ...prev, album: e.target.value }))}
                placeholder="专辑名称"
                disabled={loading}
              />
            </div>
            <div className="td-form-row">
              <label>年份</label>
              <input 
                type="text" 
                value={form.year} 
                onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))}
                placeholder="发行年份"
                disabled={loading}
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
                disabled={loading}
              />
            </div>
          </div>

          <div className="td-actions">
            <button 
              className={`td-save-btn ${loading ? 'loading' : ''}`}
              onClick={handleSaveTags}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="save-loading-spinner"></div>
                  <span>保存中...</span>
                </>
              ) : (
                '保存'
              )}
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
                          匹配度: {Math.round(result.score || 0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast弹窗 */}
        {showToast && (
          <div className={`toast ${toastType}`}>
            <div className="toast-content">
              <div className="toast-icon">
                {toastType === 'success' ? '✅' : '❌'}
              </div>
              <div className="toast-message">{toastMessage}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackDetailPage;


