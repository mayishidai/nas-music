import axios from 'axios';

function normalizeText(input) {
  return String(input || '')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildResult({ title, artist, album, year, duration, coverImage, lyrics, sourceId, score = 0 }) {
  return {
    title: title || '',
    artist: artist || '',
    album: album || '',
    year: year || null,
    duration: duration || null,
    coverImage: coverImage || null,
    lyrics: lyrics || '',
    source: 'qqmusic',
    sourceId: sourceId || null,
    score
  };
}

/**
 * 使用 QQ 音乐代理接口进行在线标签搜索
 * @param {Object} opts
 * @param {string} opts.baseUrl - 代理服务基础地址，如 http://localhost:3300
 * @param {string} [opts.apiKey] - 可选：若代理需鉴权
 * @param {string} opts.title - 歌曲名（优先）
 * @param {string} [opts.artist] - 可选歌手名
 * @param {number} [opts.limit=10] - 返回条数
 */
export async function searchQQMusicTags({ baseUrl, apiKey, title, artist, limit = 10 }) {
  if (!baseUrl || !title) return [];
  const base = String(baseUrl).replace(/\/$/, '');
  try {
    const res = await axios.get(`${base}/search`, {
      params: { keyword: title, artist: artist || '', limit },
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      timeout: 10000
    });
    const list = res.data?.data?.list || res.data?.data?.songs || res.data?.songs || [];
    const results = [];
    for (const s of list) {
      const t = s.songname || s.title || '';
      const a = s.singer?.[0]?.name || s.artist || '';
      const al = s.albumname || s.album || '';
      const cover = s.albumpic || s.album?.picUrl || null;
      const sid = s.songmid || s.songid || s.id;
      let lyrics = '';
      try {
        const lyr = await axios.get(`${base}/lyric`, { params: { id: sid }, timeout: 8000 });
        lyrics = lyr.data?.lyric || lyr.data?.lrc || '';
      } catch {}
      const score = (normalizeText(t) === normalizeText(title) ? 1 : 0.6) + (artist && normalizeText(a) === normalizeText(artist) ? 0.4 : 0);
      results.push(buildResult({ title: t, artist: a, album: al, coverImage: cover, lyrics, sourceId: sid, score }));
    }
    return results;
  } catch {
    return [];
  }
}

export default { searchQQMusicTags };


