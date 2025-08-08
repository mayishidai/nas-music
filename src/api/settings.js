import Router from 'koa-router';
import axios from 'axios';
import { getConfig, saveConfig } from '../client/database.js';

const router = new Router();

// 获取配置
router.get('/config', async (ctx) => {
  try {
    const config = await getConfig();
    // 不返回敏感信息的完整版本，但保留必要字段用于前端显示
    const safeConfig = {
      lastfmApiKey: config.lastfmApiKey || '',
      musicbrainzUserAgent: config.musicbrainzUserAgent || 'NAS-Music-Server/1.0.0',
      enableLastfm: config.enableLastfm !== false,
      enableMusicbrainz: config.enableMusicbrainz !== false,
      enableQQMusic: config.enableQQMusic || false,
      enableNeteaseMusic: config.enableNeteaseMusic || false,
      qqMusicApiKey: config.qqMusicApiKey || '',
      neteaseMusicApiKey: config.neteaseMusicApiKey || '',
      scanInterval: config.scanInterval || 3600000,
      supportedFormats: config.supportedFormats || ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'],
      coverSize: config.coverSize || 300,
      language: config.language || 'zh-CN',
      musicLibraryPaths: config.musicLibraryPaths || ['./music'],
      audioFormats: config.audioFormats || ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'wma'],
    };
    
    ctx.body = {
      success: true,
      data: safeConfig
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取配置失败: ' + error.message };
  }
});

// 保存配置
router.post('/config', async (ctx) => {
  try {
    const newConfig = ctx.request.body;
    
    // 获取现有配置
    const existingConfig = await getConfig();
    
    // 合并配置
    const updatedConfig = {
      ...existingConfig,
      ...newConfig,
      _id: 'app_config'
    };
    
    await saveConfig(updatedConfig);
    
    ctx.body = {
      success: true,
      message: '配置保存成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '保存配置失败: ' + error.message };
  }
});

// Last.fm API搜索
async function searchLastfm(query, config) {
  if (!config.enableLastfm || !config.lastfmApiKey) {
    return [];
  }

  try {
    const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.search',
        track: query,
        api_key: config.lastfmApiKey,
        format: 'json',
        limit: 10
      },
      timeout: 5000
    });

    const tracks = response.data.results?.trackmatches?.track || [];
    return Array.isArray(tracks) ? tracks.map(track => ({
      source: 'Last.fm',
      title: track.name,
      artist: track.artist,
      album: '',
      year: null,
      image: track.image?.find(img => img.size === 'large')?.['#text'] || null
    })) : [];
  } catch (error) {
    console.error('Last.fm搜索失败:', error.message);
    return [];
  }
}

// MusicBrainz API搜索
async function searchMusicBrainz(query, config) {
  if (!config.enableMusicbrainz) {
    return [];
  }

  try {
    const response = await axios.get('https://musicbrainz.org/ws/2/recording', {
      params: {
        query: query,
        fmt: 'json',
        limit: 10
      },
      headers: {
        'User-Agent': config.musicbrainzUserAgent || 'NAS-Music-Server/1.0.0'
      },
      timeout: 5000
    });

    const recordings = response.data.recordings || [];
    return recordings.map(recording => ({
      source: 'MusicBrainz',
      title: recording.title,
      artist: recording['artist-credit']?.[0]?.name || '未知艺术家',
      album: recording.releases?.[0]?.title || '未知专辑',
      year: recording.releases?.[0]?.date?.substring(0, 4) || null,
      duration: recording.length ? Math.round(recording.length / 1000) : null,
      mbid: recording.id
    }));
  } catch (error) {
    console.error('MusicBrainz搜索失败:', error.message);
    return [];
  }
}

// QQ音乐API搜索（模拟接口）
async function searchQQMusic(query, config) {
  if (!config.enableQQMusic) {
    return [];
  }

  try {
    // 注意：这里需要实际的QQ音乐API接口
    // 由于QQ音乐API需要特殊授权，这里提供一个模拟实现
    console.log('QQ音乐搜索功能需要配置实际的API接口');
    return [];
  } catch (error) {
    console.error('QQ音乐搜索失败:', error.message);
    return [];
  }
}

// 网易云音乐API搜索（模拟接口）
async function searchNeteaseMusic(query, config) {
  if (!config.enableNeteaseMusic) {
    return [];
  }

  try {
    // 注意：这里需要实际的网易云音乐API接口
    // 由于网易云音乐API需要特殊处理，这里提供一个模拟实现
    console.log('网易云音乐搜索功能需要配置实际的API接口');
    return [];
  } catch (error) {
    console.error('网易云音乐搜索失败:', error.message);
    return [];
  }
}

// 综合搜索API
router.get('/search-metadata', async (ctx) => {
  const { query, sources } = ctx.query;
  
  if (!query) {
    ctx.status = 400;
    ctx.body = { error: '请提供搜索关键词' };
    return;
  }

  try {
    const config = await getConfig();
    const enabledSources = sources ? sources.split(',') : ['lastfm', 'musicbrainz', 'qqmusic', 'netease'];
    
    const searchPromises = [];
    
    if (enabledSources.includes('lastfm')) {
      searchPromises.push(searchLastfm(query, config));
    }
    
    if (enabledSources.includes('musicbrainz')) {
      searchPromises.push(searchMusicBrainz(query, config));
    }
    
    if (enabledSources.includes('qqmusic')) {
      searchPromises.push(searchQQMusic(query, config));
    }
    
    if (enabledSources.includes('netease')) {
      searchPromises.push(searchNeteaseMusic(query, config));
    }

    const results = await Promise.all(searchPromises);
    const combinedResults = results.flat();

    ctx.body = {
      success: true,
      data: combinedResults,
      sources: enabledSources,
      total: combinedResults.length
    };
  } catch (error) {
    console.error('综合搜索失败:', error.message);
    ctx.status = 500;
    ctx.body = { error: '搜索失败: ' + error.message };
  }
});

