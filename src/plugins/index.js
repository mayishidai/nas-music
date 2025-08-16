import kugou from './kugou.js';
import netease from './netease.js';
import qq from './qq.js';
import migu from './migu.js';

// 歌词搜索插件管理器
class LyricsPluginManager {
  constructor() {
    this.plugins = new Map();
    this.registerDefaultPlugins();
  }

  // 注册默认插件
  registerDefaultPlugins() {
    this.registerPlugin('kugou', kugou);
    this.registerPlugin('netease', netease);
    this.registerPlugin('qq', qq);
    this.registerPlugin('migu', migu);
  }

  // 注册插件
  registerPlugin(name, plugin) {
    if (plugin && typeof plugin.searchLyrics === 'function') {
      this.plugins.set(name, plugin);
      console.log(`歌词插件已注册: ${name}`);
    } else {
      console.warn(`插件 ${name} 格式不正确，需要实现 searchLyrics 方法`);
    }
  }

  // 获取所有可用插件
  getAvailablePlugins() {
    return Array.from(this.plugins.keys());
  }

  // 搜索歌词
  async searchLyrics(title, artist, pluginName = null) {
    const results = [];
    
    if (pluginName) {
      // 使用指定插件搜索
      const plugin = this.plugins.get(pluginName);
      if (plugin) {
        try {
          const result = await plugin.searchLyrics(title, artist);
          if (result) {
            results.push({ ...result, source: pluginName });
          }
        } catch (error) {
          console.error(`插件 ${pluginName} 搜索失败:`, error);
        }
      }
    } else {
      // 使用所有插件并行搜索
      const searchPromises = Array.from(this.plugins.entries()).map(async ([name, plugin]) => {
        try {
          const result = await plugin.searchLyrics(title, artist);
          return result ? { ...result, source: name } : null;
        } catch (error) {
          console.error(`插件 ${name} 搜索失败:`, error);
          return null;
        }
      });
      const pluginResults = await Promise.allSettled(searchPromises);
      pluginResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      });
    }

    return results;
  }

  // 获取插件信息
  getPluginInfo(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (plugin && typeof plugin.getInfo === 'function') {
      return plugin.getInfo();
    }
    return null;
  }
}

// 创建全局插件管理器实例
const lyricsPluginManager = new LyricsPluginManager();

export default lyricsPluginManager;
