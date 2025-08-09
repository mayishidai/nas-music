import React, { useEffect, useMemo, useRef, useState } from 'react';
import './TrackDetail.css';

const TrackDetailPage = ({ trackId, onBack }) => {
  const [track, setTrack] = useState(null);
  const [form, setForm] = useState({ title: '', artist: '', album: '', albumArtist: '', year: '', genre: '', track: '' });
  const [coverPreview, setCoverPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

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
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // 字段中文映射
  const labelMap = useMemo(() => ({
    title: '歌曲名',
    artist: '歌手',
    album: '专辑',
    albumArtist: '专辑艺人',
    year: '年份',
    genre: '流派',
    track: '曲目号'
  }), []);

  const fileInputRef = useRef(null);

  return (
    <div className="track-detail">
      <div className="td-back-row">
        <button className="td-back" onClick={onBack}>← 返回</button>
      </div>
      <div className="td-header">
        <div
          className="td-cover-wrap"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          title="点击更换封面"
          role="button"
        >
          {coverPreview ? (
            <img className="td-cover-img" src={coverPreview} alt="封面" />
          ) : (
            <div className="td-cover-ph">🎵</div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleChooseCover} />
        </div>
        <div className="td-meta">
          <div className="td-title-row">
            <h2 className="td-title">{form.title || track?.title || ''}</h2>
            <div className="td-title-actions">
              <button className="td-btn" disabled={searchLoading} onClick={handleOnlineSearch}>{searchLoading ? '搜索中…' : '在线搜索'}</button>
            </div>
          </div>
          <div className="td-sub">{form.artist || track?.artist || ''} · {form.album || track?.album || ''}</div>
          <div className="td-file">{folderPath + '/' || ''}{fileName}</div>
        </div>
      </div>
      <div className="td-body">
        <div className="td-form">
          {['title','artist','album','albumArtist','year','genre','track'].map((key) => (
            <div className="td-form-row" key={key}>
              <label>{labelMap[key] || key}</label>
              <input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="td-lyrics-wrap">
          <div className="td-form-row">
            <label>歌词</label>
            <textarea className="td-lyrics" value={lyrics} readOnly placeholder="暂无歌词" />
          </div>
        </div>
      </div>
      {/* 右侧抽屉：在线搜索结果 */}
      <div className={`td-drawer ${showSearchPanel ? 'open' : ''}`} aria-hidden={!showSearchPanel}>
        <div className="td-drawer-header">
          <div className="td-drawer-title">在线搜索结果</div>
          <button className="td-btn" onClick={() => setShowSearchPanel(false)}>关闭</button>
        </div>
        <div className="td-drawer-body">
          {searchLoading && <div className="td-loading">搜索中…</div>}
          {!searchLoading && searchResults.length === 0 && <div className="td-empty">暂无结果</div>}
          {!searchLoading && searchResults.length > 0 && (
            <div className="td-results">
              {searchResults.map((r, idx) => (
                <div
                  key={idx}
                  className="td-result"
                  onClick={() => {
                    setForm({
                      ...form,
                      title: r.title || form.title,
                      artist: r.artist || form.artist,
                      album: r.album || form.album,
                      year: r.year || form.year
                    });
                    if (r.coverImage) setCoverPreview(r.coverImage);
                    if (r.lyrics) setLyrics(r.lyrics);
                  }}
                >
                  <div className="td-r-title">{r.title || '未知歌曲'}</div>
                  <div className="td-r-sub">{r.artist || '未知艺术家'}{r.album ? ` - ${r.album}` : ''}{r.year ? ` (${r.year})` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showSearchPanel && <div className="td-drawer-mask" onClick={() => setShowSearchPanel(false)} />}
      <div className="td-actions td-bottom">
        <button className="td-btn primary" disabled={loading} onClick={handleSaveTags}>保存</button>
      </div>
    </div>
  );
};

export default TrackDetailPage;


