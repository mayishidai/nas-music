import database from './src/client/database.js';

// 测试扫描后处理功能
async function testPostScanProcessing() {
  try {
    console.log('开始测试扫描后处理功能...\n');
    
    // 1. 测试为没有封面的专辑获取封面
    console.log('1. 测试为没有封面的专辑获取封面...');
    const albumUpdateCount = await database.updateAlbumsWithoutCover();
    console.log(`专辑封面更新结果: ${albumUpdateCount} 个专辑\n`);
    
    // 2. 测试为没有图片的歌手获取图片
    console.log('2. 测试为没有图片的歌手获取图片...');
    const artistUpdateCount = await database.updateArtistsWithoutPhoto();
    console.log(`歌手图片更新结果: ${artistUpdateCount} 个歌手\n`);
    
    // 3. 测试完整的扫描后处理流程
    console.log('3. 测试完整的扫描后处理流程...');
    const result = await database.postScanProcessing();
    console.log('完整扫描后处理结果:', result);
    
    console.log('\n测试完成！');
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    // 关闭数据库连接
    process.exit(0);
  }
}

// 运行测试
testPostScanProcessing();
