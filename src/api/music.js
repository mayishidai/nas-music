import Router from 'koa-router';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import NodeID3 from 'node-id3';
import { 
  getAllTracks, 
  findTrackById, 
  updateTrack, 
  getFavoriteTracks, 
  getAlbums, 
  getArtists, 
  findAlbumById, 
  findArtistById, 
  getTracksByAlbum,
  getRecentlyPlayedTracks,
  updateArtistInfo,
  getArtistDetails,
  updateMediaLibraryStats,
} from '../client/database.js';

// 读取音乐文件标签
async function readMusicTags(filePath) {
  try {
    const tags = NodeID3.read(filePath);
    return tags || {};
  } catch (error) {
    console.error('读取音乐标签失败:', error);
    return {};
  }
}

// 写入音乐文件标签
async function writeMusicTags(filePath, metadata) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.mp3') {
      // 处理MP3文件
      const existingTags = await readMusicTags(filePath);
      const tags = { ...existingTags };
      
      // 更新基本标签
      if (metadata.title) tags.title = metadata.title;
      if (metadata.artist) tags.artist = metadata.artist;
      if (metadata.album) tags.album = metadata.album;
      if (metadata.year) tags.year = metadata.year.toString();
      if (metadata.lyrics) {
        tags.unsynchronisedLyrics = {
          language: 'eng',
          text: metadata.lyrics
        };
      }
      
      // 如果有封面图片，添加封面
      if (metadata.coverImage && metadata.coverImage.startsWith('data:image/')) {
        try {
          const base64Data = metadata.coverImage.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const format = metadata.coverImage.match(/data:image\/([^;]+)/)?.[1] || 'jpeg';
          
          tags.image = {
            imageBuffer,
            type: {
              id: 3,
              name: 'front cover'
            },
            mime: `image/${format}`
          };
        } catch (error) {
          console.error('处理封面图片失败:', error);
        }
      }
      
      const success = NodeID3.write(tags, filePath);
      if (success) {
        console.log(`已更新MP3标签: ${filePath}`);
        return true;
      } else {
        throw new Error('写入MP3标签失败');
      }
    } else if (ext === '.flac') {
      // 处理FLAC文件
      const existingTags = await readMusicTags(filePath);
      const tags = { ...existingTags };
      
      // 更新基本标签
      if (metadata.title) tags.TITLE = metadata.title;
      if (metadata.artist) tags.ARTIST = metadata.artist;
      if (metadata.album) tags.ALBUM = metadata.album;
      if (metadata.year) tags.DATE = metadata.year.toString();
      if (metadata.lyrics) tags.LYRICS = metadata.lyrics;
      
      // 如果有封面图片，添加封面
      if (metadata.coverImage && metadata.coverImage.startsWith('data:image/')) {
        try {
          const base64Data = metadata.coverImage.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const format = metadata.coverImage.match(/data:image\/([^;]+)/)?.[1] || 'jpeg';
          
          tags.PICTURE = [{
            imageBuffer,
            type: {
              id: 3,
              name: 'front cover'
            },
            mime: `image/${format}`
          }];
        } catch (error) {
          console.error('处理封面图片失败:', error);
        }
      }
      
      const success = NodeID3.write(tags, filePath);
      if (success) {
        console.log(`已更新FLAC标签: ${filePath}`);
        return true;
      } else {
        throw new Error('写入FLAC标签失败');
      }
    } else if (ext === '.m4a' || ext === '.aac') {
      // 处理M4A/AAC文件
      const existingTags = await readMusicTags(filePath);
      const tags = { ...existingTags };
      
      // 更新基本标签
      if (metadata.title) tags.title = metadata.title;
      if (metadata.artist) tags.artist = metadata.artist;
      if (metadata.album) tags.album = metadata.album;
      if (metadata.year) tags.year = metadata.year.toString();
      if (metadata.lyrics) tags.lyrics = metadata.lyrics;
      
      // 如果有封面图片，添加封面
      if (metadata.coverImage && metadata.coverImage.startsWith('data:image/')) {
        try {
          const base64Data = metadata.coverImage.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const format = metadata.coverImage.match(/data:image\/([^;]+)/)?.[1] || 'jpeg';
          
          tags.image = {
            imageBuffer,
            type: {
              id: 3,
              name: 'front cover'
            },
            mime: `image/${format}`
          };
        } catch (error) {
          console.error('处理封面图片失败:', error);
        }
      }
      
      const success = NodeID3.write(tags, filePath);
      if (success) {
        console.log(`已更新M4A/AAC标签: ${filePath}`);
        return true;
      } else {
        throw new Error('写入M4A/AAC标签失败');
      }
    } else {
      // 其他格式暂时跳过
      console.log(`跳过标签写入，不支持的文件格式: ${ext}`);
      return false;
    }
  } catch (error) {
    console.error('写入音乐标签失败:', error);
    return false;
  }
}

