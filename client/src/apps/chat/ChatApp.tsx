/**
 * ChatApp.jsx — 聊天应用入口
 *
 * 原 1300+ 行的 ChatApp.jsx 拆分为：
 *   chatFormatters.js  — 工具函数与常量
 *   MessageBubble.jsx  — 消息气泡组件
 *   ChatCalendar.jsx   — 日期查找月历视图
 *   useChatState.js    — 状态与业务逻辑 Hook
 *   ChatMain.jsx       — 布局层
 *   ChatApp.jsx（本文件）— 入口
 */
import { ChevronLeft, MessageSquare } from 'lucide-react';
import ChatMain from './ChatMain.jsx';

// ── 无角色提示屏 ─────────────────────────────────────────────────
const ChatNoChar = ({ onBack }) => (
  <div className="flex flex-col h-full bg-gray-50">
    <div className="h-14 bg-white border-b flex items-center px-3 shadow-sm shrink-0">
      <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
        <ChevronLeft size={20} className="text-gray-600" />
      </button>
      <span className="ml-2 font-bold">信息</span>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
        <MessageSquare size={32} className="text-purple-300" />
      </div>
      <p className="text-gray-700 font-semibold">还没有选择角色</p>
      <p className="text-gray-400 text-sm leading-relaxed">
        请先去「结缘」选择一个角色，<br />再点击「发消息」开始聊天
      </p>
      <button
        onClick={onBack}
        className="mt-2 px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600"
      >
        去结缘选角色
      </button>
    </div>
  </div>
);

// ── 入口 ────────────────────────────────────────────────────────
export default function ChatApp({ onBack, activePreset, initialChar, onNewAIMessage, onOpenApp }) {
  if (!initialChar) return <ChatNoChar onBack={onBack} />;
  return (
    <ChatMain
      onBack={onBack}
      activePreset={activePreset}
      initialChar={initialChar}
      onNewAIMessage={onNewAIMessage}
      onOpenApp={onOpenApp}
    />
  );
}
