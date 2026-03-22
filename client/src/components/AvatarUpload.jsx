/**
 * AvatarUpload — 头像上传组件
 *
 * 支持三种状态：
 *   1. 已上传图片（data URL 或 http URL）→ <img>
 *   2. 无图片 → SVG 人形占位
 *
 * 点击区域触发文件选择，自动压缩至 240×240 后返回 base64 data URL。
 */
import { useRef } from 'react';
import { Camera, User } from 'lucide-react';

/**
 * @param {object} props
 * @param {string}   props.value      当前头像（base64 data URL 或空字符串）
 * @param {function} props.onChange   回调 (base64DataUrl: string) => void
 * @param {number}   [props.size=72]  头像区域像素尺寸
 * @param {string}   [props.className] 额外 class
 * @param {boolean}  [props.rounded]  true = rounded-full, 否则 rounded-2xl
 */
export default function AvatarUpload({ value, onChange, size = 72, className = '', rounded = false }) {
  const inputRef = useRef(null);

  const isImage = value && (value.startsWith('data:') || value.startsWith('http'));

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 240;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        onChange(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const shape = rounded ? 'rounded-full' : 'rounded-2xl';

  return (
    <div
      className={`relative shrink-0 cursor-pointer group ${className}`}
      style={{ width: size, height: size }}
      onClick={() => inputRef.current?.click()}
    >
      {/* 头像区 */}
      <div
        className={`w-full h-full ${shape} overflow-hidden flex items-center justify-center bg-gray-100 border border-gray-200`}
      >
        {isImage ? (
          <img src={value} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <User size={Math.round(size * 0.42)} className="text-gray-300" />
        )}
      </div>

      {/* 悬浮蒙层 */}
      <div className={`absolute inset-0 ${shape} bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
        <Camera size={Math.round(size * 0.28)} className="text-white" />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
