// 测试在线音乐缓存功能
const testOnlineMusicCache = async () => {
  console.log('🧪 开始测试在线音乐缓存功能...\n');

  try {
    // 1. 测试在线搜索（应该会缓存结果）
    console.log('1️⃣ 测试在线音乐搜索...');
    const searchResponse = await fetch('/api/online/search/music?title=Hotel California&artist=Eagles');
    const searchResult = await searchResponse.json();
    
    if (searchResult.success) {
      console.log(`✅ 搜索成功，找到 ${searchResult.count} 条结果`);
      console.log(`📊 数据来源: ${searchResult.source}`);
      
      if (searchResult.data && searchResult.data.length > 0) {
        const firstResult = searchResult.data[0];
        console.log(`🎵 第一条结果: ${firstResult.title} - ${firstResult.artist}`);
        console.log(`📀 专辑: ${firstResult.album}`);
        console.log(`⭐ 匹配度: ${firstResult.score}%`);
      }
    } else {
      console.log('❌ 搜索失败:', searchResult.error);
    }

    console.log('\n2️⃣ 测试获取缓存数据...');
    const cachedResponse = await fetch('/api/online/music/cached?page=1&pageSize=10');
    const cachedResult = await cachedResponse.json();
    
    if (cachedResult.success) {
      console.log(`✅ 获取缓存成功，共 ${cachedResult.total} 条记录`);
      console.log(`📄 当前页: ${cachedResult.page}/${cachedResult.pages}`);
      
      if (cachedResult.data && cachedResult.data.length > 0) {
        console.log('📋 缓存记录示例:');
        cachedResult.data.slice(0, 3).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title} - ${item.artist} (${item.album})`);
        });
      }
    } else {
      console.log('❌ 获取缓存失败:', cachedResult.error);
    }

    console.log('\n3️⃣ 测试再次搜索（应该返回缓存数据）...');
    const searchResponse2 = await fetch('/api/online/search/music?title=Hotel California&artist=Eagles&useCache=true');
    const searchResult2 = await searchResponse2.json();
    
    if (searchResult2.success) {
      console.log(`✅ 第二次搜索成功，数据来源: ${searchResult2.source}`);
      if (searchResult2.source === 'cache') {
        console.log('🎉 成功从缓存返回数据！');
      }
    } else {
      console.log('❌ 第二次搜索失败:', searchResult2.error);
    }

    console.log('\n✅ 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
};

// 如果直接运行此脚本
if (typeof window === 'undefined') {
  console.log('请在浏览器控制台中运行此测试');
} else {
  // 在浏览器中运行测试
  testOnlineMusicCache();
}
