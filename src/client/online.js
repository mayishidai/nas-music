import axios from 'axios';
import { MusicBrainzApi } from 'musicbrainz-api';
import { getConfig } from './database.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 主搜索函数
export async function searchMusic(title, artist) {}

// 在线获取专辑信息
export async function searchAlbum(album, artist) {}

// 在线检索歌手信息
export async function searchArtist(artistName) {}

export default {
  searchMusic,
  searchAlbum,
  searchArtist,
};
