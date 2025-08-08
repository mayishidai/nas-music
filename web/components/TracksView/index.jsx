import React from 'react';
import { MusicList } from '../index';
import './index.css';

/**
 * 音轨视图组件
 * 展示音乐列表，包含标题
 */
const TracksView = ({ 
  stats, 
  searchQuery, 
  onPlay, 
  onAddToPlaylist, 
  onFavorite, 
  onDetails 
}) => {
  return (
    <div className="tracks-view">
      <div className="view-header">
        <h2>🎵 音乐库</h2>
        <div className="stats">
          <span>{stats.tracks || 0} 首歌曲</span>
          <span>{stats.albums || 0} 张专辑</span>
          <span>{stats.artists || 0} 位艺术家</span>
        </div>
      </div>
      
      <div className="view-content">
        <MusicList
          searchQuery={searchQuery}
          onPlay={onPlay}
          onAddToPlaylist={onAddToPlaylist}
          onFavorite={onFavorite}
          onDetails={onDetails}
          showCover={true}
          pageSize={20}
        />
      </div>
    </div>
  );
};

export default TracksView;
