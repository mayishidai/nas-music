// 页面组件
export { default as MusicPage } from './Music';
export { default as AlbumsPage } from './Albums';
export { default as ArtistsPage } from './Artists';
export { default as FavoritesPage } from './Favorites';
export { default as RecentlyPlayedPage } from './RecentlyPlayed';
export { default as SettingsPage } from './Settings';

// 新增：专辑详情视图
export { default as AlbumDetailView } from './Albums/AlbumDetail';
export { default as TrackDetailPage } from './tracks/TrackDetail';

// 新增：随机播放页面（重用 TracksView + MusicList 随机模式）
export { default as ShufflePage } from './shuffle/index';

// 新增：音乐详情试图
export { default as ArtistDetailView } from './Artists/ArtistDetail';
