import React from 'react';
import { MusicList } from '../components/index';
import './Pages.css';

/**
 * 音乐页面组件
 * 展示音乐列表，去掉view-header，优化布局
 */
const MusicPage = ({ 
  stats, 
  searchQuery, 
  onPlay, 
  onAddToPlaylist, 
  onFavorite, 
  onDetails 
}) => {
  return (
    <div className="page-container">
      <div className="page-content">
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

export default MusicPage;
