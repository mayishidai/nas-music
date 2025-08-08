import React from 'react';
import { ArtistsView } from '../components/index';
import './Pages.css';

/**
 * 艺术家页面组件
 */
const ArtistsPage = ({ artists, onArtistClick }) => {
  return (
    <div className="page-container">
      <div className="page-content">
        <ArtistsView
          artists={artists}
          onArtistClick={onArtistClick}
        />
      </div>
    </div>
  );
};

export default ArtistsPage;
