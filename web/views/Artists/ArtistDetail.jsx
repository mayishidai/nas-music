import React, { useMemo } from 'react';
import { MusicList } from '../../components';
import './ArtistDetail.css';

const ArtistDetailView = ({ router, player }) => {
  const artist = router.getCurrentData().artist;
  const name = artist?.name || '';
  const cover = artist?.photo || artist?.coverImage || null;
  const stats = {
    albums: artist?.albumCount || (artist?.albums?.length || 0),
    tracks: artist?.trackCount || (artist?.tracks?.length || 0)
  };

  if (!artist) {
    return <div className="page-container">艺术家不存在</div>;
  }

  return (
    <div className="artist-detail">
      <div className="ad-header">
        <button className="ad-back" onClick={router.goBack}>← 返回</button>
        <div className="ad-banner" style={{ backgroundImage: cover ? `url(${cover})` : undefined }}>
          {!cover && <div className="ad-placeholder">👤</div>}
          <div className="ad-overlay">
            <h2 className="ad-name">{name || '未知艺术家'}</h2>
            <div className="ad-stats">
              <span>{stats.albums} 张专辑</span>
              <span className="dot">•</span>
              <span>{stats.tracks} 首歌曲</span>
            </div>
            <div className="ad-desc">暂无简介</div>
          </div>
        </div>
      </div>

      <div className="ad-list">
        <MusicList
          pageSize={10}
          searchKeyword={''}
          onPlay={(track) => player.playMusic(track)}
          onAddToPlaylist={(track) => player.addToPlaylist(track)}
          filters={{ artist: name }}
        />
      </div>
    </div>
  );
};

export default ArtistDetailView;


