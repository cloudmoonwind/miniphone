import React, { useState, useRef } from 'react';
import { ChevronLeft, Image as ImageIcon, Type, Sun } from 'lucide-react';

// ── 工具 ─────────────────────────────────────────────────────────
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/15 backdrop-blur-[16px] border border-white/25 rounded-2xl ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 px-1">{children}</p>
);

// ── 主组件 ───────────────────────────────────────────────────────
const BeautifyApp = ({ onBack, onBackgroundChange }: any) => {
  const wallpaperRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);

  // 桌面遮罩透明度 (0–0.5)
  const [overlay, setOverlayState] = useState<number>(() => {
    const v = localStorage.getItem('ics_desktop_overlay');
    return v ? parseFloat(v) : 0.1;
  });

  // 已导入字体名
  const [fontName, setFontName] = useState<string>(
    () => localStorage.getItem('ics_font_name') || ''
  );

  const applyOverlay = (val: number) => {
    const v = Math.round(val * 100) / 100;
    setOverlayState(v);
    document.documentElement.style.setProperty('--desktop-overlay', String(v));
    try { localStorage.setItem('ics_desktop_overlay', String(v)); } catch {}
  };

  const handleWallpaper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) onBackgroundChange(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  const handleFont = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      const face = new FontFace(name, `url(${data})`);
      face.load().then(f => {
        document.fonts.add(f);
        document.documentElement.style.setProperty('--font-family', `"${name}", sans-serif`);
        (document.body.style as any).fontFamily = `var(--font-family)`;
        setFontName(name);
        try {
          localStorage.setItem('ics_font_name', name);
          localStorage.setItem('ics_font_data', data);
        } catch {}
      }).catch(err => alert('字体加载失败：' + err.message));
    };
    reader.readAsDataURL(file);
  };

  const clearFont = () => {
    document.documentElement.style.removeProperty('--font-family');
    (document.body.style as any).fontFamily = '';
    setFontName('');
    try { localStorage.removeItem('ics_font_name'); localStorage.removeItem('ics_font_data'); } catch {}
  };

  return (
    <div className="flex flex-col h-full overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' }}>

      {/* Header */}
      <div className="h-12 flex items-center px-3 gap-2 shrink-0 bg-white/10 backdrop-blur-[16px] border-b border-white/20">
        <button onClick={onBack} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <span className="font-bold text-white">美化</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 no-scrollbar">

        {/* 壁纸 */}
        <div>
          <SectionTitle>壁纸</SectionTitle>
          <GlassCard>
            <button
              onClick={() => wallpaperRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3"
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ImageIcon size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">更换壁纸</p>
                <p className="text-[11px] text-white/60 mt-0.5">从本地选择图片</p>
              </div>
            </button>
          </GlassCard>
          <input ref={wallpaperRef} type="file" accept="image/*" className="hidden" onChange={handleWallpaper} />
        </div>

        {/* 桌面透明度 */}
        <div>
          <SectionTitle>桌面遮罩透明度</SectionTitle>
          <GlassCard className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <Sun size={16} className="text-white/60 shrink-0" />
              <span className="text-sm text-white flex-1">暗色遮罩</span>
              <span className="text-sm text-white/80 font-mono w-10 text-right">
                {Math.round(overlay * 100)}%
              </span>
            </div>
            <input
              type="range" min={0} max={50} step={1}
              value={Math.round(overlay * 100)}
              onChange={e => applyOverlay(+e.target.value / 100)}
              className="w-full accent-white/70 h-1.5"
            />
            <div className="flex justify-between text-[10px] text-white/40 mt-1">
              <span>透明</span><span>较暗</span>
            </div>
          </GlassCard>
        </div>

        {/* 字体 */}
        <div>
          <SectionTitle>自定义字体</SectionTitle>
          <GlassCard>
            <button
              onClick={() => fontRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3"
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Type size={18} className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-white">导入字体</p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {fontName ? `已加载：${fontName}` : '支持 ttf / otf / woff / woff2'}
                </p>
              </div>
            </button>
            {fontName && (
              <div className="px-4 pb-3">
                <button
                  onClick={clearFont}
                  className="w-full py-1.5 bg-red-400/20 text-red-200 text-xs rounded-lg border border-red-400/30 hover:bg-red-400/30 transition-colors"
                >
                  恢复默认字体
                </button>
              </div>
            )}
          </GlassCard>
          <input ref={fontRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFont} />
        </div>

      </div>
    </div>
  );
};

export default BeautifyApp;
