/**
 * App.jsx — 主入口
 *
 * 重构后职责：
 *   1. 初始化 AppProvider（全局状态）
 *   2. 管理当前显示的 App（currentApp）
 *   3. APP_ROUTES 映射
 *
 * 变化：
 *   - HomeScreen 移至 home/HomeScreen.jsx（含 widgets）
 *   - ChatApp 从 apps/chat/ChatApp.jsx 导入（已拆分）
 *   - chatChar → AppContext.activeChar
 *   - wallpaper → AppContext.wallpaper
 *   - recentChat → AppContext.recentChat
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './core/AppContext.jsx';
import StatusBar from './components/StatusBar';
import ErrorBoundary from './components/ErrorBoundary';
import PlaceholderApp from './components/PlaceholderApp';
import HomeScreen from './home/HomeScreen.jsx';

// ── 拆分后的新 ChatApp ───────────────────────────────────────────
import ChatApp from './apps/chat/ChatApp.jsx';

// ── 其余 App 保持原路径 ──────────────────────────────────────────
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
import CharSystemApp from './apps/CharSystemApp';
import RuleSystemApp from './apps/RuleSystemApp';
import NPCApp        from './apps/NPCApp';
import MinggeApp     from './apps/MinggeApp';
import DiaryApp      from './apps/DiaryApp';
import ItemsApp      from './apps/ItemsApp';
import CharPhoneApp  from './apps/CharPhoneApp';
import SuixiangApp   from './apps/SuixiangApp';
import CalendarApp   from './apps/CalendarApp';
import DafuApp       from './apps/DafuApp';
import TimeCapsuleApp from './apps/TimeCapsuleApp';

// ── 主体（消费 AppContext）────────────────────────────────────────
function AppContent({ currentApp, setCurrentApp }) {
  const {
    activeChar, setActiveChar,
    activePreset, setActivePreset,
    recentChat, updateRecentChat,
    wallpaper, updateWallpaper,
  } = useApp();

  const back = () => setCurrentApp(null);

  const openApp = (id) => {
    if (id === 'chat' && !activeChar) { setCurrentApp('结缘'); return; }
    setCurrentApp(id);
  };

  const startChat = (char) => { setActiveChar(char); setCurrentApp('chat'); };
  const openChatWithChar = (char) => { setActiveChar(char); setCurrentApp('chat'); };

  const APP_ROUTES = {
    chat:     <ErrorBoundary><ChatApp        onBack={back} activePreset={activePreset} initialChar={activeChar} onNewAIMessage={updateRecentChat} onOpenApp={openApp} /></ErrorBoundary>,
    settings: <ErrorBoundary><SettingsApp    onBack={back} onPresetChange={setActivePreset} /></ErrorBoundary>,
    contacts: <PlaceholderApp appName="联系人" onBack={back} />,
    结缘:     <ErrorBoundary><ContactsApp    onBack={back} onStartChat={startChat} /></ErrorBoundary>,
    美化:     <ErrorBoundary><BeautifyApp    onBack={back} onBackgroundChange={updateWallpaper} /></ErrorBoundary>,
    files:    <ErrorBoundary><FilesApp       onBack={back} /></ErrorBoundary>,
    地图:     <ErrorBoundary><MapApp         onBack={back} /></ErrorBoundary>,
    梦境:     <ErrorBoundary><DreamApp       onBack={back} char={activeChar} /></ErrorBoundary>,
    忆海:     <ErrorBoundary><MemoryApp      onBack={back} /></ErrorBoundary>,
    终端:     <ErrorBoundary><AIConsoleApp   onBack={back} /></ErrorBoundary>,
    世界书:   <ErrorBoundary><WorldbookApp   onBack={back} /></ErrorBoundary>,
    角色系统: <ErrorBoundary><CharSystemApp  onBack={back} onOpenApp={openApp} initialChar={activeChar} /></ErrorBoundary>,
    道枢:     <ErrorBoundary><RuleSystemApp  onBack={back} /></ErrorBoundary>,
    律令:     <ErrorBoundary><RuleSystemApp  onBack={back} /></ErrorBoundary>,
    npc管理:  <ErrorBoundary><NPCApp         onBack={back} initialChar={activeChar} /></ErrorBoundary>,
    角色手机: <ErrorBoundary><CharPhoneApp   onBack={() => setCurrentApp('角色系统')} initialChar={activeChar} /></ErrorBoundary>,
    命格:     <ErrorBoundary><MinggeApp      onBack={back} /></ErrorBoundary>,
    物品库:   <ErrorBoundary><ItemsApp       onBack={back} /></ErrorBoundary>,
    日记:     <ErrorBoundary><DiaryApp       onBack={back} /></ErrorBoundary>,
    随笔:     <ErrorBoundary><SuixiangApp    onBack={back} /></ErrorBoundary>,
    随想:     <ErrorBoundary><SuixiangApp    onBack={back} /></ErrorBoundary>,
    日历:     <ErrorBoundary><CalendarApp    onBack={back} /></ErrorBoundary>,
    大富翁:   <ErrorBoundary><DafuApp        onBack={back} /></ErrorBoundary>,
    时光邮局: <ErrorBoundary><TimeCapsuleApp onBack={back} /></ErrorBoundary>,
  };

  const appNode = currentApp
    ? (APP_ROUTES[currentApp] ?? <PlaceholderApp appName={currentApp} onBack={back} />)
    : null;

  return (
    <AnimatePresence>
      {currentApp === null && (
        <motion.div
          key="home"
          className="w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.5 }}
        >
          <HomeScreen
            onOpenApp={openApp}
            wallpaper={wallpaper}
            recentChat={recentChat}
            onOpenRecentChat={openChatWithChar}
          />
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
  );
}

// ── 根组件 ──────────────────────────────────────────────────────
export default function App() {
  const [currentApp, setCurrentApp] = useState(null);

  return (
    <div className="w-[375px] h-[812px] bg-black rounded-[3rem] shadow-2xl border-[8px] border-gray-800 overflow-hidden relative ring-4 ring-gray-300">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-50" />
      <StatusBar />
      <div className="h-[calc(100%-2rem)] bg-white relative overflow-hidden rounded-b-[2.5rem]">
        <AppProvider onNavigate={setCurrentApp}>
          <AppContent currentApp={currentApp} setCurrentApp={setCurrentApp} />
        </AppProvider>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-500 rounded-full z-50" />
    </div>
  );
}