const router = new Router();

 // 获取所有音乐
 router.get('/tracks', async (ctx) => {
   try {
     const { page = 1, pageSize = 10, sort = 'title', order = 'asc', search = '', filter } = ctx.query;
     const filterObj = filter ? JSON.parse(filter) : {};
     const data = getAllTracks({ page: parseInt(page), pageSize: parseInt(pageSize), sort, order, search, filter: filterObj });
     ctx.body = { success: true, ...data }
   } catch (error) {
     console.error('获取音乐列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取音乐列表失败' };
   }
 });

// 获取单条音乐详情
router.get('/tracks/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const track = await findTrackById(id);
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    ctx.body = { success: true, data: track };
  } catch (error) {
    console.error('获取音乐详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取音乐详情失败' };
  }
});

// 收藏/取消收藏
router.put('/tracks/:id/favorite', async (ctx) => {
  try {
    const { id } = ctx.params;
    const { favorite } = ctx.request.body;
    const track = await findTrackById(id);
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    await updateTrack(id, { favorite: favorite ? 1 : 0 });
    ctx.body = { success: true, data: { favorite: favorite ? 1 : 0 } };
  } catch (error) {
    console.error('更新收藏状态失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '更新收藏状态失败' };
  }
});

 // 收藏列表
 router.get('/favorites', async (ctx) => {
   try {
     const { page = 1, pageSize = 10, sort = 'title', order = 'asc', search = '' } = ctx.query;
     const result = await getFavoriteTracks({ page: parseInt(page), pageSize: parseInt(pageSize), sort, order, search });
     ctx.body = { success: true, ...result };
   } catch (error) {
     console.error('获取收藏列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取收藏列表失败' };
   }
 });

 // 获取专辑列表
 router.get('/albums', async (ctx) => {
   try {
     const { query, page = 1, pageSize = 10, sort = 'title', order = 'asc' } = ctx.query;
     const result = await getAlbums({ query, page: parseInt(page), pageSize: parseInt(pageSize), sort,  order });
     ctx.body = { success: true, ...result };
   } catch (error) {
     console.error('获取专辑列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取专辑列表失败' };
   }
 });

 // 获取艺术家列表
 router.get('/artists', async (ctx) => {
   try {
     const { query, page = 1, pageSize = 10, sort = 'name', order = 'asc' } = ctx.query;
     const result = await getArtists({ query, page: parseInt(page), pageSize: parseInt(pageSize), sort, order });
     ctx.body = { success: true, ...result };
   } catch (error) {
     console.error('获取艺术家列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取艺术家列表失败' };
   }
 });

// 获取专辑详情
router.get('/albums/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const album = await findAlbumById(id);
    if (!album) {
      ctx.status = 404;
      ctx.body = { success: false, error: '专辑不存在' };
      return;
    }
    const tracks = await getTracksByAlbum(id);
    ctx.body = { success: true, data: { ...album, tracks } };
  } catch (error) {
    console.error('获取专辑详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取专辑详情失败' };
  }
});

// 获取艺术家详情
router.get('/artists/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const artist = await findArtistById(id);
    if (!artist) {
      ctx.status = 404;
      ctx.body = { success: false, error: '艺术家不存在' };
      return;
    }
    ctx.body = {  success: true, data:artist };
  } catch (error) {
    console.error('获取艺术家详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取艺术家详情失败' };
  }
});

