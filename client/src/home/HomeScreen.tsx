/**
 * HomeScreen — 主屏幕
 *
 * 将原本内联在 App.jsx 的 HomeScreen 提取到独立文件。
 *
 * Props:
 *   onOpenApp        — (appId) => void
 *   wallpaper        — 壁纸 URL 或 null
 *   recentChat       — { char, preview } 或 null
 *   onOpenRecentChat — (char) => void
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Contact, Folder,
  Heart, SlidersHorizontal, Scroll, User,
  Map, BookCopy, Users2, Bot, Users, Brain,
  Palette, Calendar as CalendarIcon, PenSquare, PiggyBank,
  BookOpen, Package, Pencil, Briefcase,
  Moon, Clapperboard, Dice5, Mail, Cat, FileText, Terminal,
} from 'lucide-react';

import AppGrid from './AppGrid.jsx';
import Dock from './Dock.jsx';
import ClockWidget from './widgets/ClockWidget.jsx';
import ChatPreviewWidget from './widgets/ChatPreviewWidget.jsx';
import CalendarWidget from './widgets/CalendarWidget.jsx';

// ── Dock 配置 ────────────────────────────────────────────────────────────
const DOCK_APPS = [
  { id: 'contacts', name: '通讯录',  icon: Contact  },
  { id: '终端',     name: 'AI终端',  icon: Terminal },
  { id: 'files',    name: '文件管理', icon: Folder   },
  { id: 'settings', name: '设置',    icon: Settings },
];

// ── 页面配置 ─────────────────────────────────────────────────────────────
const PAGES = [
  // Page 1 — 核心功能
  [
    { id: 'widget-clock',        type: 'widget', component: ClockWidget,       gridPos: '1 / 1 / 3 / 5' },
    { id: 'widget-chat-preview', type: 'widget', component: ChatPreviewWidget, gridPos: '3 / 1 / 4 / 5' },
    { id: '结缘',    name: '结缘',    icon: Heart,             gridPos: '4 / 1 / 5 / 2' },
    { id: '元系统',  name: '元系统',  icon: SlidersHorizontal, gridPos: '4 / 2 / 5 / 3' },
    { id: '知识库',  name: '知识库',  icon: BookCopy,          gridPos: '4 / 3 / 5 / 4' },
    { id: '命格',    name: '命格',    icon: User,              gridPos: '4 / 4 / 5 / 5' },
    { id: '地图',    name: '地图',    icon: Map,               gridPos: '5 / 1 / 6 / 2' },
    { id: '忆海',    name: '忆海',    icon: Brain,             gridPos: '5 / 2 / 6 / 3' },
    { id: '群聊',    name: '群聊',    icon: Users2,            gridPos: '5 / 3 / 6 / 4' },
    { id: '角色系统', name: '角色系统', icon: Bot,             gridPos: '5 / 4 / 6 / 5' },
    { id: '社区',    name: '社区',    icon: Users,             gridPos: '6 / 1 / 7 / 2' },
    { id: 'npc管理', name: 'NPC管理', icon: Users,             gridPos: '6 / 2 / 7 / 3' },
  ],
  // Page 2 — 生活工具
  [
    { id: '美化',     name: '美化',     icon: Palette,      gridPos: '1 / 1 / 2 / 2' },
    { id: '日历',     name: '日历',     icon: CalendarIcon,  gridPos: '1 / 2 / 2 / 3' },
    { id: '随想',     name: '随想',     icon: PenSquare,    gridPos: '1 / 3 / 2 / 4' },
    { id: '记账',     name: '记账',     icon: PiggyBank,    gridPos: '1 / 4 / 2 / 5' },
    { id: '日记',     name: '日记',     icon: BookOpen,     gridPos: '2 / 1 / 3 / 2' },
    { id: '物品库',   name: '物品库',   icon: Package,      gridPos: '2 / 2 / 3 / 3' },
    { id: '创作',     name: '创作',     icon: Pencil,       gridPos: '2 / 3 / 3 / 4' },
    { id: '异世界之旅', name: '异世界之旅', icon: Briefcase, gridPos: '2 / 4 / 3 / 5' },
    { id: 'npc管理',  name: 'NPC管理',  icon: Users,        gridPos: '3 / 1 / 4 / 2' },
    { id: '珍藏',     name: '珍藏',     icon: Heart,        gridPos: '3 / 2 / 4 / 3' },
    { id: 'widget-calendar', type: 'widget', component: CalendarWidget, gridPos: '4 / 1 / 7 / 5' },
  ],
  // Page 3 — 娱乐/创意
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

export default function HomeScreen({ onOpenApp, wallpaper, recentChat, onOpenRecentChat }) {
  const [currentPage, setCurrentPage] = useState(0);

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' }}
    >
      {wallpaper && (
        <img src={wallpaper} className="absolute inset-0 w-full h-full object-cover" alt="" />
      )}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,var(--desktop-overlay, 0.1))' }} />

      {/* 滑动页面区 */}
      <motion.div
        className="flex-1 flex"
        drag="x"
        dragConstraints={{ left: -375 * (PAGES.length - 1), right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -100) setCurrentPage(p => Math.min(p + 1, PAGES.length - 1));
          if (info.offset.x > 100)  setCurrentPage(p => Math.max(p - 1, 0));
        }}
        animate={{ x: -currentPage * 375 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {PAGES.map((pageItems, i) => (
          <div key={i} className="w-[375px] h-full flex-shrink-0 p-4 pt-8">
            <AppGrid
              items={pageItems}
              onOpen={onOpenApp}
              recentChat={recentChat}
              onOpenRecentChat={onOpenRecentChat}
            />
          </div>
        ))}
      </motion.div>

      {/* 页面指示点 */}
      <div className="h-8 flex justify-center items-center gap-2 z-10">
        {PAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`h-2 rounded-full transition-all ${
              currentPage === i ? 'bg-white w-4' : 'bg-white/40 w-2'
            }`}
          />
        ))}
      </div>

      {/* Dock */}
      <Dock apps={DOCK_APPS} onOpen={onOpenApp} />
    </div>
  );
}
