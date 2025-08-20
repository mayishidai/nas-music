import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 自定义Hook：管理URL状态
 * 将分页、排序、过滤等条件记录在URL查询参数中
 */
export const useUrlState = (defaultState = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 使用useRef来存储默认状态，避免重新创建
  const defaultStateRef = useRef(defaultState);
  
  // 从URL查询参数解析状态
  const parseStateFromUrl = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    const state = { ...defaultStateRef.current };
    
    // 解析分页参数
    if (searchParams.has('page')) {
      state.page = parseInt(searchParams.get('page'), 10) || 1;
    }
    if (searchParams.has('pageSize')) {
      state.pageSize = parseInt(searchParams.get('pageSize'), 10) || 10;
    }
    
    // 解析排序参数
    if (searchParams.has('sort')) {
      state.sortKey = searchParams.get('sort');
    }
    if (searchParams.has('order')) {
      state.sortOrder = searchParams.get('order');
    }
    
    // 解析搜索参数
    if (searchParams.has('search')) {
      state.search = searchParams.get('search');
    }
    
    // 解析其他自定义参数
    Object.keys(defaultStateRef.current).forEach(key => {
      if (searchParams.has(key) && !['page', 'pageSize', 'sort', 'order', 'search'].includes(key)) {
        const value = searchParams.get(key);
        // 尝试解析JSON，如果失败则使用原始值
        try {
          state[key] = JSON.parse(value);
        } catch {
          state[key] = value;
        }
      }
    });
    
    return state;
  }, [location.search]);

  // 初始化状态
  const [state, setState] = useState(() => parseStateFromUrl());

  // 当URL变化时更新状态
  useEffect(() => {
    const newState = parseStateFromUrl();
    setState(newState);
  }, [location.search]);

  // 更新状态并同步到URL
  const updateState = useCallback((newState, replace = false) => {
    setState(prevState => {
      const updatedState = { ...prevState, ...newState };
      
      // 构建新的查询参数
      const searchParams = new URLSearchParams();
      
      // 添加分页参数
      if (updatedState.page && updatedState.page > 1) {
        searchParams.set('page', updatedState.page.toString());
      }
      if (updatedState.pageSize && updatedState.pageSize !== 10) {
        searchParams.set('pageSize', updatedState.pageSize.toString());
      }
      
      // 添加排序参数
      if (updatedState.sortKey && updatedState.sortKey !== 'title') {
        searchParams.set('sort', updatedState.sortKey);
      }
      if (updatedState.sortOrder && updatedState.sortOrder !== 'asc') {
        searchParams.set('order', updatedState.sortOrder);
      }
      
      // 添加搜索参数
      if (updatedState.search && updatedState.search.trim()) {
        searchParams.set('search', updatedState.search.trim());
      }
      
      // 添加其他自定义参数
      Object.keys(updatedState).forEach(key => {
        if (!['page', 'pageSize', 'sort', 'order', 'search'].includes(key) && 
            updatedState[key] !== undefined && 
            updatedState[key] !== null && 
            updatedState[key] !== '') {
          const value = typeof updatedState[key] === 'object' 
            ? JSON.stringify(updatedState[key])
            : updatedState[key].toString();
          searchParams.set(key, value);
        }
      });
      
      // 更新URL
      const newSearch = searchParams.toString();
      const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
      
      if (replace) {
        navigate(newUrl, { replace: true });
      } else {
        navigate(newUrl);
      }
      
      return updatedState;
    });
  }, [navigate, location.pathname]);

  // 重置状态
  const resetState = useCallback((newDefaults = {}) => {
    const resetState = { ...defaultStateRef.current, ...newDefaults };
    setState(resetState);
    
    // 清除URL查询参数
    navigate(location.pathname, { replace: true });
  }, [navigate, location.pathname]);

  // 便捷方法：更新分页
  const setPage = useCallback((page) => {
    updateState({ page });
  }, [updateState]);

  // 便捷方法：更新每页数量
  const setPageSize = useCallback((pageSize) => {
    updateState({ pageSize, page: 1 }); // 重置到第一页
  }, [updateState]);

  // 便捷方法：更新排序
  const setSort = useCallback((sortKey, sortOrder = 'asc') => {
    updateState({ sortKey, sortOrder });
  }, [updateState]);

  // 便捷方法：更新搜索
  const setSearch = useCallback((search) => {
    updateState({ search, page: 1 }); // 重置到第一页
  }, [updateState]);

  return {
    state,
    updateState,
    resetState,
    setPage,
    setPageSize,
    setSort,
    setSearch
  };
};
