import React, { useEffect, useMemo, useRef, useState } from 'react';
import './TrackDetail.css';

const TrackDetailPage = ({ router, player }) => {
  const [track, setTrack] = useState(null);
  const [form, setForm] = useState({ title: '', artist: '', album: '', albumArtist: '', year: '', genre: '', track: '' });
  const [coverPreview, setCoverPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  // 从路由数据获取track信息
  const trackData = router.getCurrentData().track;
  const trackId = trackData?.id || trackData?._id;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/music/tracks/${trackId}`);
        const json = await res.json();
        if (json?.success) setTrack(json.data);
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
        albumArtist: track.albumArtist || '',
        year: track.year || '',
        genre: track.genre || '',
        track: track.track || ''
      });
      setCoverPreview(track.coverImage || '');
      setLyrics(track.lyrics || '');
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
      await fetch(`/api/music/tracks/${track._id || track.id}/tags`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          title: form.title, artist: form.artist, album: form.album, albumArtist: form.albumArtist, year: form.year, genre: form.genre, track: form.track
        })
      });
      if (coverPreview && coverPreview !== track.coverImage) {
        await fetch(`/api/music/tracks/${track._id || track.id}/cover`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coverImage: coverPreview })
        });
      }
      alert('保存成功');
    } catch (e) {
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOnlineSearch = async () => {
    if (!track && !form.title && !form.artist) return;
    try {
      setSearchLoading(true);
      setSearchResults([]);
      setShowSearchPanel(true);
      const params = new URLSearchParams();
      const q = `${form.title || track?.title || ''} ${form.artist || track?.artist || ''}`.trim();
      if (q) params.set('query', q);
      if (form.title || track?.title) params.set('title', form.title || track?.title || '');
      if (form.artist || track?.artist) params.set('artist', form.artist || track?.artist || '');
      if (form.album || track?.album) params.set('album', form.album || track?.album || '');
      if (fileName) params.set('filename', fileName);
      if (trackId) params.set('trackId', trackId);
      const res = await fetch(`/api/music/search-tags?${params.toString()}`);
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setSearchResults(json.data);
      }
    } catch (e) {
      console.error('搜索失败:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  if (!trackData) {
    return <div className="page-container">音乐不存在</div>;
  }

  if (loading) {
    return <div className="page-container">加载中...</div>;
  }

  return (
    <div className="track-detail">
      <div className="td-header">
        <button className="td-back" onClick={router.goBack}>← 返回</button>
        <h2 className="td-title">音乐详情</h2>
        <div className="td-title-actions">
          <button className="td-btn" disabled={searchLoading} onClick={handleOnlineSearch}>
            {searchLoading ? '搜索中…' : '在线搜索'}
          </button>
        </div>
      </div>

      <div className="td-content">
        <div className="td-main">
          <div className="td-cover-section">
            <div className="td-cover-wrap">
              <img  className="td-cover"  src={coverPreview || track?.coverImage || '/images/default_cover.png'}  alt="封面" />
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleChooseCover} 
                className="td-cover-input" 
                id="cover-input"
              />
              <label htmlFor="cover-input" className="td-cover-label">选择封面</label>
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
              <label>专辑艺术家</label>
              <input 
                type="text" 
                value={form.albumArtist} 
                onChange={(e) => setForm(prev => ({ ...prev, albumArtist: e.target.value }))}
                placeholder="专辑艺术家"
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
            <div className="td-form-row">
              <label>流派</label>
              <input 
                type="text" 
                value={form.genre} 
                onChange={(e) => setForm(prev => ({ ...prev, genre: e.target.value }))}
                placeholder="音乐流派"
              />
            </div>
            <div className="td-form-row">
              <label>音轨号</label>
              <input 
                type="text" 
                value={form.track} 
                onChange={(e) => setForm(prev => ({ ...prev, track: e.target.value }))}
                placeholder="音轨编号"
              />
            </div>
          </div>

          <div className="td-lyrics-wrap">
            <div className="td-form-row">
              <label>歌词</label>
              <textarea 
                className="td-lyrics" 
                value={lyrics} 
                readOnly 
                placeholder="暂无歌词" 
              />
            </div>
          </div>

          <div className="td-file-info">
            <div className="td-form-row">
              <label>文件名</label>
              <span className="td-file-name">{fileName}</span>
            </div>
            <div className="td-form-row">
              <label>文件路径</label>
              <span className="td-file-path">{folderPath}</span>
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
                <h3>在线搜索结果</h3>
                <button onClick={() => setShowSearchPanel(false)}>✕</button>
              </div>
              <div className="td-drawer-body">
                {searchResults.length === 0 ? (
                  <div className="no-results">暂无搜索结果</div>
                ) : (
                  searchResults.map((r, idx) => (
                    <div key={idx} className="search-result-item" onClick={async () => {
                      const nextForm = { ...form, title: r.title, artist: r.artist, album: r.album, year: r.year };
                      setForm(nextForm);
                      // 获取封面和歌词
                      const coverRes = await fetch(`/api/music/cover-by-info?title=${encodeURIComponent(nextForm.title || '')}&artist=${encodeURIComponent(nextForm.artist || '')}${r.source?.includes('musicbrainz') && r.sourceId ? `&releaseId=${encodeURIComponent(r.sourceId)}` : ''}`);
                      const coverJson = await coverRes.json();
                      if (coverJson?.success && coverJson.data) setCoverPreview(coverJson.data);
                      
                      const lyrRes = await fetch(`/api/music/lyrics-by-info?title=${encodeURIComponent(nextForm.title || '')}&artist=${encodeURIComponent(nextForm.artist || '')}`);
                      const lyrJson = await lyrRes.json();
                      if (lyrJson?.success && lyrJson.data) setLyrics(lyrJson.data);
                      
                      setShowSearchPanel(false);
                    }}>
                      <div className="result-title">{r.title}</div>
                      <div className="result-artist">{r.artist}</div>
                      <div className="result-album">{r.album}</div>
                      <div className="result-year">{r.year}</div>
                      <div className="result-source">{r.source}</div>
                    </div>
                  ))
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


