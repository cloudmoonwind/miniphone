import { useState, useEffect } from 'react';
import {
  Settings, Contact, Folder,
  CloudSun, Heart, SlidersHorizontal, Scroll, User,
  Map, BookCopy, Users2, Bot, Users, Brain,
  Palette, Calendar as CalendarIcon, PenSquare, PiggyBank,
  BookOpen, Package, Pencil, Briefcase, FileText,
  Moon, Clapperboard, Dice5, Mail, Cat, ChevronRight, Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import StatusBar     from './components/StatusBar';
import PlaceholderApp from './components/PlaceholderApp';
import ChatApp       from './apps/ChatApp';
import ContactsApp   from './apps/ContactsApp';
import BeautifyApp   from './apps/BeautifyApp';
import SettingsApp   from './apps/SettingsApp';
import MapApp        from './apps/MapApp';
import DreamApp      from './apps/DreamApp';
import FilesApp      from './apps/FilesApp';
import MemoryApp     from './apps/MemoryApp';
import AIConsoleApp  from './apps/AIConsoleApp';
import WorldbookApp  from './apps/WorldbookApp';
import CharLifeApp   from './apps/CharLifeApp';
import DaoshuApp     from './apps/DaoshuApp';
import MinggeApp     from './apps/MinggeApp';
import DiaryApp      from './apps/DiaryApp';
import { settingsService } from './services/settings.js';
import ErrorBoundary from './components/ErrorBoundary';

// --- 组件必须定义在 HomeScreen 外部，否则每次渲染创建新类型导致 DOM reconciliation 错误 ---
const ClockWidget = () => (
  <div className="w-full h-full flex flex-col justify-center items-center text-white">
    <h1 className="text-6xl font-light tracking-tight drop-shadow-lg">10:24</h1>
    <p className="text-blue-50 text-lg mt-1 drop-shadow-md">3月10日 星期二</p>
    <div className="flex items-center gap-2 mt-4 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10 shadow-sm">
      <CloudSun size={16} />
      <span className="text-xs font-medium">多云 24°C</span>
    </div>
  </div>
);

const CalendarWidget = () => (
  <div className="w-full h-full bg-white/10 rounded-2xl flex items-center justify-center text-white/50 text-sm">日历组件</div>
);

const ChatPreviewWidget = ({ recentChat, onOpenRecentChat, onOpenApp }) => (
  <button
    onClick={() => recentChat?.char ? onOpenRecentChat(recentChat.char) : onOpenApp('结缘')}
    className="w-full h-full bg-white/15 backdrop-blur-sm rounded-2xl border border-white/10 flex items-center px-4 gap-3 hover:bg-white/20 active:bg-white/25 transition-colors overflow-hidden"
  >
    {recentChat?.char ? (
      <>
        <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center text-xl shrink-0">
          {recentChat.char.avatar || recentChat.char.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-white font-semibold text-sm truncate leading-tight">{recentChat.char.name}</p>
          <p className="text-white/65 text-xs truncate leading-tight mt-0.5">{recentChat.preview}</p>
        </div>
        <ChevronRight size={15} className="text-white/40 shrink-0" />
      </>
    ) : (
      <p className="flex-1 text-center text-white/40 text-xs">去「结缘」选择角色开始聊天</p>
    )}
  </button>
);

// --- 主屏幕 ---
const HomeScreen = ({ onOpenApp, wallpaper, recentChat, onOpenRecentChat }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // 聊天槽置空（保留位置撑开 dock 布局）
  const dockApps = [
    { id: 'contacts', name: '通讯录',  icon: Contact  },
    { id: '终端',     name: 'AI终端',  icon: Terminal },
    { id: 'files',    name: '文件管理', icon: Folder   },
    { id: 'settings', name: '设置',    icon: Settings },
  ];

  const pages = [
    // Page 1
    [
      { id: 'widget-clock',        type: 'widget', component: ClockWidget,          gridPos: '1 / 1 / 3 / 5' },
      { id: 'widget-chat-preview', type: 'widget', component: ChatPreviewWidget,
        props: { recentChat, onOpenApp, onOpenRecentChat },                          gridPos: '3 / 1 / 4 / 5' },
      { id: '结缘',    name: '结缘',    icon: Heart,           gridPos: '4 / 1 / 5 / 2' },
      { id: '道枢',    name: '道枢',    icon: SlidersHorizontal, gridPos: '4 / 2 / 5 / 3' },
      { id: '律令',    name: '律令',    icon: Scroll,          gridPos: '4 / 3 / 5 / 4' },
      { id: '命格',    name: '命格',    icon: User,            gridPos: '4 / 4 / 5 / 5' },
      { id: '地图',    name: '地图',    icon: Map,             gridPos: '5 / 1 / 6 / 2' },
      { id: '世界书',  name: '世界书',  icon: BookCopy,        gridPos: '5 / 2 / 6 / 3' },
      { id: '群聊',    name: '群聊',    icon: Users2,          gridPos: '5 / 3 / 6 / 4' },
      { id: '角色系统', name: '角色系统', icon: Bot,            gridPos: '5 / 4 / 6 / 5' },
      { id: '社区',    name: '社区',    icon: Users,           gridPos: '6 / 1 / 7 / 2' },
      { id: '忆海',    name: '忆海',    icon: Brain,           gridPos: '6 / 2 / 7 / 3' },
    ],
    // Page 2
    [
      { id: '美化',     name: '美化',     icon: Palette,     gridPos: '1 / 1 / 2 / 2' },
      { id: '日历',     name: '日历',     icon: CalendarIcon, gridPos: '1 / 2 / 2 / 3' },
      { id: '随笔',     name: '随笔',     icon: PenSquare,   gridPos: '1 / 3 / 2 / 4' },
      { id: '记账',     name: '记账',     icon: PiggyBank,   gridPos: '1 / 4 / 2 / 5' },
      { id: '日记',     name: '日记',     icon: BookOpen,    gridPos: '2 / 1 / 3 / 2' },
      { id: '物品库',   name: '物品库',   icon: Package,     gridPos: '2 / 2 / 3 / 3' },
      { id: '创作',     name: '创作',     icon: Pencil,      gridPos: '2 / 3 / 3 / 4' },
      { id: '异世界之旅', name: '异世界之旅', icon: Briefcase, gridPos: '2 / 4 / 3 / 5' },
      { id: 'npc管理',  name: 'NPC管理',  icon: Users,       gridPos: '3 / 1 / 4 / 2' },
      { id: '珍藏',     name: '珍藏',     icon: Heart,       gridPos: '3 / 2 / 4 / 3' },
      { id: 'widget-calendar', type: 'widget', component: CalendarWidget, gridPos: '4 / 1 / 7 / 5' },
    ],
    // Page 3
    [
      { id: '梦境',    name: '梦境',    icon: Moon,        gridPos: '1 / 1 / 2 / 2' },
      { id: '无限流',  name: '无限流',  icon: Clapperboard, gridPos: '1 / 2 / 2 / 3' },
      { id: '大富翁',  name: '大富翁',  icon: Dice5,       gridPos: '1 / 3 / 2 / 4' },
      { id: '时光邮局', name: '时光邮局', icon: Mail,       gridPos: '1 / 4 / 2 / 5' },
      { id: '养宠',    name: '养宠',    icon: Cat,         gridPos: '2 / 1 / 3 / 2' },
      { id: '约会',    name: '约会',    icon: Heart,       gridPos: '2 / 2 / 3 / 3' },
      { id: 'ta的秘密', name: 'ta的秘密', icon: FileText,  gridPos: '2 / 3 / 3 / 4' },
      { id: '终端',    name: 'AI终端',   icon: Terminal,   gridPos: '2 / 4 / 3 / 5' },
    ],
  ];

  const renderAppIcon = (app, isDock = false) => {
    // 空占位（dock 聊天槽）
    if (app.placeholder) {
      return <div key={app.id} className="w-14 h-14 rounded-2xl border border-white/10 bg-white/5 opacity-40" />;
    }
    return (
      <button
        key={app.id}
        onClick={() => onOpenApp(app.id)}
        className="flex flex-col items-center justify-center gap-2 group"
      >
        <div className="w-14 h-14 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center shadow-lg group-active:scale-95 transition-transform border border-white/10">
          <app.icon size={28} color="white" strokeWidth={1.5} />
        </div>
        {!isDock && <span className="text-xs font-medium text-white drop-shadow-md">{app.name}</span>}
      </button>
    );
  };

  return (
    <div
      className="h-full bg-gradient-to-br from-blue-400 to-pink-400 flex flex-col relative overflow-hidden"
      onContextMenu={(e) => { e.preventDefault(); setIsEditing(!isEditing); }}
    >
      {wallpaper && <img src={wallpaper} className="absolute inset-0 w-full h-full object-cover" alt="" />}
      <div className="absolute inset-0 bg-black/10" />

      <motion.div
        className="flex-1 flex"
        drag="x"
        dragConstraints={{ left: -375 * (pages.length - 1), right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -100) setCurrentPage(p => Math.min(p + 1, pages.length - 1));
          if (info.offset.x > 100)  setCurrentPage(p => Math.max(p - 1, 0));
        }}
        animate={{ x: -currentPage * 375 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {pages.map((pageItems, i) => (
          <div key={i} className="w-[375px] h-full flex-shrink-0 p-4 pt-8">
            <div className="grid grid-cols-4 grid-rows-6 gap-2 h-full">
              {pageItems.map(item => (
                <div key={item.id} style={{ gridArea: item.gridPos }}>
                  {item.type === 'widget' ? <item.component {...(item.props || {})} /> : renderAppIcon(item)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </motion.div>

      <div className="h-8 flex justify-center items-center gap-2 z-10">
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`h-2 rounded-full transition-all ${currentPage === i ? 'bg-white w-4' : 'bg-white/40 w-2'}`}
          />
        ))}
      </div>

      <div className="mx-4 mb-4 h-20 bg-white/20 backdrop-blur-xl rounded-[1.75rem] flex items-center justify-around px-2 border border-white/10 shadow-2xl z-20 shrink-0">
        {dockApps.map(app => renderAppIcon(app, true))}
      </div>
    </div>
  );
};

// --- 主入口 ---
function App() {
  const [currentApp, setCurrentApp] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [wallpaper, setWallpaper] = useState(null);
  const [chatChar, setChatChar] = useState(null);
  const [recentChat, setRecentChat] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ics_recent_chat') || 'null'); } catch { return null; }
  });

  const startChat = (char) => { setChatChar(char); setCurrentApp('chat'); };
  const openChatWithChar = (char) => { setChatChar(char); setCurrentApp('chat'); };

  const onNewAIMessage = (char, content) => {
    const recent = { char, preview: content };
    setRecentChat(recent);
    try { localStorage.setItem('ics_recent_chat', JSON.stringify(recent)); } catch {}
  };

  // 从桌面点击"信息"：有历史角色则继续，否则跳到结缘选角色
  const openApp = (id) => {
    if (id === 'chat' && !chatChar) setCurrentApp('结缘');
    else setCurrentApp(id);
  };

  useEffect(() => {
    settingsService.getActivePreset().then(preset => { if (preset) setActivePreset(preset); }).catch(() => {});
    const savedWallpaper = localStorage.getItem('ics_wallpaper');
    if (savedWallpaper) setWallpaper(savedWallpaper);
  }, []);

  // App 路由映射：id → 组件（有则渲染，无则走占位）
  const APP_ROUTES = {
    chat:     <ErrorBoundary><ChatApp      onBack={() => setCurrentApp(null)} activePreset={activePreset} initialChar={chatChar} onNewAIMessage={onNewAIMessage} /></ErrorBoundary>,
    settings: <ErrorBoundary><SettingsApp  onBack={() => setCurrentApp(null)} onPresetChange={setActivePreset} /></ErrorBoundary>,
    contacts: <PlaceholderApp appName="联系人" onBack={() => setCurrentApp(null)} />,
    结缘:     <ErrorBoundary><ContactsApp  onBack={() => setCurrentApp(null)} onStartChat={startChat} /></ErrorBoundary>,
    美化:     <ErrorBoundary><BeautifyApp  onBack={() => setCurrentApp(null)} onBackgroundChange={setWallpaper} /></ErrorBoundary>,
    files:    <ErrorBoundary><FilesApp     onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    地图:     <ErrorBoundary><MapApp       onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    梦境:     <ErrorBoundary><DreamApp     onBack={() => setCurrentApp(null)} char={chatChar} /></ErrorBoundary>,
    忆海:     <ErrorBoundary><MemoryApp    onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    终端:     <ErrorBoundary><AIConsoleApp onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    世界书:   <ErrorBoundary><WorldbookApp onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    角色系统: <ErrorBoundary><CharLifeApp  onBack={() => setCurrentApp(null)} initialChar={chatChar} /></ErrorBoundary>,
    道枢:     <ErrorBoundary><DaoshuApp    onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    命格:     <ErrorBoundary><MinggeApp    onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    日记:     <ErrorBoundary><DiaryApp     onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
    随笔:     <ErrorBoundary><DiaryApp     onBack={() => setCurrentApp(null)} /></ErrorBoundary>,
  };

  const appNode = currentApp ? (APP_ROUTES[currentApp] ?? <PlaceholderApp appName={currentApp} onBack={() => setCurrentApp(null)} />) : null;

  return (
    <div className="w-[375px] h-[812px] bg-black rounded-[3rem] shadow-2xl border-[8px] border-gray-800 overflow-hidden relative ring-4 ring-gray-300">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-50" />
      <StatusBar />
      <div className="h-[calc(100%-2rem)] bg-white relative overflow-hidden rounded-b-[2.5rem]">
        <AnimatePresence>
          {currentApp === null && (
            <motion.div key="home" className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0.5 }}>
              <HomeScreen onOpenApp={openApp} wallpaper={wallpaper} recentChat={recentChat} onOpenRecentChat={openChatWithChar} />
            </motion.div>
          )}
          {currentApp !== null && (
            <motion.div
              key={currentApp}
              className="w-full h-full absolute"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {appNode}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-500 rounded-full z-50" />
    </div>
  );
}

export default App;