// 获取专辑封面
router.get('/album-cover', async (ctx) => {
  const { artist, album } = ctx.query;
  
  if (!artist || !album) {
    ctx.status = 400;
    ctx.body = { error: '请提供艺术家和专辑名称' };
    return;
  }

  try {
    const config = await getConfig();
    
    if (config.enableLastfm && config.lastfmApiKey) {
      const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'album.getinfo',
          api_key: config.lastfmApiKey,
          artist: artist,
          album: album,
          format: 'json'
        },
        timeout: 5000
      });

      const albumInfo = response.data.album;
      if (albumInfo && albumInfo.image) {
        const largeImage = albumInfo.image.find(img => img.size === 'extralarge' || img.size === 'large');
        if (largeImage && largeImage['#text']) {
          ctx.body = {
            success: true,
            data: {
              coverUrl: largeImage['#text'],
              source: 'Last.fm',
              artist: albumInfo.artist,
              album: albumInfo.name,
              playcount: albumInfo.playcount,
              listeners: albumInfo.listeners
            }
          };
          return;
        }
      }
    }

    ctx.body = {
      success: false,
      error: '未找到专辑封面'
    };
  } catch (error) {
    console.error('获取专辑封面失败:', error.message);
    ctx.status = 500;
    ctx.body = { error: '获取封面失败: ' + error.message };
  }
});

// 获取艺术家信息
router.get('/artist-info', async (ctx) => {
  const { artist } = ctx.query;
  
  if (!artist) {
    ctx.status = 400;
    ctx.body = { error: '请提供艺术家名称' };
    return;
  }

  try {
    const config = await getConfig();
    
    if (config.enableLastfm && config.lastfmApiKey) {
      const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'artist.getinfo',
          api_key: config.lastfmApiKey,
          artist: artist,
          format: 'json'
        },
        timeout: 5000
      });

      const artistInfo = response.data.artist;
      if (artistInfo) {
        ctx.body = {
          success: true,
          data: {
            name: artistInfo.name,
            bio: artistInfo.bio?.summary || '',
            image: artistInfo.image?.find(img => img.size === 'extralarge')?.['#text'] || null,
            playcount: artistInfo.stats?.playcount || 0,
            listeners: artistInfo.stats?.listeners || 0,
            tags: artistInfo.tags?.tag?.map(tag => tag.name) || [],
            source: 'Last.fm'
          }
        };
        return;
      }
    }

    ctx.body = {
      success: false,
      error: '未找到艺术家信息'
    };
  } catch (error) {
    console.error('获取艺术家信息失败:', error.message);
    ctx.status = 500;
    ctx.body = { error: '获取艺术家信息失败: ' + error.message };
  }
});

// 测试API连接
router.get('/test-apis', async (ctx) => {
  try {
    const config = await getConfig();
    const results = {};

    // 测试Last.fm
    if (config.enableLastfm && config.lastfmApiKey) {
      try {
        const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
          params: {
            method: 'artist.getinfo',
            api_key: config.lastfmApiKey,
            artist: 'The Beatles',
            format: 'json'
          },
          timeout: 3000
        });
        results.lastfm = {
          status: 'success',
          message: 'Last.fm API连接正常'
        };
      } catch (error) {
        results.lastfm = {
          status: 'error',
          message: 'Last.fm API连接失败: ' + error.message
        };
      }
    } else {
      results.lastfm = {
        status: 'disabled',
        message: 'Last.fm API未启用或缺少API密钥'
      };
    }

    // 测试MusicBrainz
    if (config.enableMusicbrainz) {
      try {
        const response = await axios.get('https://musicbrainz.org/ws/2/artist', {
          params: {
            query: 'The Beatles',
            fmt: 'json',
            limit: 1
          },
          headers: {
            'User-Agent': config.musicbrainzUserAgent || 'NAS-Music-Server/1.0.0'
          },
          timeout: 3000
        });
        results.musicbrainz = {
          status: 'success',
          message: 'MusicBrainz API连接正常'
        };
      } catch (error) {
        results.musicbrainz = {
          status: 'error',
          message: 'MusicBrainz API连接失败: ' + error.message
        };
      }
    } else {
      results.musicbrainz = {
        status: 'disabled',
        message: 'MusicBrainz API未启用'
      };
    }

    // QQ音乐和网易云音乐的测试
    results.qqmusic = {
      status: config.enableQQMusic ? 'not_implemented' : 'disabled',
      message: config.enableQQMusic ? 'QQ音乐API接口待实现' : 'QQ音乐API未启用'
    };

    results.netease = {
      status: config.enableNeteaseMusic ? 'not_implemented' : 'disabled',
      message: config.enableNeteaseMusic ? '网易云音乐API接口待实现' : '网易云音乐API未启用'
    };

    ctx.body = {
      success: true,
      data: results
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: 'API测试失败: ' + error.message };
  }
});

export default router;