import React, { useState, useEffect } from 'react';
import '../Pages.css';
import './Settings.css';

/**
 * 设置页面组件
 */
const SettingsPage = ({ router }) => {
  // 媒体库管理状态
  const [mediaLibraries, setMediaLibraries] = useState([]);
  const [newLibraryPath, setNewLibraryPath] = useState('');
  const [editingLibrary, setEditingLibrary] = useState(null);
  const [scanningLibrary, setScanningLibrary] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);

  // API配置状态
  const [apiConfigs, setApiConfigs] = useState({
    musicbrainz: { baseUrl: 'https://musicbrainz.org/ws/2/', userAgent: 'NAS-Music-Server/1.0.0' },
    lastfm: { apiKey: '', baseUrl: 'https://ws.audioscrobbler.com/2.0/', enabled: false },
  });

  // 加载媒体库列表
  useEffect(() => {
    loadMediaLibraries();
    loadApiConfigs();
  }, []);

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

  return (
    <div className="page-container settings-container">
      <div className="fav-toolbar">
        <div className="fav-toolbar-left">
          <button className="sidebar-toggle" onClick={() => router.switchSidebar()}> ☰ </button>
          <h2>⚙️ 设置</h2>
        </div>
        <div className="fav-actions">
          {/* 可以在这里添加设置相关的操作按钮 */}
        </div>
      </div>
      <div className="settings-view">
        <div className="settings-page">
          {/* 媒体库管理 */}
          <div className="settings-section">
            <h3>📁 媒体库管理</h3>
            
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
            
            {/* Last.fm API */}
            <div className="api-config">
              <h4>🎧 Last.fm API</h4>
              <div className="config-fields">
                <div className="config-field">
                  <label>API Key:</label>
                  <input
                    type="password"
                    value={apiConfigs.lastfm.apiKey}
                    onChange={(e) => updateApiConfig('lastfm', 'apiKey', e.target.value)}
                    placeholder="输入 Last.fm API Key"
                  />
                </div>
                <div className="config-field">
                  <label>启用:</label>
                  <input
                    type="checkbox"
                    checked={apiConfigs.lastfm.enabled}
                    onChange={(e) => updateApiConfig('lastfm', 'enabled', e.target.checked)}
                  />
                </div>
                <div className="config-field">
                  <button 
                    onClick={() => testApiConfig('lastfm')}
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
    </div>
  );
};

export default SettingsPage;
