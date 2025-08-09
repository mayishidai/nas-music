import axios from 'axios';
import { tradToSimple as toSimplified } from 'simptrad'
import { MusicBrainzApi } from 'musicbrainz-api';
import { getConfig, musicDB } from './database.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function normalizeText(input) {
  return String(input || '')
    // 去除控制字符
    .replace(/[\u0000-\u001F]/g, ' ')
    // 全角转半角
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripDecorations(name) {
  if (!name) return '';
  let n = name;
  // 去扩展名
  n = n.replace(/\.[a-z0-9]{2,5}$/i, '');
  // 去括号与方括号、花括号内容
  n = n.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\{[^}]*\}/g, ' ');
  // 去常见标注词
  n = n.replace(/\b(320kbps|128kbps|flac|ape|mp3|wav|aac|ogg|m4a|wma|mv|live|hq|dj|remix|ost|original|official|lyrics?)\b/gi, ' ');
  // 去前导音轨号
  n = n.replace(/^\s*\d{1,2}\s*[-_.]\s*/, ' ');
  // 中文附加词
  n = n.replace(/(官方版|纯音乐|伴奏|现场版|无损|高品质|原声|原曲|铃声)/g, ' ');
  // 分隔符
  n = n.replace(/[\-_]+/g, ' ');
  return normalizeText(n);
}

function getBaseNameFromPath(filePath) {
  if (!filePath) return '';
  const norm = String(filePath).replace(/\\/g, '/');
  const last = norm.lastIndexOf('/');
  return last >= 0 ? norm.slice(last + 1) : norm;
}

function splitArtistTitle(cleanName) {
  const parts = cleanName.split(' - ').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    return { left: parts[0], right: parts[1] };
  }
  return { left: '', right: cleanName };
}

function isGarbled(text) {
  if (!text) return false;
  const s = String(text);
  let weird = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    const isAsciiWord = (code >= 48 && code <= 57) || (code >= 97 && code <= 122) || code === 32;
    const isCJK = (code >= 0x4e00 && code <= 0x9fff);
    if (!isAsciiWord && !isCJK) weird++;
  }
  return weird / s.length > 0.35;
}

function tryFixEncoding(text) {
  if (!text) return '';
  const s = String(text);
  if (!isGarbled(s)) return s;
  try {
    const buf = Buffer.from(s, 'binary');
    return buf.toString('utf8');
  } catch {
    return s;
  }
}

function jaccardTokens(a, b) {
  const as = new Set(normalizeText(a).split(' ').filter(Boolean));
  const bs = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (as.size === 0 || bs.size === 0) return 0;
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter++;
  return inter / (as.size + bs.size - inter);
}

function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const na = stripDecorations(a);
  const nb = stripDecorations(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return jaccardTokens(na, nb);
}

function artistSimilarity(a, b) {
  if (!a || !b) return 0;
  return jaccardTokens(a, b);
}

function yearSimilarity(a, b) {
  const ya = parseInt(a, 10);
  const yb = parseInt(b, 10);
  if (!ya || !yb) return 0;
  if (Math.abs(ya - yb) <= 1) return 1;
  if (Math.abs(ya - yb) <= 2) return 0.7;
  return 0;
}

function durationSimilarity(a, b) {
  const da = Number(a);
  const db = Number(b);
  if (!da || !db) return 0;
  const diff = Math.abs(da - db);
  if (diff <= 2) return 1;
  if (diff <= 5) return 0.8;
  if (diff <= 10) return 0.6;
  if (diff <= 20) return 0.3;
  return 0;
}

function computeMatchScore(result, origin) {
  const titleScore = titleSimilarity(tryFixEncoding(result.title), origin.title) * 0.5;
  const artistScore = artistSimilarity(tryFixEncoding(result.artist), origin.artist) * 0.3;
  const albumScore = artistSimilarity(tryFixEncoding(result.album), origin.album) * 0.05;
  const yearScore = yearSimilarity(result.year, origin.year) * 0.05;
  const durationScore = durationSimilarity(result.duration, origin.duration) * 0.1;
  return Number((titleScore + artistScore + albumScore + yearScore + durationScore).toFixed(4));
}

