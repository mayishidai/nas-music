/**
 * 音乐服务更新示例
 * 展示如何将音乐图片存储到数据库中，并修改相关接口
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

/**
 * 扫描音乐时提取并存储封面图片
 * @param {Object} track - 音乐信息
 * @param {string} filePath - 音乐文件路径
 */
async function extractAndStoreCoverImage(track, filePath) {
  try {
    // 使用 music-metadata 库提取封面
    const { parseFile } = require('music-metadata');
    const metadata = await parseFile(filePath);
    
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];
      
      // 将图片数据转换为 Base64 字符串
      const base64Image = picture.data.toString('base64');
      const mimeType = picture.format;
      
      // 存储到数据库
      const coverImage = {
        data: base64Image,
        format: mimeType,
        size: picture.data.length
      };
      
      // 更新音乐记录
      await updateTrackCoverImage(track._id, coverImage);
      
      console.log(`已提取并存储封面图片: ${track.title}`);
    } else {
      // 如果没有封面，生成默认封面
      const defaultCover = await generateDefaultCover(track);
      await updateTrackCoverImage(track._id, defaultCover);
      
      console.log(`已生成默认封面: ${track.title}`);
    }
  } catch (error) {
    console.error(`提取封面失败: ${track.title}`, error);
    
    // 出错时也生成默认封面
    const defaultCover = await generateDefaultCover(track);
    await updateTrackCoverImage(track._id, defaultCover);
  }
}

/**
 * 使用AI生成默认封面图片
 * @param {Object} track - 音乐信息
 * @returns {Object} 默认封面图片对象
 */
async function generateDefaultCover(track) {
  try {
    // 这里可以集成AI服务来生成封面
    // 例如：使用 OpenAI DALL-E、Stable Diffusion 等
    
    // 示例：使用简单的SVG生成
    const svgContent = generateSVGCover(track);
    const base64Image = Buffer.from(svgContent).toString('base64');
    
    return {
      data: base64Image,
      format: 'image/svg+xml',
      size: svgContent.length,
      isDefault: true
    };
  } catch (error) {
    console.error('生成默认封面失败:', error);
    
    // 返回一个简单的默认SVG
    const defaultSVG = `
      <svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="300" fill="#1a1a2e"/>
        <circle cx="150" cy="150" r="80" fill="#4ecdc4" opacity="0.3"/>
        <path d="M120 100 L180 150 L120 200 Z" fill="#ff6b6b"/>
        <text x="150" y="250" text-anchor="middle" fill="#fff" font-family="Arial" font-size="14">
          ${track.title || 'Music'}
        </text>
      </svg>
    `;
    
    return {
      data: Buffer.from(defaultSVG).toString('base64'),
      format: 'image/svg+xml',
      size: defaultSVG.length,
      isDefault: true
    };
  }
}

/**
 * 生成SVG封面
 * @param {Object} track - 音乐信息
 * @returns {string} SVG内容
 */
function generateSVGCover(track) {
  const title = track.title || 'Unknown';
  const artist = track.artist || 'Unknown Artist';
  const album = track.album || 'Unknown Album';
  
  // 生成渐变颜色
  const colors = [
    ['#ff6b6b', '#4ecdc4'],
    ['#a8edea', '#fed6e3'],
    ['#ffecd2', '#fcb69f'],
    ['#ff9a9e', '#fecfef'],
    ['#a8caba', '#5d4e75']
  ];
  
  const colorPair = colors[Math.floor(Math.random() * colors.length)];
  
  return `
    <svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorPair[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colorPair[1]};stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <rect width="300" height="300" fill="url(#grad1)"/>
      
      <!-- 装饰性圆圈 -->
      <circle cx="50" cy="50" r="20" fill="rgba(255,255,255,0.1)"/>
      <circle cx="250" cy="80" r="15" fill="rgba(255,255,255,0.1)"/>
      <circle cx="80" cy="250" r="25" fill="rgba(255,255,255,0.1)"/>
      
      <!-- 播放按钮 -->
      <circle cx="150" cy="150" r="40" fill="rgba(255,255,255,0.2)"/>
      <path d="M135 130 L175 150 L135 170 Z" fill="rgba(255,255,255,0.8)"/>
      
      <!-- 文本 -->
      <text x="150" y="220" text-anchor="middle" fill="rgba(255,255,255,0.9)" 
            font-family="Arial, sans-serif" font-size="12" font-weight="bold">
        ${title}
      </text>
      <text x="150" y="235" text-anchor="middle" fill="rgba(255,255,255,0.7)" 
            font-family="Arial, sans-serif" font-size="10">
        ${artist}
      </text>
      <text x="150" y="250" text-anchor="middle" fill="rgba(255,255,255,0.6)" 
            font-family="Arial, sans-serif" font-size="9">
        ${album}
      </text>
    </svg>
  `;
}

