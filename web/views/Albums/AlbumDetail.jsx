import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './AlbumDetail.css';

/**
 * 专辑详情视图
 */
const AlbumDetailView = ({ player }) => {
  const navigate = useNavigate();
  const { albumId } = useParams();
  const [album, setAlbum] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 编辑相关状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    artist: '',
    year: '',
    coverImage: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // 加载专辑详情和歌曲列表
  useEffect(() => {
    const loadAlbumDetail = async () => {
      if (!albumId) {
        setError('专辑ID不存在');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 获取专辑详情
        const albumResponse = await fetch(`/api/music/albums/${albumId}`);
        const albumResult = await albumResponse.json();

        if (!albumResult.success) {
          throw new Error(albumResult.error || '获取专辑信息失败');
        }

        const albumInfo = albumResult.data;
        setAlbum(albumInfo);
        setTracks(albumInfo.tracks || []);

      } catch (err) {
        console.error('加载专辑详情失败:', err);
        setError(err.message || '加载专辑详情失败');
      } finally {
        setLoading(false);
      }
    };

    loadAlbumDetail();
  }, [albumId]);

  // 格式化时长
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 处理播放全部
  const handlePlayAll = () => {
    if (tracks.length > 0) {
      player.playMusic(tracks[0], tracks);
    }
  };

  // 处理播放单首
  const handlePlay = (track) => {
    player.playMusic(track, tracks);
  };

  // 处理添加到播放列表
  const handleAddToPlaylist = (track) => {
    player.addToPlaylist(track);
  };

  // 处理收藏
  const handleFavorite = async (track, favorite) => {
    try {
      const response = await fetch(`/api/music/tracks/${track.id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite })
      });
      
      if (response.ok) {
        // 更新本地状态
        const updatedTracks = tracks.map(t => 
          t.id === track.id ? { ...t, favorite } : t
        );
        setTracks(updatedTracks);
      }
    } catch (error) {
      console.error('更新收藏状态失败:', error);
    }
  };

  // 处理打开详情
  const handleOpenDetail = (track) => {
    navigate(`/track/${track.id || track._id}`);
  };

  // 处理艺术家点击
  const handleArtistClick = (artist) => {
    navigate(`/artist/${artist}`);
  };

  // 处理编辑按钮点击
  const handleEditClick = () => {
    setEditForm({
      title: album.title || '',
      artist: album.artist || '',
      year: album.year || '',
      coverImage: album.coverImage || ''
    });
    setShowEditModal(true);
  };

  // 处理编辑表单提交
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setEditLoading(true);
      
      const response = await fetch(`/api/music/albums/${albumId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 更新本地状态
        setAlbum(result.data);
        setTracks(result.data.tracks || []);
        setShowEditModal(false);
        player.showToastMessage('专辑信息更新成功', 'success');
      } else {
        player.showToastMessage('更新失败: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('更新专辑信息失败:', error);
      player.showToastMessage('更新专辑信息失败', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // 处理编辑表单输入变化
  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 处理图片上传
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件大小（100KB = 100 * 1024 bytes）
    const maxSize = 100 * 1024;
    if (file.size > maxSize) {
      player.showToastMessage('图片文件大小不能超过100KB', 'error');
      return;
    }

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      player.showToastMessage('请选择图片文件', 'error');
      return;
    }

    setUploadingImage(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target.result;
      setEditForm(prev => ({
        ...prev,
        coverImage: base64String
      }));
      setUploadingImage(false);
      player.showToastMessage('图片上传成功', 'success');
    };

    reader.onerror = () => {
      setUploadingImage(false);
      player.showToastMessage('图片上传失败', 'error');
    };

    reader.readAsDataURL(file);
  };

  // 获取专辑封面
  const getAlbumCover = () => {
    if (album?.coverImage) return album.coverImage;
    if (tracks.length > 0) {
      const trackWithCover = tracks.find(t => t.coverImage);
      return trackWithCover?.coverImage;
    }
    return null;
  };

  // 加载状态
  if (loading) {
    return (
      <div className="album-detail">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载专辑信息...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="album-detail">
        <div className="error-container">
          <h3>加载失败</h3>
          <p>{error}</p>
          <button className="ad-btn" onClick={() => navigate(-1)}>返回</button>
        </div>
      </div>
    );
  }

  // 专辑不存在
  if (!album) {
    return (
      <div className="album-detail">
        <div className="error-container">
          <h3>专辑不存在</h3>
          <p>该专辑可能已被删除或不存在</p>
          <button className="ad-btn" onClick={() => navigate(-1)}>返回</button>
        </div>
      </div>
    );
  }

  const cover = getAlbumCover();

  return (
    <div className="album-detail">
      <div className="album-detail-header">
        <div className="ad-header-buttons">
          <div className="ad-left-buttons">
            <button className="ad-sidebar-btn" onClick={() => player.switchSidebar()}>☰</button>
            <button className="ad-back" onClick={() => navigate(-1)}>← 返回</button>
          </div>
          <div className="ad-right-buttons">
            <button 
              className="ad-btn edit-btn" 
              onClick={handleEditClick}
            >
              ✏️ 编辑详情
            </button>
          </div>
        </div>
        <div className="ad-cover-wrap">
          {cover ? (
            <img className="ad-cover" src={cover} alt={album.title || '专辑'} />
          ) : (
            <div className="ad-cover placeholder">💿</div>
          )}
        </div>
        <div className="ad-meta">
          <h2 className="ad-title">{album.title || '未知专辑'}</h2>
          <div className="ad-sub">
            {album.artist || '未知艺术家'} · {tracks.length} 首歌曲
            {album.year && ` · ${album.year}`}
          </div>
          <div className="ad-actions">
            <button 
              className="ad-btn primary" 
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
            >
              ▶ 播放全部
            </button>
            <button 
              className="ad-btn" 
              onClick={() => tracks.forEach(t => handleAddToPlaylist(t))}
              disabled={tracks.length === 0}
            >
              ➕ 加入播放列表
            </button>
          </div>
        </div>
      </div>

      <div className="album-detail-tracks">
        <div className="ad-tracks-header">
          <div className="th th-no">#</div>
          <div className="th th-title">标题</div>
          <div className="th th-artist">艺术家</div>
          <div className="th th-duration">时长</div>
          <div className="th th-actions"><div className='center'>操作</div></div>
        </div>
        <div className="ad-tracks-body">
          {tracks.length === 0 ? (
            <div className="tr empty">
              <div>暂无歌曲</div>
            </div>
          ) : (
            tracks.map((track, idx) => (
              <div
                key={track.id || track._id}
                className="tr"
                onDoubleClick={() => handlePlay(track)}
              >
                <div className="td td-no">{idx + 1}</div>
                <div className="td td-title">
                  <div className="title-wrap">
                    <img className="td-cover" src={track.coverImage || '/images/default_albums.png'} alt="封面" />
                    <div className="title-text">{track.title || '未知标题'}</div>
                  </div>
                </div>
                <div className="td td-artist">
                  <span 
                    className={`artist-link ${track.artist && track.artist !== '未知艺术家' ? 'clickable' : ''}`}
                    onClick={() => handleArtistClick(track.artist)}
                    title={track.artist && track.artist !== '未知艺术家' ? `查看 ${track.artist} 的歌曲` : ''}
                  >
                    {track.artist || '未知艺术家'}
                  </span>
                </div>
                <div className="td td-duration">
                  {formatDuration(track.duration)}
                </div>
                <div className="td td-actions">
                  <div className="action-buttons">
                    <button 
                      className="action-btn play-btn"
                      onClick={() => handlePlay(track)}
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
                      onClick={() => handleFavorite(track, !track.favorite)}
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
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 编辑模态框 */}
      {showEditModal && (
        <div className="edit-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>编辑专辑信息</h3>
              <button 
                className="edit-modal-close" 
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>
            <form className="edit-modal-form" onSubmit={handleEditSubmit}>
              <div className="form-group cover-section">
                <div className="cover-upload-section">
                  <div className="cover-preview-wrap">
                    {editForm.coverImage ? (
                      <img 
                        src={editForm.coverImage} 
                        alt="封面预览" 
                        className="preview-image"
                      />
                    ) : (
                      <div className="preview-placeholder">
                        <div className="placeholder-icon">💿</div>
                        <div className="placeholder-text">暂无封面</div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="cover-input"
                      id="cover-upload"
                      disabled={uploadingImage}
                    />
                    <label 
                      htmlFor="cover-upload" 
                      className={`cover-label ${uploadingImage ? 'disabled' : ''}`}
                    >
                      {uploadingImage ? '上传中...' : '选择封面'}
                    </label>
                  </div>
                  <div className="upload-hint">
                    支持JPG、PNG格式，大小不超过100KB
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>专辑名称</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => handleEditFormChange('title', e.target.value)}
                  placeholder="请输入专辑名称"
                  required
                />
              </div>
              <div className="form-group">
                <label>艺术家</label>
                <input
                  type="text"
                  value={editForm.artist}
                  onChange={(e) => handleEditFormChange('artist', e.target.value)}
                  placeholder="请输入艺术家名称"
                  required
                />
              </div>
              <div className="form-group">
                <label>发行年份</label>
                <input
                  type="number"
                  value={editForm.year}
                  onChange={(e) => handleEditFormChange('year', e.target.value)}
                  placeholder="请输入发行年份"
                  min="1900"
                  max="2030"
                />
              </div>
              <div className="edit-modal-actions">
                <button 
                  type="button" 
                  className="edit-btn cancel"
                  onClick={() => setShowEditModal(false)}
                  disabled={editLoading}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className={`edit-btn submit ${editLoading ? 'loading' : ''}`}
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <>
                      <div className="btn-loading-spinner"></div>
                      <span>保存中...</span>
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumDetailView;


