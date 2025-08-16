import { normalizeTextBasic } from './textUtils.js';

// 合并和去重搜索结果
export function mergeAndDedupe(results) {
  const map = new Map();
  for (const r of results) {
    const key = `${normalizeTextBasic(r.title)}|${normalizeTextBasic(r.artist)}|${normalizeTextBasic(r.album)}`;
    if (!map.has(key)) map.set(key, r);
    else {
      const prev = map.get(key);
      // 合并字段，保留更完整/非空数据，分数取较高
      map.set(key, {
        ...prev,
        coverImage: prev.coverImage || r.coverImage || null,
        artistImage: prev.artistImage || r.artistImage || null,
        lyrics: prev.lyrics || r.lyrics || '',
        year: prev.year || r.year || null,
        duration: prev.duration || r.duration || null,
        score: Math.max(prev.score || 0, r.score || 0),
        source: `${prev.source}+${r.source}`
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
}

// 构建搜索结果对象
export function buildResult({
  title,
  artist,
  album,
  year,
  duration,
  coverImage,
  artistImage,
  lyrics,
  source,
  sourceId,
  score = 0
}) {
  return {
    title: title || '',
    artist: artist || '',
    album: album || '',
    year: year || null,
    duration: duration || null,
    coverImage: coverImage || null,
    artistImage: artistImage || null,
    lyrics: lyrics || '',
    source: source || 'unknown',
    sourceId: sourceId || null,
    score
  };
}

// 去重和合并结果
export function deduplicateResults(results) {
  const seen = new Set();
  const unique = [];
  
  for (const result of results) {
    const key = `${result.title}|${result.artist}|${result.album}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    } else {
      // 如果已存在，选择置信度更高的
      const existing = unique.find(r => `${r.title}|${r.artist}|${r.album}` === key);
      if (result.confidence > existing.confidence) {
        const index = unique.indexOf(existing);
        unique[index] = result;
      }
    }
  }
  
  return unique;
}


export const merge = (a={}, b={}) => {
  const fields = Object.keys(a).concat(Object.keys(b));
  const result = {};
  for (const field of fields) {
    result[field] = a[field] || b[field];
  }
  return result;
}



// 根据数组中的指定字段去重，并将指定字段合并
export const mergeAndUnique = (datas=[], union_fields=[], merge_field='') => {
  if (!Array.isArray(datas) || datas.length === 0) {
      return [];
  }
  
  if (!Array.isArray(union_fields) || union_fields.length === 0) {
      return datas;
  }
  
  const result = [];
  const seen = new Map();
  
  for (const item of datas) {
      // 构建用于去重的键
      const key = union_fields.map(field => item[field] || '').join('|');
      
      if (seen.has(key)) {
          // 如果已存在，合并指定字段
          const existingItem = seen.get(key);
          const existingIndex = result.findIndex(r => 
              union_fields.every(field => r[field] === item[field])
          );
          
          if (existingIndex !== -1 && merge_field && item[merge_field]) {
              // 合并指定字段的数据
              if (Array.isArray(item[merge_field])) {
                  // 如果是数组，合并数组并去重
                  const existingArray = result[existingIndex][merge_field] || [];
                  const newArray = item[merge_field] || [];
                  
                  // 合并数组并去重
                  const mergedArray = [...existingArray, ...newArray];
                  const uniqueArray = mergedArray.filter((element, index, self) => {
                      if (typeof element === 'object' && element !== null) {
                          // 对于对象，使用JSON字符串比较
                          return index === self.findIndex(e => 
                              JSON.stringify(e) === JSON.stringify(element)
                          );
                      }
                      return index === self.indexOf(element);
                  });
                  
                  result[existingIndex][merge_field] = uniqueArray;
              } else {
                  // 如果不是数组，保留更长的字符串或更大的数值
                  const existingValue = result[existingIndex][merge_field];
                  if (typeof item[merge_field] === 'string' && typeof existingValue === 'string') {
                      result[existingIndex][merge_field] = item[merge_field].length > existingValue.length 
                          ? item[merge_field] 
                          : existingValue;
                  } else if (typeof item[merge_field] === 'number' && typeof existingValue === 'number') {
                      result[existingIndex][merge_field] = Math.max(item[merge_field], existingValue);
                  }
              }
              
              // 更新分数（保留最高分）
              if (item.score && result[existingIndex].score) {
                  result[existingIndex].score = Math.max(item.score, result[existingIndex].score);
              }
          }
      } else {
          // 如果不存在，添加到结果中
          seen.set(key, item);
          result.push({ ...item });
      }
  }
  
  return result;
}