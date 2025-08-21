import React, { useState, useEffect } from 'react';
import { MusicList } from '../../components';
import { useNavigate, useParams } from 'react-router-dom';
import { useUrlState } from '../../hooks';
import './ArtistDetail.css';

const ArtistDetailView = ({ player }) => {
  const navigate = useNavigate();
  const { artistId } = useParams();
  
  // 使用URL状态管理
  const { state, setPage, setPageSize, setSearch } = useUrlState({
    page: 1,
    pageSize: 10,
    search: ''
  });

  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  // 加载艺术家详情
  useEffect(() => {
    const loadArtistDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 通过API获取数据
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
  }, [artistId]);

  // 加载艺术家的音乐列表
  const loadTracks = async () => {
    if (!artist?.name) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: state.page.toString(),
        pageSize: state.pageSize.toString(),
        filter: JSON.stringify({
          artist: artist.name
        })
      });
      
      // 添加搜索关键词
      if (state.search) {
        params.set('search', state.search);
      }
      
      const res = await fetch(`/api/music/tracks?${params}`).then(res => res.json()); 
      const data = res.data || []; 
      const pagination = res.pagination || {};
      if (res?.success) {
        setTracks(data);
        setTotal(pagination.total || 0);
        setPages(pagination.pages || 0);
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

  // 当艺术家信息或状态变化时，加载音乐列表
  useEffect(() => {
    if (artist?.name) {
      loadTracks();
    }
  }, [artist?.name, state.page, state.pageSize, state.search]);

  // 处理页码变化
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  // 处理每页数量变化
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
  };

  // 处理搜索变化
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // 处理搜索清除
  const handleClearSearch = () => {
    setSearch('');
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
    navigate(`/track/${track.id || track._id}`);
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

  // 处理艺术家点击
  const handleArtistClick = (artist) => {
    navigate(`/artist/${artist}`);
  };

  // 处理专辑点击
  const handleAlbumClick = (album) => {
    navigate(`/album/${album}`);
  };

  // 编辑相关状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    detail: '',
    photo: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // 处理编辑按钮点击
  const handleEditClick = () => {
    setEditForm({
      name: artist.name || '',
      detail: artist.detail || '',
      photo: artist.photo || ''
    });
    setShowEditModal(true);
  };

  // 处理编辑表单提交
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      const response = await fetch(`/api/music/artists/${artistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 更新本地状态
        setArtist(result.data);
        setShowEditModal(false);
        player.showToastMessage('艺术家信息更新成功', 'success');
      } else {
        player.showToastMessage('更新失败: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('更新艺术家信息失败:', error);
      player.showToastMessage('更新艺术家信息失败', 'error');
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
        photo: base64String
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
            <div className="ad-desc">{artist.detail || '暂无简介'}</div>
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
                value={state.search} 
                onChange={handleSearchChange}
              />
              {state.search && (
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
            currentPage={state.page}
            pageSize={state.pageSize}
            total={total}
            pages={pages}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onPlayMusic={handlePlayMusic}
            onAddToPlaylist={handleAddToPlaylist}
            onOpenDetail={handleOpenDetail}
            onFavorite={handleFavorite}
            onArtistClick={handleArtistClick}
            onAlbumClick={handleAlbumClick}
          />
        </div>
      </div>

      {/* 编辑模态框 */}
      {showEditModal && (
        <div className="edit-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>编辑艺术家信息</h3>
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
                    {editForm.photo ? (
                      <img 
                        src={editForm.photo} 
                        alt="头像预览" 
                        className="preview-image"
                      />
                    ) : (
                      <div className="preview-placeholder">
                        <div className="placeholder-icon">👤</div>
                        <div className="placeholder-text">暂无头像</div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="cover-input"
                      id="photo-upload"
                      disabled={uploadingImage}
                    />
                    <label 
                      htmlFor="photo-upload" 
                      className={`cover-label ${uploadingImage ? 'disabled' : ''}`}
                    >
                      {uploadingImage ? '上传中...' : '选择头像'}
                    </label>
                  </div>
                  <div className="upload-hint">
                    支持JPG、PNG格式，大小不超过100KB
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>艺术家名称</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => handleEditFormChange('name', e.target.value)}
                  placeholder="请输入艺术家名称"
                  required
                />
              </div>
              <div className="form-group">
                <label>艺术家简介</label>
                <textarea
                  value={editForm.detail}
                  onChange={(e) => handleEditFormChange('detail', e.target.value)}
                  placeholder="请输入艺术家简介"
                  rows="4"
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

export default ArtistDetailView;


