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
