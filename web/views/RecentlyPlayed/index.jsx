import React, { useState } from 'react';
import '../Pages.css';
import { MusicList } from '../../components';

/**
 * 最近播放页面组件
 */
const RecentlyPlayedPage = ({ onPlay, onAddToPlaylist }) => {
  const [search, setSearch] = useState('');
  return (
    <div className="page-container">
      <div className="page-content">
        <div className="fav-toolbar" style={{ marginBottom: 12 }}>
          <h2>🕒 最近播放</h2>
          <div className="fav-actions">
            <input
              className="fav-search"
              placeholder="搜索最近播放..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <MusicList
          searchKeyword={search}
          onPlay={onPlay}
          onAddToPlaylist={onAddToPlaylist}
          onFavorite={async (t) => {
            try {
              await fetch(`/api/music/tracks/${t._id || t.id}/favorite`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorite: !t.favorite })
              });
            } catch (e) {}
          }}
          mode="recent"
        />
      </div>
    </div>
  );
};

export default RecentlyPlayedPage;
