import React from 'react';
import './Button.css';

/**
 * 通用按钮组件
 * @param {Object} props - 组件属性
 * @param {string} props.variant - 按钮样式变体 (primary, secondary, danger, ghost)
 * @param {string} props.size - 按钮大小 (small, medium, large)
 * @param {boolean} props.disabled - 是否禁用
 * @param {string} props.className - 额外的CSS类名
 * @param {React.ReactNode} props.children - 按钮内容
 * @param {Function} props.onClick - 点击事件处理函数
 * @param {Object} props.rest - 其他属性
 */
const Button = ({ 
  variant = 'primary', 
  size = 'medium', 
  disabled = false, 
  className = '', 
  children, 
  onClick, 
  ...rest 
}) => {
  const baseClass = 'common-btn';
  const variantClass = `common-btn--${variant}`;
  const sizeClass = `common-btn--${size}`;
  const disabledClass = disabled ? 'common-btn--disabled' : '';
  
  const combinedClass = `${baseClass} ${variantClass} ${sizeClass} ${disabledClass} ${className}`.trim();

  return (
    <button
      className={combinedClass}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
