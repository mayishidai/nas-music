import axios from 'axios';
import https from 'https';
import { MusicBrainzApi } from 'musicbrainz-api';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getConfig } from './database.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const execFileAsync = promisify(execFile);

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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

async function computeFingerprintIfPossible(trackPath) {
  if (!trackPath) return null;
  try {
    // 需要系统安装 fpcalc (Chromaprint)
    const { stdout } = await execFileAsync('fpcalc', ['-json', trackPath]);
    const json = JSON.parse(stdout);
    const { fingerprint, duration } = json || {};
    if (fingerprint && duration) return { fingerprint, duration: Math.round(Number(duration)) };
  } catch (e) {
    // 静默忽略
  }
  return null;
}

async function searchMusicBrainz(params, cfg) {
  try {
    const ua = cfg.musicbrainzUserAgent || 'NAS-Music-Server/1.0.0';
    let appName = 'NAS-Music-Server';
    let appVersion = '1.0.0';
    const m = ua.match(/^([^\/]+)\/(.+)$/);
    if (m) { appName = m[1]; appVersion = m[2]; }
    const mb = new MusicBrainzApi({ appName, appVersion });

    const qParts = [];
    if (params.title) qParts.push(`recording:"${params.title}"`);
    if (params.artist) qParts.push(`artist:"${params.artist}"`);
    if (params.album) qParts.push(`release:"${params.album}"`);
    if (!qParts.length && params.query) qParts.push(params.query);
    const query = qParts.join(' AND ');

    const res = await mb.searchRecordings({ query, limit: 10, offset: 0 });
    const recs = res?.recordings || [];
    const results = [];
    for (const r of recs) {
      const title = r.title || '';
      const artist = r['artist-credit']?.[0]?.name || '';
      const release = Array.isArray(r.releases) ? r.releases[0] : null;
      const album = release?.title || '';
      const year = (release?.date || '').slice(0, 4) || null;
      const duration = r.length ? Math.round(r.length / 1000) : null;
      const releaseId = release?.id;
      let coverImage = null;
      if (releaseId) {
        coverImage = `https://coverartarchive.org/release/${releaseId}/front`;
      }
      const score = similarity(params.title || params.query, title) * 0.6 + similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, year, duration, coverImage, source: 'musicbrainz', sourceId: r.id, score }));
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
      let artistImage = null;
      // 获取歌手图片（可选）
      try {
        const artistInfo = await axios.get('https://ws.audioscrobbler.com/2.0/', {
          params: { method: 'artist.getinfo', artist, api_key: apikey, format: 'json' },
          timeout: 8000
        });
        const imgs = artistInfo.data?.artist?.image || [];
        artistImage = imgs[imgs.length - 1]?.['#text'] || null;
      } catch {}
      const score =
        similarity(params.title || params.query, title) * 0.6 +
        similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, coverImage, artistImage, source: 'lastfm', sourceId: t.mbid || null, score }));
    }
    return results;
  } catch {
    return [];
  }
}

async function searchAcoustId(params, cfg) {
  const client = cfg.acoustIdApiKey || cfg.acoustIdClient || '';
  if (!client) return [];
  let fpData = null;
  if (params.fingerprint && params.duration) {
    fpData = { fingerprint: params.fingerprint, duration: params.duration };
  } else if (params.trackPath) {
    fpData = await computeFingerprintIfPossible(params.trackPath);
  }
  if (!fpData) return [];
  try {
    const res = await axios.get('https://api.acoustid.org/v2/lookup', {
      params: {
        client,
        fingerprint: fpData.fingerprint,
        duration: fpData.duration,
        meta: 'recordings+releasegroups'
      },
      timeout: 10000
    });
    const results = [];
    const apiResults = res.data?.results || [];
    for (const r of apiResults) {
      const recordings = r.recordings || [];
      for (const rec of recordings) {
        const title = rec.title || '';
        const artist = rec.artists?.[0]?.name || '';
        const album = rec.releasegroups?.[0]?.title || '';
        const score =
          similarity(params.title || params.query, title) * 0.6 +
          similarity(params.artist || '', artist) * 0.4 + 0.5; // 指纹命中加权
        results.push(buildResult({ title, artist, album, source: 'acoustid', sourceId: rec.id, score }));
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function searchQQMusic(params, cfg) {
  if (!cfg.enableQQMusic || !cfg.qqMusicApiBase) return [];
  try {
    const base = cfg.qqMusicApiBase.replace(/\/$/, '');
    const res = await axios.get(`${base}/search`, {
      params: { keyword: params.title || params.query || '', artist: params.artist || '' },
      timeout: 10000
    });
    const list = res.data?.data?.list || res.data?.data?.songs || res.data?.songs || [];
    const results = [];
    for (const s of list) {
      const title = s.songname || s.title || '';
      const artist = s.singer?.[0]?.name || s.artist || '';
      const album = s.albumname || s.album || '';
      const coverImage = s.albumpic || s.album?.picUrl || null;
      const songId = s.songmid || s.songid || s.id;
      let lyrics = '';
      try {
        const lyr = await axios.get(`${base}/lyric`, { params: { id: songId }, timeout: 8000 });
        lyrics = lyr.data?.lyric || lyr.data?.lrc || '';
      } catch {}
      const score =
        similarity(params.title || params.query, title) * 0.6 +
        similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, coverImage, lyrics, source: 'qqmusic', sourceId: songId, score }));
    }
    return results;
  } catch {
    return [];
  }
}

async function searchNetease(params, cfg) {
  if (!cfg.enableNeteaseMusic || !cfg.neteaseMusicApiBase) return [];
  try {
    const base = cfg.neteaseMusicApiBase.replace(/\/$/, '');
    const res = await axios.get(`${base}/search`, {
      params: { keywords: params.title || params.query || '', limit: 10 },
      timeout: 10000
    });
    const list = res.data?.result?.songs || [];
    const results = [];
    for (const s of list) {
      const title = s.name || '';
      const artist = s.ar?.[0]?.name || '';
      const album = s.al?.name || '';
      const coverImage = s.al?.picUrl || null;
      const songId = s.id;
      let lyrics = '';
      try {
        const lyr = await axios.get(`${base}/lyric`, { params: { id: songId }, timeout: 8000 });
        lyrics = lyr.data?.lrc?.lyric || '';
      } catch {}
      const score =
        similarity(params.title || params.query, title) * 0.6 +
        similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, coverImage, lyrics, source: 'netease', sourceId: songId, score }));
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
  // 根据配置放宽TLS校验（仅对需要的axios请求生效）
  const httpsAgent = cfg.allowInsecureTLS ? new https.Agent({ rejectUnauthorized: false }) : undefined;
  if (httpsAgent) {
    // 为当前模块的 axios 设置默认 agent（不影响全局）
    axios.defaults.httpsAgent = httpsAgent;
  }
  const { query, title, artist, album, filename, fingerprint, duration, trackPath } = params || {};
  const baseParams = { query, title, artist, album, filename, fingerprint, duration, trackPath };
  const [mb, lf, ac, qq, ne] = await Promise.all([
    searchMusicBrainz(baseParams, cfg),
    searchLastfm(baseParams, cfg),
    searchAcoustId(baseParams, cfg),
    searchQQMusic(baseParams, cfg),
    searchNetease(baseParams, cfg)
  ]);
  return mergeAndDedupe([ ...mb, ...lf, ...ac, ...qq, ...ne ]).slice(0, 20);
}

export default {
  searchOnlineTags
};
