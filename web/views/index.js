// 页面组件
export { default as MusicPage } from './Music';
export { default as AlbumsPage } from './Albums';
export { default as ArtistsPage } from './Artists';
export { default as FavoritesPage } from './Favorites';
export { default as RecentlyPlayedPage } from './RecentlyPlayed';
export { default as SettingsPage } from './Settings';

// View组件
export { default as TracksView } from './Music/TracksView';
export { default as AlbumsView } from './Albums/AlbumsView';
export { default as ArtistsView } from './Artists/ArtistsView';
// 移除流派页面相关导出
// export { default as GenresView } from './Genres/GenresView';

// 新增：专辑详情视图
export { default as AlbumDetailView } from './Albums/AlbumDetail';
export { default as TrackDetailPage } from './tracks/TrackDetail';

// 新增：随机播放页面（重用 TracksView + MusicList 随机模式）
export { default as ShufflePage } from './shuffle/index';
