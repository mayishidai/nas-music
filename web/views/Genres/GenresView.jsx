import React from 'react';
import './GenresView.css';

/**
 * 流派视图组件
 * 展示流派列表
 */
const GenresView = ({ genres = [] }) => {
  return (
    <div className="genres-view">
      <div className="genres-grid">
        {genres.map(genre => (
          <div key={genre.id} className="genre-card">
            <div className="genre-icon">
              <span>🎭</span>
            </div>
            <div className="genre-info">
              <h3 className="genre-name">{genre.name}</h3>
              <p className="genre-tracks">{genre.trackCount || 0} 首歌曲</p>
            </div>
          </div>
        ))}
      </div>
      
      {genres.length === 0 && (
        <div className="empty-state">
          <h3>暂无流派</h3>
          <p>音乐库中还没有流派信息</p>
        </div>
      )}
    </div>
  );
};

export default GenresView;