/**
 * 更新音乐记录的封面图片
 * @param {string} trackId - 音乐ID
 * @param {Object} coverImage - 封面图片对象
 */
async function updateTrackCoverImage(trackId, coverImage) {
  try {
    // 这里应该调用数据库更新方法
    // 例如：await Track.findByIdAndUpdate(trackId, { coverImage });
    
    console.log(`已更新音乐封面: ${trackId}`);
  } catch (error) {
    console.error(`更新音乐封面失败: ${trackId}`, error);
  }
}

/**
 * 修改音乐查询接口，返回封面图片数据
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
async function getTracks(req, res) {
  try {
    const { page = 1, limit = 20, sort = 'title', order = 'asc', search = '' } = req.query;
    
    // 构建查询条件
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } },
        { album: { $regex: search, $options: 'i' } }
      ];
    }
    
    // 执行查询
    const tracks = await Track.find(query)
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-coverImage.data') // 不返回图片数据，只返回基本信息
      .lean();
    
    // 获取总数
    const total = await Track.countDocuments(query);
    
    // 计算分页信息
    const pages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: tracks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    });
  } catch (error) {
    console.error('获取音乐列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取音乐列表失败'
    });
  }
}

/**
 * 获取音乐封面图片
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
async function getTrackCover(req, res) {
  try {
    const { id } = req.params;
    
    // 从数据库获取封面图片
    const track = await Track.findById(id).select('coverImage').lean();
    
    if (!track || !track.coverImage) {
      // 如果没有封面，返回默认封面
      const defaultCover = generateDefaultCover({ title: 'Unknown' });
      const imageBuffer = Buffer.from(defaultCover.data, 'base64');
      
      res.setHeader('Content-Type', defaultCover.format);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(imageBuffer);
      return;
    }
    
    // 返回存储的封面图片
    const imageBuffer = Buffer.from(track.coverImage.data, 'base64');
    
    res.setHeader('Content-Type', track.coverImage.format);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(imageBuffer);
  } catch (error) {
    console.error('获取音乐封面失败:', error);
    res.status(500).json({
      success: false,
      error: '获取音乐封面失败'
    });
  }
}

/**
 * 扫描音乐库时调用
 * @param {string} musicDir - 音乐目录路径
 */
async function scanMusicLibrary(musicDir) {
  try {
    console.log('开始扫描音乐库...');
    
    const files = await getAllMusicFiles(musicDir);
    
    for (const filePath of files) {
      try {
        // 解析音乐文件
        const track = await parseMusicFile(filePath);
        
        // 保存音乐信息到数据库
        const savedTrack = await saveTrackToDatabase(track);
        
        // 提取并存储封面图片
        await extractAndStoreCoverImage(savedTrack, filePath);
        
        console.log(`已处理: ${track.title}`);
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error);
      }
    }
    
    console.log('音乐库扫描完成！');
  } catch (error) {
    console.error('扫描音乐库失败:', error);
  }
}

// 导出函数
module.exports = {
  extractAndStoreCoverImage,
  generateDefaultCover,
  updateTrackCoverImage,
  getTracks,
  getTrackCover,
  scanMusicLibrary
};
