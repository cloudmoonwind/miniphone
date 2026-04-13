/**
 * Dock — 主屏底部 Dock 栏
 *
 * Props:
 *   apps   — [{ id, name, icon }]
 *   onOpen — (appId) => void
 */
export default function Dock({ apps, onOpen }) {
  return (
    <div className="mx-4 mb-4 h-20 bg-white/20 backdrop-blur-[16px] rounded-[1.75rem]
      flex items-center justify-around px-2
      border border-white/30 shadow-2xl z-20 shrink-0">
      {apps.map(app => (
        <button
          key={app.id}
          onClick={() => onOpen(app.id)}
          className="flex flex-col items-center justify-center gap-0 group"
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur-[16px] rounded-2xl flex items-center justify-center
            shadow-lg group-active:scale-95 transition-transform border border-white/40">
            <app.icon size={24} color="white" strokeWidth={1.5} />
          </div>
        </button>
      ))}
    </div>
  );
}
