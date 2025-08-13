import React, { useState } from 'react';
import '../Pages.css';
import './RecentlyPlayed.css';
import { MusicList } from '../../components';

/**
 * 最近播放页面组件
 */
const RecentlyPlayedPage = () => {
  const [search, setSearch] = useState('');
  
  return (
    <div className="page-container recently-view">
      <div className="page-content">
        <div className="fav-toolbar">
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
          mode="recent"
        />
      </div>
    </div>
  );
};

export default RecentlyPlayedPage;
