import React, { useEffect, useMemo, useRef, useState } from 'react';
import './TrackDetail.css';

const TrackDetailPage = ({ trackId, onBack }) => {
  const [track, setTrack] = useState(null);
  const [form, setForm] = useState({ title: '', artist: '', album: '', albumArtist: '', year: '', genre: '', track: '' });
  const [coverPreview, setCoverPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

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

  const handleOnlineSearch = async (q) => {
    try {
      const res = await fetch(`/api/music/search-tags?query=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json?.success) setSearchResults(json.data);
    } catch {}
  };

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
          <div className="td-file">{fileName}</div>
          {folderPath ? (<div className="td-folder" title={folderPath}>{folderPath}</div>) : null}
          <div className="td-title-row">
            <h2 className="td-title">{form.title || track?.title || ''}</h2>
            <div className="td-title-actions">
              <button className="td-btn" onClick={() => handleOnlineSearch(`${form.title || track?.title || ''} ${form.artist || track?.artist || ''}`.trim())}>在线搜索</button>
            </div>
          </div>
          <div className="td-sub">{form.artist || track?.artist || ''} · {form.album || track?.album || ''}</div>
          
        </div>
      </div>
      <div className="td-body">
        <div className="td-form">
          {['title','artist','album','albumArtist','year','genre','track'].map((key) => (
            <div className="td-form-row" key={key}>
              <label>{key}</label>
              <input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <div className="td-actions">
            <button className="td-btn primary" disabled={loading} onClick={handleSaveTags}>保存</button>
          </div>
        </div>
      </div>
      <div className="td-online">
        <div className="td-results">
          {searchResults.map((r, idx) => (
            <div key={idx} className="td-result" onClick={() => setForm({ ...form, title: r.title, artist: r.artist, album: r.album, year: r.year })}>
              <div className="td-r-title">{r.title}</div>
              <div className="td-r-sub">{r.artist} - {r.album} {r.year?`(${r.year})`:''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrackDetailPage;


