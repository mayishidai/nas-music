import React, { useRef, useEffect, useCallback } from 'react';
import './InfiniteScroll.css';

/**
 * 无限滚动组件
 * 当内容滚动到底部时自动调用loadNext方法
 * 
 * @param {Object} props
 * @param {Function} props.loadNext - 加载下一页的回调函数
 * @param {boolean} props.hasMore - 是否还有更多数据
 * @param {boolean} props.loading - 是否正在加载
 * @param {React.ReactNode} props.children - 子组件内容
 * @param {string} props.className - 自定义CSS类名
 * @param {number} props.threshold - 触发加载的阈值（距离底部的像素）
 * @param {string} props.loadingText - 加载中的文本
 * @param {string} props.endText - 没有更多数据的文本
 */
const InfiniteScroll = ({
  loadNext,
  hasMore = true,
  loading = false,
  children,
  className = '',
  threshold = 100,
  loadingText = '加载中...',
  endText = '没有更多数据了'
}) => {
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  // 检查是否滚动到底部
  const isNearBottom = useCallback(() => {
    if (!containerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - threshold;
  }, [threshold]);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (!hasMore || loading) return;
    if (isNearBottom()) {
      loadNext();
    }
  }, [hasMore, loading, isNearBottom, loadNext]);

  // 使用Intersection Observer API（如果支持）
  useEffect(() => {
    if (!containerRef.current || !hasMore || loading) return;

    // 创建观察器
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasMore && !loading) {
            loadNext();
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    );

    // 创建触发元素
    const triggerElement = document.createElement('div');
    triggerElement.style.height = '1px';
    triggerElement.style.width = '100%';
    containerRef.current.appendChild(triggerElement);

    // 观察触发元素
    observerRef.current.observe(triggerElement);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadNext, threshold]);

  // 备用方案：使用scroll事件监听
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 如果支持Intersection Observer，则不使用scroll事件
    if (window.IntersectionObserver) return;

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  return (
    <div 
      ref={containerRef}
      className={`infinite-scroll-container ${className}`}
    >
      {children}
      
      {/* 加载状态指示器 */}
      <div className="infinite-scroll-status">
        {loading && (
          <div className="infinite-scroll-loading">
            <div className="loading-spinner">⏳</div>
            <span>{loadingText}</span>
          </div>
        )}
        
        {!hasMore && !loading && (
          <div className="infinite-scroll-end">
            <span>{endText}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfiniteScroll;