function inferBestQuery({ filename, trackPath, title, artist, album }) {
  const baseName = stripDecorations(getBaseNameFromPath(filename || trackPath || ''));
  const tagsTitle = stripDecorations(title || '');
  const tagsArtist = stripDecorations(artist || '');
  const { left, right } = splitArtistTitle(baseName);
  const candidates = [];
  if (right) candidates.push({ t: right, a: left });
  if (baseName) candidates.push({ t: baseName, a: '' });
  if (tagsTitle) candidates.push({ t: tagsTitle, a: tagsArtist });
  const scored = candidates
    .map((c) => ({
      ...c,
      score: titleSimilarity(c.t, tagsTitle || baseName) * 0.6 + artistSimilarity(c.a, tagsArtist) * 0.4
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const best = scored[0] || { t: tagsTitle || baseName, a: tagsArtist };
  const confident = (best.score || 0) >= 0.5;
  return {
    queryTitle: best.t || tagsTitle || baseName,
    queryArtist: confident ? (best.a || tagsArtist) : '',
    confidence: best.score || 0
  };
}

function similarity(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // 简化的包含度评分
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  return 0;
}

function buildResult({
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

async function searchMusicBrainz(params, cfg) {
  try {
    const ua = cfg.musicbrainzUserAgent || 'NAS-Music-Server/1.0.0';
    let appName = 'NAS-Music-Server';
    let appVersion = '1.0.0';
    const m = ua.match(/^([^\/]+)\/(.+)$/);
    if (m) { appName = m[1]; appVersion = m[2]; }
    const mb = new MusicBrainzApi({ appName, appVersion });
    const res = await mb.search('recording', { query: `recording:"${params.title}"` }, 0, 10);
    const recs = res?.recordings || [];
    const results = [];
    for (const r of recs) {
      const title = r.title || '';
      const artist = r['artist-credit']?.[0]?.name || '';
      const release = Array.isArray(r.releases) ? r.releases[0] : null;
      const album = release?.title || '';
      const year = (release?.date || '').slice(0, 4) || null;
      const duration = r.length ? Math.round(r.length / 1000) : null;
      const score = similarity(params.title || params.query, title) * 0.6 + similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, year, duration, source: 'musicbrainz', sourceId: r.id, score }));
    }
    return results;
  } catch (e) {
    return [];
  }
}

async function searchLastfm(params, cfg) {
  if (!cfg.enableLastfm || !cfg.lastfmApiKey) return [];
  try {
    const apikey = cfg.lastfmApiKey;
    const res = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.search',
        track: params.title || params.query || '',
        artist: params.artist || '',
        api_key: apikey,
        format: 'json',
        limit: 10
      },
      timeout: 8000
    });
    const tracks = res.data?.results?.trackmatches?.track || [];
    const results = [];
    for (const t of tracks) {
      const title = t.name;
      const artist = t.artist;
      const album = '';
      const coverImage = Array.isArray(t.image) ? (t.image[3]?.['#text'] || t.image[2]?.['#text'] || null) : null;
      const score = similarity(params.title || params.query, title) * 0.6 + similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, coverImage, source: 'lastfm', sourceId: t.mbid || null, score }));
    }
    return results;
  } catch {
    return [];
  }
}

