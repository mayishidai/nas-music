import React from 'react';
import AlbumsView from './AlbumsView';
import '../Pages.css';

/**
 * 专辑页面组件
 */
const AlbumsPage = ({ albums, onAlbumClick }) => {
  return (
    <div className="page-container">
      <div className="page-content">
        <AlbumsView
          albums={albums}
          onAlbumClick={onAlbumClick}
        />
      </div>
    </div>
  );
};

export default AlbumsPage;
