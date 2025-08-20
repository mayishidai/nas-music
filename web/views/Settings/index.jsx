import React, { useState, useEffect } from 'react';
import '../Pages.css';
import './Settings.css';

/**
 * 设置页面组件
 */
const SettingsPage = ({ player }) => {
  // 媒体库管理状态
  const [activeTab, setActiveTab] = useState('media-libraries');
  const [mediaLibraries, setMediaLibraries] = useState([]);
  const [newLibraryPath, setNewLibraryPath] = useState('');
  const [editingLibrary, setEditingLibrary] = useState(null);
  const [scanningLibrary, setScanningLibrary] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [cachedOnlineMusic, setCachedOnlineMusic] = useState([]);
  const [cachedMusicLoading, setCachedMusicLoading] = useState(false);
  const [cachedMusicPage, setCachedMusicPage] = useState(1);
  const [cachedMusicTotal, setCachedMusicTotal] = useState(0);

  // Toast 消息状态
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // API配置状态
  const [apiConfigs, setApiConfigs] = useState({
    musicbrainz: { baseUrl: 'https://musicbrainz.org/ws/2/', userAgent: 'NAS-Music-Server/1.0.0' },
  });

  // 加载媒体库列表
  useEffect(() => {
    loadMediaLibraries();
    loadApiConfigs();
    checkActiveScans();
  }, []);

  // 当切换到缓存音乐标签页时加载数据
  useEffect(() => {
    if (activeTab === 'cached-music') {
      loadCachedOnlineMusic();
    }
  }, [activeTab]);

  /**
   * 加载媒体库列表
   */
  const loadMediaLibraries = async () => {
    try {
      const response = await fetch('/api/settings/media-libraries');
      const result = await response.json();
      if (result.success) {
        setMediaLibraries(result.data || []);
      }
    } catch (error) {
      console.error('加载媒体库列表失败:', error);
    }
  };

  /**
   * 加载API配置
   */
  const loadApiConfigs = async () => {
    try {
      const response = await fetch('/api/settings/api-configs');
      const result = await response.json();
      if (result.success) {
        setApiConfigs(result.data || apiConfigs);
      }
    } catch (error) {
      console.error('加载API配置失败:', error);
    }
  };

  /**
   * 检查是否有正在进行的扫描任务
   */
  const checkActiveScans = async () => {
    try {
      // 检查每个媒体库的扫描状态
      const response = await fetch('/api/settings/media-libraries');
      const result = await response.json();
      if (result.success) {
        const libraries = result.data || [];
        
        for (const library of libraries) {
          const progressResponse = await fetch(`/api/settings/media-libraries/${library.id}/scan-progress`);
          const progressResult = await progressResponse.json();
          
          if (progressResult.success && progressResult.data && progressResult.data.status === 'scanning') {
            // 发现正在进行的扫描，恢复进度轮询
            setScanningLibrary(library);
            setScanProgress(progressResult.data.progress || 0);
            pollScanProgress(library.id);
            break; // 只处理第一个正在进行的扫描
          }
        }
      }
    } catch (error) {
      console.error('检查扫描状态失败:', error);
    }
  };

  /**
   * 添加媒体库
   */
  const addMediaLibrary = async () => {
    if (!newLibraryPath.trim()) return;
    
    try {
      const response = await fetch('/api/settings/media-libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newLibraryPath.trim() })
      });
      
      const result = await response.json();
      if (result.success) {
        setNewLibraryPath('');
        loadMediaLibraries();
      } else {
        alert('添加失败: ' + result.error);
      }
    } catch (error) {
      console.error('添加媒体库失败:', error);
      alert('添加失败');
    }
  };

  /**
   * 删除媒体库
   */
  const deleteMediaLibrary = async (id) => {
    if (!confirm('确定要删除这个媒体库吗？')) return;
    
    try {
      const response = await fetch(`/api/settings/media-libraries/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        loadMediaLibraries();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除媒体库失败:', error);
      alert('删除失败');
    }
  };

  /**
   * 扫描媒体库
   */
  const scanMediaLibrary = async (library) => {
    setScanningLibrary(library);
    setScanProgress(0);
    
    try {
      const response = await fetch(`/api/settings/media-libraries/${library.id}/scan`, {
        method: 'POST'
      });
      
      const result = await response.json();
      if (result.success) {
        // 开始轮询扫描进度
        pollScanProgress(library.id);
      } else {
        alert('扫描失败: ' + result.error);
        setScanningLibrary(null);
      }
    } catch (error) {
      console.error('扫描媒体库失败:', error);
      alert('扫描失败');
      setScanningLibrary(null);
    }
  };

  /**
   * 轮询扫描进度
   */
  const pollScanProgress = async (libraryId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/settings/media-libraries/${libraryId}/scan-progress`);
        const result = await response.json();
        
        if (result.success) {
          setScanProgress(result.data.progress || 0);
          
          if (result.data.status === 'completed') {
            clearInterval(interval);
            setScanningLibrary(null);
            setScanProgress(0);
            // 扫描完成后刷新列表，但不弹窗
            loadMediaLibraries();
          } else if (result.data.status === 'failed') {
            clearInterval(interval);
            setScanningLibrary(null);
            setScanProgress(0);
            alert('扫描失败: ' + result.data.error);
          }
        }
      } catch (error) {
        console.error('获取扫描进度失败:', error);
      }
    }, 1000);
  };

  /**
   * 加载缓存的在线音乐数据
   */
  const loadCachedOnlineMusic = async (page = 1) => {
    try {
      setCachedMusicLoading(true);
      const response = await fetch(`/api/online/music/cached?page=${page}&pageSize=20`);
      const result = await response.json();
      
      if (result.success) {
        setCachedOnlineMusic(result.data);
        setCachedMusicTotal(result.total);
        setCachedMusicPage(result.page);
      }
    } catch (error) {
      console.error('加载缓存的在线音乐数据失败:', error);
    } finally {
      setCachedMusicLoading(false);
    }
  };

  // 清除缓存的在线音乐数据
  const clearCachedOnlineMusic = async (id = null) => {
    try {
      const url = id ? `/api/online/music/cached?id=${id}` : '/api/online/music/cached';
      const response = await fetch(url, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        showToastMessage(result.message, 'success');
        loadCachedOnlineMusic(cachedMusicPage);
      }
    } catch (error) {
      console.error('清除缓存数据失败:', error);
      showToastMessage('清除缓存数据失败', 'error');
    }
  };

  /**
   * 保存API配置
   */
  const saveApiConfigs = async () => {
    try {
      const response = await fetch('/api/settings/api-configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiConfigs)
      });
      
      const result = await response.json();
      if (result.success) {
        alert('API配置保存成功！');
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存API配置失败:', error);
      alert('保存失败');
    }
  };

  /**
   * 更新API配置
   */
  const updateApiConfig = (service, field, value) => {
    setApiConfigs(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        [field]: value
      }
    }));
  };

  /**
   * 测试API配置
   */
  const testApiConfig = async (service) => {
    try {
      const response = await fetch(`/api/settings/test-api/${service}`, {
        method: 'POST'
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`${service} API配置测试成功！`);
      } else {
        alert(`测试失败: ${result.error}`);
      }
    } catch (error) {
      console.error('API配置测试失败:', error);
      alert('测试失败');
    }
  };

  // 显示Toast消息的函数
  const showToastMessage = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // 2秒后自动隐藏
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  return (
    <div className="page-container settings-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => player.switchSidebar()}> ☰ </button>
          <h2>⚙️ 设置</h2>
        </div>
        <div className="fav-actions">
          {/* 可以在这里添加设置相关的操作按钮 */}
        </div>
      </div>
      <div className="settings-view">
        <div className="settings-page">
          <div className="settings-tabs">
            <button 
              className={`settings-tab ${activeTab === 'media-libraries' ? 'active' : ''}`}
              onClick={() => setActiveTab('media-libraries')}
            >
              媒体库
            </button>
            <button 
              className={`settings-tab ${activeTab === 'cached-music' ? 'active' : ''}`}
              onClick={() => setActiveTab('cached-music')}
            >
              缓存音乐
            </button>
          </div>

          {/* 媒体库设置 */}
          {activeTab === 'media-libraries' && (
            <div className="settings-content">
              {/* 添加媒体库 */}
              <div className="add-library">
                <input
                  type="text"
                  placeholder="输入媒体库路径 (如: /music 或 C:\Music)"
                  value={newLibraryPath}
                  onChange={(e) => setNewLibraryPath(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addMediaLibrary()}
                />
                <button onClick={addMediaLibrary}>添加媒体库</button>
              </div>
              
              {/* 媒体库列表 */}
              <div className="libraries-list">
                {mediaLibraries.map(library => (
                  <div key={library.id} className="library-item">
                    <div className="library-info">
                      <div className="library-path">{library.path}</div>
                    </div>
                    <div className="library-actions">
                      <button 
                        onClick={() => scanMediaLibrary(library)}
                        disabled={scanningLibrary?.id === library.id}
                        className="scan-btn"
                      >
                        {scanningLibrary?.id === library.id ? `扫描中 ${scanProgress}%` : '扫描'}
                      </button>
                      <button 
                        onClick={() => deleteMediaLibrary(library.id)}
                        className="delete-btn"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                
                {mediaLibraries.length === 0 && (
                  <div className="empty-state">
                    <p>暂无媒体库，请添加媒体库路径</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 缓存音乐管理 */}
          {activeTab === 'cached-music' && (
            <div className="settings-content">
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3>缓存的在线音乐数据</h3>
                  <div className="settings-section-actions">
                    <button 
                      className="settings-btn danger"
                      onClick={() => {
                        if (confirm('确定要清除所有缓存的在线音乐数据吗？')) {
                          clearCachedOnlineMusic();
                        }
                      }}
                    >
                      清除所有缓存
                    </button>
                  </div>
                </div>
                
                {cachedMusicLoading ? (
                  <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>加载中...</p>
                  </div>
                ) : cachedOnlineMusic.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <p>暂无缓存的在线音乐数据</p>
                    <p className="empty-tip">在线搜索音乐时会自动缓存搜索结果</p>
                  </div>
                ) : (
                  <div className="cached-music-list">
                    {cachedOnlineMusic.map((item) => (
                      <div key={item.id} className="cached-music-item">
                        <div className="cached-music-cover">
                          <img 
                            src={item.coverImage || '/images/default_cover.png'} 
                            alt={item.title}
                            onError={e => { e.target.src = '/images/default_cover.png' }}
                          />
                        </div>
                        <div className="cached-music-info">
                          <div className="cached-music-title">{item.title}</div>
                          <div className="cached-music-artist">{item.artist}</div>
                          <div className="cached-music-album">{item.album}</div>
                          <div className="cached-music-meta">
                            <span>匹配度: {Math.round(item.score || 0)}%</span>
                            <span>日期: {item.date}</span>
                          </div>
                        </div>
                        <div className="cached-music-actions">
                          <button 
                            className="settings-btn small danger"
                            onClick={() => {
                              if (confirm('确定要删除这条缓存数据吗？')) {
                                clearCachedOnlineMusic(item.id);
                              }
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* 分页 */}
                    {cachedMusicTotal > 20 && (
                      <div className="pagination">
                        <button 
                          className="page-btn"
                          disabled={cachedMusicPage <= 1}
                          onClick={() => loadCachedOnlineMusic(cachedMusicPage - 1)}
                        >
                          上一页
                        </button>
                        <span className="page-info">
                          第 {cachedMusicPage} 页，共 {Math.ceil(cachedMusicTotal / 20)} 页
                        </span>
                        <button 
                          className="page-btn"
                          disabled={cachedMusicPage >= Math.ceil(cachedMusicTotal / 20)}
                          onClick={() => loadCachedOnlineMusic(cachedMusicPage + 1)}
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* API配置 */}
          <div className="settings-section">
            <h3>🔗 接口配置</h3>
            
            {/* MusicBrainz API */}
            <div className="api-config">
              <h4>🎵 MusicBrainz API</h4>
              <div className="config-fields">
                <div className="config-field">
                  <label>User Agent:</label>
                  <input
                    type="text"
                    value={apiConfigs.musicbrainz.userAgent}
                    onChange={(e) => updateApiConfig('musicbrainz', 'userAgent', e.target.value)}
                    placeholder="NAS-Music-Server/1.0.0"
                  />
                </div>
                <div className="config-field">
                </div>
                <div className="config-field">
                  <button 
                    onClick={() => testApiConfig('musicbrainz')}
                    className="test-btn"
                  >
                    测试连接
                  </button>
                </div>
              </div>
            </div>
            
            {/* 保存按钮 */}
            <div className="save-config">
              <button onClick={saveApiConfigs} className="save-btn">
                保存API配置
              </button>
            </div>
          </div>
        </div>
      </div>
      
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
  );
};

export default SettingsPage;