function mergeAndDedupe(results) {
  const map = new Map();
  for (const r of results) {
    const key = `${normalizeText(r.title)}|${normalizeText(r.artist)}|${normalizeText(r.album)}`;
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

export async function searchOnlineTags(params) {
  const cfg = await getConfig();
  const { query, title, artist, album, filename, duration, trackPath } = params || {};
  // 输入先做简体化
  const sQuery = toSimplified(query || '');
  const sTitle = toSimplified(title || '');
  const sArtist = toSimplified(artist || '');
  const sAlbum = toSimplified(album || '');
  const sFilename = toSimplified(filename || '');
  const sTrackPath = toSimplified(trackPath || '');
  // 推断最可能的标题/歌手（基于路径/文件名/已有标签）
  const inferred = inferBestQuery({ filename: sFilename, trackPath: sTrackPath, title: sTitle, artist: sArtist, album: sAlbum });
  const origin = {
    title: sTitle || inferred.queryTitle || sQuery || '',
    artist: sArtist || inferred.queryArtist || '',
    album: sAlbum || '',
    duration: duration || null,
    year: null
  };
  // 使用推断出的标题进行检索
  const baseParams = {
    query: sQuery || `${inferred.queryTitle || ''}`.trim(),
    title: inferred.queryTitle || sTitle || '',
    artist: inferred.queryArtist || ''
  };
  const [mb, lf] = await Promise.all([
    searchMusicBrainz(baseParams, cfg),
    searchLastfm(baseParams, cfg)
  ]);
  // 输出字段也做简体化
  const simplifyResult = async (r) => ({
    ...r,
    title: toSimplified(r.title),
    artist: toSimplified(r.artist),
    album: toSimplified(r.album)
  });
  const mergedRaw = mergeAndDedupe([ ...mb, ...lf ]);
  const merged = await Promise.all(mergedRaw.map(simplifyResult));
  // 基于原信息重算匹配得分并排序
  const rescored = merged
    .map((r) => ({ ...r, score: computeMatchScore(r, origin) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  return rescored.slice(0, 20);
}

// ========== 额外信息获取：封面 ==========
export async function fetchCoverImageByReleaseId(releaseId) {
  if (!releaseId) return null;
  // 优先从 Cover Art Archive JSON 获取直链
  try {
    const caa = await axios.get(`https://coverartarchive.org/release/${releaseId}`);
    const images = Array.isArray(caa.data?.images) ? caa.data.images : [];
    if (images.length > 0) {
      const front = images.find((img) => img?.front) || images[0];
      if (front?.image) return front.image;
    }
  } catch {}
  // 回落：尝试通过 release -> release-group 再取封面
  try {
    const mb = await axios.get(`https://musicbrainz.org/ws/2/release/${releaseId}`, { params: { fmt: 'json' } });
    const rgid = mb.data?.["release-group"]?.id;
    if (rgid) {
      const caaRg = await axios.get(`https://coverartarchive.org/release-group/${rgid}`);
      const images = Array.isArray(caaRg.data?.images) ? caaRg.data.images : [];
      if (images.length > 0) {
        const front = images.find((img) => img?.front) || images[0];
        if (front?.image) return front.image;
      }
    }
  } catch {}
  // 最后回退到标准 front 路径（可能部分可用）
  return `https://coverartarchive.org/release/${releaseId}/front`;
}

export async function fetchCoverImageByTrackInfo({ title, artist }) {
  try {
    const titleRegex = title ? new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const artistRegex = artist ? new RegExp(artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const doc = await new Promise((resolve) => {
      const selector = { type: 'track' };
      if (titleRegex) selector.title = titleRegex;
      if (artistRegex) selector.artist = artistRegex;
      musicDB.findOne(selector, (err, d) => resolve(err ? null : d));
    });
    return doc?.coverImage || null;
  } catch {
    return null;
  }
}

// ========== 额外信息获取：歌词 ==========
export async function fetchLyricsByTrackInfo({ title, artist }) {
  try {
    const titleRegex = title ? new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const artistRegex = artist ? new RegExp(artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const doc = await new Promise((resolve) => {
      const selector = { type: 'track' };
      if (titleRegex) selector.title = titleRegex;
      if (artistRegex) selector.artist = artistRegex;
      musicDB.findOne(selector, (err, d) => resolve(err ? null : d));
    });
    const text = doc?.lyrics || '';
    return toSimplified(text || '');
  } catch {
    return '';
  }
}

export default {
  searchOnlineTags
};
