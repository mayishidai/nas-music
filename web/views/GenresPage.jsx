import React from 'react';
import { GenresView } from '../components/index';
import './Pages.css';

/**
 * 流派页面组件
 */
const GenresPage = ({ genres }) => {
  return (
    <div className="page-container">
      <div className="page-content">
        <GenresView
          genres={genres}
        />
      </div>
    </div>
  );
};

export default GenresPage;
