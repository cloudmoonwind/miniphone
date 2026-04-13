/**
 * worldbook/ui.tsx — 视觉装饰组件 & 通用 UI
 *
 * 包含：书脊/页边装饰、分隔线、四角框、书图标、下拉框
 */
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Opt } from './constants';

// ── 书脊（装订脊背，实色重）────────────────────────────────────────
export const SpineStrip = () => (
  <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: 16, zIndex: 20 }}>
    <div className="absolute left-0 top-0 bottom-0" style={{
      width: 16,
      background: 'linear-gradient(to right, rgba(38,18,6,0.72) 0%, rgba(65,32,10,0.52) 30%, rgba(90,52,18,0.22) 65%, transparent 100%)',
    }} />
    <div className="absolute left-0 top-0 bottom-0 w-px" style={{ background: 'rgba(22,8,2,0.6)' }} />
    <div className="absolute top-0 bottom-0 w-px" style={{ left: 3, background: 'rgba(180,120,60,0.12)' }} />
  </div>
);

// ── 页边阴影（右侧，不突出）─────────────────────────────────────────
export const PageStack = () => (
  <div className="absolute right-0 top-0 bottom-0 pointer-events-none" style={{ width: 10, zIndex: 20 }}>
    <div className="absolute right-0 top-0 bottom-0 w-px" style={{ background: 'rgba(38,18,6,0.2)' }} />
    <div className="absolute right-0 top-0 bottom-0" style={{ width: 10, background: 'linear-gradient(to left, rgba(0,0,0,0.05), transparent)' }} />
  </div>
);

// ── 内阴影（左侧页面弯曲感）─────────────────────────────────────────
export const InnerShadow = () => (
  <div className="absolute inset-0 pointer-events-none" style={{
    zIndex: 21,
    background: 'linear-gradient(to right, rgba(38,18,6,0.10) 0%, rgba(38,18,6,0.04) 18%, transparent 38%)',
    boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.04), inset 0 -6px 18px rgba(0,0,0,0.03)',
  }} />
);

// ── 条目间分隔（暖棕虚线 + 小菱形）──────────────────────────────────
export const EntryDivider = () => (
  <div className="flex items-center px-4 py-1">
    <div className="flex-1" style={{ borderTop: '1px dashed rgba(100,65,30,0.22)' }} />
    <svg width="8" height="8" viewBox="0 0 8 8" className="mx-2 shrink-0">
      <rect x="3" y="0" width="2.8" height="2.8" rx="0.3"
        transform="rotate(45 4 4)" fill="rgba(100,65,30,0.28)" />
    </svg>
    <div className="flex-1" style={{ borderTop: '1px dashed rgba(100,65,30,0.22)' }} />
  </div>
);

// ── 内容区四角框 ──────────────────────────────────────────────────
export const CornerBox = ({ children }: { children: React.ReactNode }) => (
  <div className="relative px-3 py-2">
    <span className="absolute top-0 left-0 w-3 h-3" style={{ borderTop: '1px solid #888', borderLeft: '1px solid #888' }} />
    <span className="absolute top-0 right-0 w-3 h-3" style={{ borderTop: '1px solid #888', borderRight: '1px solid #888' }} />
    <span className="absolute bottom-0 left-0 w-3 h-3" style={{ borderBottom: '1px solid #888', borderLeft: '1px solid #888' }} />
    <span className="absolute bottom-0 right-0 w-3 h-3" style={{ borderBottom: '1px solid #888', borderRight: '1px solid #888' }} />
    {children}
  </div>
);

// ── 开书图标 ─────────────────────────────────────────────────────
export const BookSVG = ({ open = false, size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none"
    stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 18V5" />
    <path d="M3 5h8v13H3a1 1 0 01-1-1V6a1 1 0 011-1z" />
    <path d="M19 5h-8v13h8a1 1 0 001-1V6a1 1 0 00-1-1z" />
    {open && <>
      <line x1="5" y1="8.5" x2="9" y2="8.5" />
      <line x1="5" y1="11" x2="9" y2="11" />
      <line x1="13" y1="8.5" x2="17" y2="8.5" />
    </>}
  </svg>
);

// ── 固定定位下拉（穿透所有 overflow / transform 容器）───────────────
export const InlineDropdown = ({ options, value, onChange, italic = true }: {
  options: Opt[]; value: string; onChange: (v: string) => void; italic?: boolean;
}) => {
  const [open, setOpen]   = useState(false);
  const [rect, setRect]   = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const cur = options.find(o => o.value === value);

  const handleOpen = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);

  return (
    <span className="inline-block">
      <button ref={triggerRef} onMouseDown={handleOpen} onTouchStart={handleOpen}
        className={`text-xs text-gray-500 border-b border-gray-300 pb-0.5 focus:outline-none ${italic ? 'italic' : ''}`}>
        {cur?.label ?? value}
      </button>
      {open && rect && (
        <div ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, zIndex: 9999 }}
          className="bg-white/98 backdrop-blur-sm border border-gray-200 shadow-xl rounded-xl py-1 min-w-[100px]"
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}>
          {options.map(o => (
            <button key={o.value}
              onMouseDown={e => { e.stopPropagation(); onChange(o.value); setOpen(false); }}
              onTouchStart={e => { e.stopPropagation(); onChange(o.value); setOpen(false); }}
              className={`block w-full text-left text-xs px-3 py-1.5 transition-colors
                ${o.value === value ? 'text-gray-900 font-medium bg-gray-50' : 'text-gray-500 hover:bg-gray-50'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
};

// ── 底部弹窗（事件书用）──────────────────────────────────────────
export const BottomPopup = ({ title, options, value, onChange, onClose }: {
  title: string; options: Opt[]; value: string;
  onChange: (v: string) => void; onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
    <div className="w-full max-w-md bg-white rounded-t-2xl pb-6 shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-medium text-sm text-gray-800">{title}</span>
        <button onClick={onClose}><X size={17} className="text-gray-400" /></button>
      </div>
      <div className="px-2 py-2 max-h-56 overflow-y-auto">
        {options.map(o => (
          <button key={o.value} onClick={() => { onChange(o.value); onClose(); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors
              ${o.value === value ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
            {o.label}{o.value === value && <span className="float-right text-gray-400">✓</span>}
          </button>
        ))}
      </div>
    </div>
  </div>
);
