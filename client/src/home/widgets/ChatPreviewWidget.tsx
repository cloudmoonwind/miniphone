import { ChevronRight } from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';

/**
 * ChatPreviewWidget — 最近聊天预览小组件
 *
 * Props:
 *   recentChat     — { char, preview } 或 null
 *   onOpenRecentChat — (char) => void
 *   onOpenApp        — (appId) => void
 */
export default function ChatPreviewWidget({ recentChat, onOpenRecentChat, onOpenApp }) {
  return (
    <button
      onClick={() =>
        recentChat?.char
          ? onOpenRecentChat(recentChat.char)
          : onOpenApp('结缘')
      }
      className="w-full h-full bg-white/15 backdrop-blur-sm rounded-2xl border border-white/10
        flex items-center px-4 gap-3
        hover:bg-white/20 active:bg-white/25 transition-colors overflow-hidden"
    >
      {recentChat?.char ? (
        <>
          <Avatar
            value={recentChat.char.avatar}
            name={recentChat.char.name}
            size={40}
            rounded
            className="shrink-0"
          />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white font-semibold text-sm truncate leading-tight">
              {recentChat.char.name}
            </p>
            <p className="text-white/65 text-xs truncate leading-tight mt-0.5">
              {recentChat.preview}
            </p>
          </div>
          <ChevronRight size={15} className="text-white/40 shrink-0" />
        </>
      ) : (
        <p className="flex-1 text-center text-white/40 text-xs">
          去「结缘」选择角色开始聊天
        </p>
      )}
    </button>
  );
}
