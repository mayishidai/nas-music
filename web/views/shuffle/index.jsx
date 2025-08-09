import React from 'react';
import { MusicList } from '../../components';
import '../Pages.css';

const ShufflePage = ({ searchQuery, onPlay, onAddToPlaylist, onFavorite, onDetails }) => {
  return (
    <div className="page-container">
      <div className="page-content">
        <MusicList
          searchKeyword={searchQuery}
          onPlay={onPlay}
          onAddToPlaylist={onAddToPlaylist}
          onFavorite={onFavorite}
          onDetails={onDetails}
          showCover={true}
          pageSize={10}
          mode="random"
        />
      </div>
    </div>
  );
};

export default ShufflePage;