// 更新艺术家信息
router.put('/artists/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const artistInfo = ctx.request.body;
    // 验证艺术家是否存在
    const existingArtist = await findArtistById(id);
    if (!existingArtist) {
      ctx.status = 404;
      ctx.body = { success: false, error: '艺术家不存在' };
      return;
    }
    // 更新艺术家信息
    const success = await updateArtistInfo(id, artistInfo);
    if (success) {
      // 获取更新后的艺术家信息
      const updatedArtist = await getArtistDetails(id);
      ctx.body = { 
        success: true, 
        data: updatedArtist,
        message: '艺术家信息更新成功'
      };
    } else {
      ctx.status = 500;
      ctx.body = { success: false, error: '更新艺术家信息失败' };
    }
  } catch (error) {
    console.error('更新艺术家信息失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '更新艺术家信息失败' };
  }
});

// 流式播放音乐
router.get('/stream/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const track = await findTrackById(id);
    
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    // 检查文件是否存在
    try {
      await fs.access(track.path);
    } catch (error) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐文件不存在' };
      return;
    }
    
    const stat = await fs.stat(track.path);
    const fileSize = stat.size;
    const range = ctx.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      ctx.status = 206;
      ctx.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg'
      });
      const stream = createReadStream(track.path, { start, end });
      ctx.body = stream;
    } else {
      ctx.set({
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes'
      });
      
      const stream = createReadStream(track.path);
      ctx.body = stream;
    }
  } catch (error) {
    console.error('流式播放失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '流式播放失败' };
  }
});

// 保存音乐详情（包括更新metadata和统计信息）
router.put('/tracks/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const { title, artist, album, year, lyrics, coverImage } = ctx.request.body;
    
    const track = await findTrackById(id);
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }

    // 1. 更新数据库中的音乐详情
    const updateData = {
      title: title || track.title,
      artist: artist || track.artist,
      album: album || track.album,
      year: year || track.year,
      lyrics: lyrics || track.lyrics
    };

    // 如果有新的封面图片，保存为base64格式
    if (coverImage && coverImage !== track.coverImage) {
      // 验证base64格式
      if (coverImage.startsWith('data:image/')) {
        updateData.coverImage = coverImage;
        console.log('保存base64格式的封面图片');
      } else {
        console.warn('封面图片格式不正确，跳过保存');
      }
    }

    const updateResult = await updateTrack(id, updateData);
    if (!updateResult) {
      ctx.status = 500;
      ctx.body = { success: false, error: '更新数据库失败' };
      return;
    }

    // 2. 更新音乐文件的metadata
    try {
      if (track.path && await fs.access(track.path).then(() => true).catch(() => false)) {
        const metadataToWrite = {
          title: updateData.title,
          artist: updateData.artist,
          album: updateData.album,
          year: updateData.year,
          lyrics: updateData.lyrics,
          coverImage: updateData.coverImage
        };
        
        const writeSuccess = await writeMusicTags(track.path, metadataToWrite);
        if (writeSuccess) {
          console.log(`已更新音乐文件metadata: ${track.path}`);
        } else {
          console.warn(`音乐文件metadata更新失败: ${track.path}`);
        }
      }
    } catch (metadataError) {
      console.error('更新音乐文件metadata失败:', metadataError);
      // 不阻止整个保存过程，只记录错误
    }
    const updatedTrack = await findTrackById(id);
    ctx.body = { 
      success: true, 
      data: updatedTrack,
      message: '保存成功！已更新音乐详情、文件metadata和音乐库统计信息。封面图片已保存为base64格式。'
    };
  } catch (error) {
    console.error('保存音乐详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '保存音乐详情失败' };
  }
});

// 记录最近播放
router.post('/recently-played/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const track = await findTrackById(id);
    
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    // 更新播放次数和最后播放时间
    await updateTrack(id, {
      playCount: (track.playCount || 0) + 1,
      lastPlayed: new Date().toISOString()
    });
    
    ctx.body = { success: true };
  } catch (error) {
    console.error('记录最近播放失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '记录最近播放失败' };
  }
});

 // 获取最近播放（按记录顺序返回，支持分页）
 router.get('/recently-played', async (ctx) => {
   try {
    const { search, page = 1, pageSize = 10, sort = 'name', order = 'asc' } = ctx.query;
     const result = await getRecentlyPlayedTracks({ search, page: parseInt(page), pageSize: parseInt(pageSize), sort, order });
     ctx.body = { success: true, ...result };
   } catch (error) {
     console.error('获取最近播放失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取最近播放失败' };
   }
 });

export default router;