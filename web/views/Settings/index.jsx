import React, { useState, useEffect } from 'react';
import '../Pages.css';
import './Settings.css';

/**
 * 设置页面组件
 */
const SettingsPage = ({ player }) => {
  // 媒体库管理状态
  const [mediaLibraries, setMediaLibraries] = useState([]);
  const [newLibraryPath, setNewLibraryPath] = useState('');
  const [scanningLibrary, setScanningLibrary] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [libraryStats, setLibraryStats] = useState({});

  // 刮削功能状态
  const [scrapingEnabled, setScrapingEnabled] = useState(false);
  const [scrapingInProgress, setScrapingInProgress] = useState(false);

  // 加载媒体库列表
  useEffect(() => {
    loadMediaLibraries();
    checkActiveScans();
    loadScrapingConfig();
  }, []);

  // 当媒体库列表更新时，重新加载统计信息
  useEffect(() => {
    if (mediaLibraries.length > 0) {
      loadLibraryStats();
    }
  }, [mediaLibraries]);

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
   * 加载媒体库统计信息
   */
  const loadLibraryStats = async () => {
    try {
      const response = await fetch('/api/settings/music-stats');
      const result = await response.json();
      if (result.success) {
        setLibraryStats(result.data || {});
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  /**
   * 加载刮削功能配置
   */
  const loadScrapingConfig = async () => {
    try {
      const response = await fetch('/api/settings/scraping-config');
      const result = await response.json();
      if (result.success) {
        setScrapingEnabled(result.data.enabled || false);
      }
    } catch (error) {
      console.error('加载刮削配置失败:', error);
    }
  };

  /**
   * 保存刮削功能配置
   */
  const saveScrapingConfig = async (enabled) => {
    try {
      const response = await fetch('/api/settings/scraping-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      const result = await response.json();
      if (result.success) {
        setScrapingEnabled(enabled);
        player.showToastMessage(enabled ? '刮削功能已开启' : '刮削功能已关闭', 'success');
      } else {
        player.showToastMessage('保存失败: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('保存刮削配置失败:', error);
      player.showToastMessage('保存失败', 'error');
    }
  };

  /**
   * 立即刮削
   */
  const startScraping = async () => {
    if (scrapingInProgress) {
      player.showToastMessage('刮削正在进行中，请稍候', 'warning');
      return;
    }

    setScrapingInProgress(true);
    player.showLoading('正在启动刮削...');
    
    try {
      await fetch('/api/settings/start-scraping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      player.showToastMessage('立即刮削已开始', 'success');
    } catch (error) {
      console.error('启动刮削失败:', error);
      player.showToastMessage('启动刮削失败', 'error');
    } finally {
      setScrapingInProgress(false);
      player.hideLoading();
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
    
    player.showLoading('正在添加媒体库...');
    
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
        player.showToastMessage('媒体库添加成功', 'success');
      } else {
        player.showToastMessage('添加失败: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('添加媒体库失败:', error);
      player.showToastMessage('添加失败', 'error');
    } finally {
      player.hideLoading();
    }
  };

  /**
   * 删除媒体库
   */
  const deleteMediaLibrary = async (id) => {
    if (!confirm('确定要删除这个媒体库吗？')) return;
    
    player.showLoading('正在删除媒体库...');
    
    try {
      const response = await fetch(`/api/settings/media-libraries/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        loadMediaLibraries();
        player.showToastMessage('媒体库删除成功', 'success');
      } else {
        player.showToastMessage('删除失败: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('删除媒体库失败:', error);
      player.showToastMessage('删除失败', 'error');
    } finally {
      player.hideLoading();
    }
  };

  /**
   * 扫描媒体库
   */
  const scanMediaLibrary = async (library) => {
    setScanningLibrary(library);
    setScanProgress(0);
    player.showLoading(`正在扫描媒体库: ${library.path}`);
    
    try {
      const response = await fetch(`/api/settings/media-libraries/${library.id}/scan`, {
        method: 'POST'
      });
      
      const result = await response.json();
      if (result.success) {
        player.hideLoading();
        player.showToastMessage('扫描已开始', 'success');
        // 开始轮询扫描进度
        pollScanProgress(library.id);
      } else {
        player.showToastMessage('扫描失败: ' + result.error, 'error');
        setScanningLibrary(null);
        player.hideLoading();
      }
    } catch (error) {
      console.error('扫描媒体库失败:', error);
      player.showToastMessage('扫描失败', 'error');
      setScanningLibrary(null);
      player.hideLoading();
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
            // 扫描完成后刷新列表和统计信息
            loadMediaLibraries();
            loadLibraryStats();
          } else if (result.data.status === 'failed') {
            clearInterval(interval);
            setScanningLibrary(null);
            setScanProgress(0);
            player.showToastMessage('扫描失败: ' + result.data.error, 'error');
          }
        }
      } catch (error) {
        console.error('获取扫描进度失败:', error);
      }
    }, 1000);
  };

  return (
    <div className="page-container settings-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => player.switchSidebar()}> ☰ </button>
          <h2>⚙️ 媒体库管理</h2>
        </div>
        <div className="fav-actions">
          {/* 可以在这里添加设置相关的操作按钮 */}
        </div>
      </div>
      
      <div className="settings-view">
        <div className="settings-page">
          {/* 统计信息 */}
          <div className="stats-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎵</div>
                <div className="stat-content">
                  <div className="stat-value">{libraryStats.tracks || 0}</div>
                  <div className="stat-label">音乐文件</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💿</div>
                <div className="stat-content">
                  <div className="stat-value">{libraryStats.albums || 0}</div>
                  <div className="stat-label">专辑</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎤</div>
                <div className="stat-content">
                  <div className="stat-value">{libraryStats.artists || 0}</div>
                  <div className="stat-label">艺术家</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📁</div>
                <div className="stat-content">
                  <div className="stat-value">{mediaLibraries.length}</div>
                  <div className="stat-label">媒体库</div>
                </div>
              </div>
            </div>
          </div>

          {/* 刮削功能设置 */}
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>🔍 刮削功能</h3>
              <p className="settings-section-desc">开启后将在扫描媒体库时自动获取音乐元数据信息</p>
            </div>
            
            <div className="scraping-config">
              <div className="config-item">
                <div className="config-info">
                  <div className="config-icon">🎯</div>
                  <div className="config-details">
                    <div className="config-title">自动刮削</div>
                    <div className="config-desc">扫描媒体库时自动从在线服务获取音乐元数据</div>
                  </div>
                </div>
                <div className="config-control">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={scrapingEnabled}
                      onChange={(e) => saveScrapingConfig(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
              
              <div className="scraping-actions">
                <button 
                  className="scraping-btn"
                  onClick={startScraping}
                  disabled={scrapingInProgress}
                >
                  {scrapingInProgress ? '🔄 刮削中...' : '🚀 立即刮削'}
                </button>
              </div>
            </div>
          </div>

          {/* 媒体库管理 */}
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>📁 媒体库管理</h3>
              <p className="settings-section-desc">管理本地音乐文件库，支持多种音频格式</p>
            </div>
            
            {/* 添加媒体库 */}
            <div className="add-library">
              <div className="add-library-input">
                <input
                  type="text"
                  placeholder="输入媒体库路径 (如: /music 或 C:\Music)"
                  value={newLibraryPath}
                  onChange={(e) => setNewLibraryPath(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addMediaLibrary()}
                />
                <button 
                  className="add-btn"
                  onClick={addMediaLibrary}
                  disabled={!newLibraryPath.trim()}
                >
                  ➕ 添加媒体库
                </button>
              </div>
            </div>
            
            {/* 媒体库列表 */}
            <div className="libraries-list">
              {mediaLibraries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📂</div>
                  <h4>暂无媒体库</h4>
                  <p>请添加媒体库路径来开始管理您的音乐文件</p>
                </div>
              ) : (
                mediaLibraries.map(library => (
                  <div key={library.id} className="library-item">
                    <div className="library-info">
                      <div className="library-icon">📁</div>
                      <div className="library-details">
                        <div className="library-path">{library.path}</div>
                        <div className="library-status">
                          {scanningLibrary?.id === library.id ? (
                            <span className="status scanning">🔄 扫描中 {scanProgress}%</span>
                          ) : (
                            <span className="status ready">✅ 就绪</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="library-actions">
                      <button 
                        onClick={() => scanMediaLibrary(library)}
                        disabled={scanningLibrary?.id === library.id}
                        className="scan-btn"
                        title="扫描媒体库"
                      >
                        🔍 扫描
                      </button>
                      <button 
                        onClick={() => deleteMediaLibrary(library.id)}
                        className="delete-btn"
                        title="删除媒体库"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
