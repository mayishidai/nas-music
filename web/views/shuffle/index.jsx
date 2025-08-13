import React from 'react';
import { MusicList } from '../../components';
import '../Pages.css';

const ShufflePage = () => {
  return (
    <div className="page-container">
      <div className="page-content">
        <MusicList
          showCover={true}
          pageSize={10}
          mode="random"
        />
      </div>
    </div>
  );
};

export default ShufflePage;


