import React from 'react';
import './Input.css';

/**
 * 通用输入框组件
 * @param {Object} props - 组件属性
 * @param {string} props.type - 输入框类型 (text, password, number, email, search)
 * @param {string} props.placeholder - 占位符文本
 * @param {string} props.value - 输入值
 * @param {Function} props.onChange - 值变化处理函数
 * @param {string} props.className - 额外的CSS类名
 * @param {boolean} props.disabled - 是否禁用
 * @param {boolean} props.required - 是否必填
 * @param {string} props.size - 输入框大小 (small, medium, large)
 * @param {string} props.variant - 输入框样式变体 (default, filled, outlined)
 * @param {React.ReactNode} props.prefix - 前缀图标或文本
 * @param {React.ReactNode} props.suffix - 后缀图标或文本
 * @param {Object} props.rest - 其他属性
 */
const Input = ({
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  className = '',
  disabled = false,
  required = false,
  size = 'medium',
  variant = 'default',
  prefix,
  suffix,
  ...rest
}) => {
  const baseClass = 'common-input';
  const sizeClass = `common-input--${size}`;
  const variantClass = `common-input--${variant}`;
  const disabledClass = disabled ? 'common-input--disabled' : '';
  const hasPrefix = prefix ? 'common-input--has-prefix' : '';
  const hasSuffix = suffix ? 'common-input--has-suffix' : '';
  
  const combinedClass = `${baseClass} ${sizeClass} ${variantClass} ${disabledClass} ${hasPrefix} ${hasSuffix} ${className}`.trim();

  const handleChange = (e) => {
    if (onChange && !disabled) {
      onChange(e);
    }
  };

  return (
    <div className="common-input-wrapper">
      {prefix && (
        <div className="common-input-prefix">
          {prefix}
        </div>
      )}
      
      <input
        type={type}
        className={combinedClass}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        {...rest}
      />
      
      {suffix && (
        <div className="common-input-suffix">
          {suffix}
        </div>
      )}
    </div>
  );
};

export default Input;
