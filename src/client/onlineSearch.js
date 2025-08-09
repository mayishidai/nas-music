import axios from 'axios';
import https from 'https';
import { MusicBrainzApi } from 'musicbrainz-api';
import { getConfig } from './database.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
    if (!qParts.length && params.query) qParts.push(params.query);
    const query = qParts.join(' AND ');

    const res = await mb.search('recording', { query }, 0, 10);
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
  const { query, title, artist, album, filename, fingerprint, duration, trackPath } = params || {};
  const baseParams = { query, title, artist, album, filename, fingerprint, duration, trackPath };
  const [mb, lf] = await Promise.all([
    searchMusicBrainz(baseParams, cfg),
    searchLastfm(baseParams, cfg)
  ]);
  return mergeAndDedupe([ ...mb, ...lf ]).slice(0, 20);
}

export default {
  searchOnlineTags
};
