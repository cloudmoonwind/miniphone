/**
 * AppGrid — 主屏 App 图标网格
 *
 * Props:
 *   items    — 当前页的图标/widget 列表
 *   onOpen   — (appId) => void
 *   recentChat, onOpenRecentChat — 传给 ChatPreviewWidget
 *
 * item 结构：
 *   普通图标：{ id, name, icon }
 *   Widget：  { id, type: 'widget', component, props? }
 *   所有 item 都有 gridPos（CSS grid-area 字符串）
 */
import Avatar from '../components/Avatar.jsx';

const AppIcon = ({ app, onOpen }) => (
  <button
    onClick={() => onOpen(app.id)}
    className="flex flex-col items-center justify-center gap-2 group"
  >
    <div className="w-14 h-14 bg-white/20 backdrop-blur-[16px] rounded-2xl flex items-center justify-center
      shadow-lg group-active:scale-95 transition-transform border border-white/40">
      <app.icon size={24} color="white" strokeWidth={1.5} />
    </div>
    <span className="text-xs font-medium text-white drop-shadow-md">{app.name}</span>
  </button>
);

export default function AppGrid({ items, onOpen, recentChat, onOpenRecentChat }) {
  return (
    <div className="grid grid-cols-4 grid-rows-6 gap-2 h-full">
      {items.map(item => (
        <div key={item.id} style={{ gridArea: item.gridPos }}>
          {item.type === 'widget'
            ? <item.component {...(item.props || {})} recentChat={recentChat} onOpenApp={onOpen} onOpenRecentChat={onOpenRecentChat} />
            : <AppIcon app={item} onOpen={onOpen} />
          }
        </div>
      ))}
    </div>
  );
}
