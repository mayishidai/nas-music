import online from './src/client/online.js';
import lyrics from './src/plugins/index.js';

// const music = await online.searchMusic('偏偏喜欢你', '陈百强');
// console.log(music[0])

// for (const item of music) {
//     console.log('===============================================')
//     console.log(item.album)
//     const album = await online.getAlbumCover(item.albumId);
//     console.log(album)
//     console.log('===============================================')
// }

// const artist = await online.searchArtist('周杰伦');
// console.log(artist)

const lrc = await lyrics.searchLyrics('中国话', 'S.H.E');
console.log(lrc)