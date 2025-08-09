import React, { useEffect, useMemo, useState } from 'react';
import '../Pages.css';
import './Favorites.css';
import { MusicList } from '../../components';

/**
 * 收藏页面组件
 */
const FavoritesPage = ({ onPlay, onAddToPlaylist }) => {
  const [search, setSearch] = useState('');
  return (
    <div className="page-container">
      <div className="page-content">
        <div className="fav-toolbar">
          <h2>⭐ 我的收藏</h2>
          <div className="fav-actions">
            <input
              className="fav-search"
              placeholder="搜索收藏..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <MusicList
          searchKeyword={search}
          onPlay={onPlay}
          onAddToPlaylist={onAddToPlaylist}
          filters={{ favorite: true }}
        />
      </div>
    </div>
  );
};

export default FavoritesPage;
