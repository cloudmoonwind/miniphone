/**
 * AppContext.tsx — 全局应用状态
 *
 * 替代 App.jsx 中散落的顶层状态，提供统一的全局访问。
 *
 * 提供：
 *   activeChar       — 当前活跃角色（聊天对象 / 系统查看对象）
 *   setActiveChar    — 切换角色
 *   activePreset     — 当前活跃 API 预设
 *   setActivePreset  — 切换预设（SettingsApp 调用）
 *   wallpaper        — 主屏壁纸 URL
 *   updateWallpaper  — 更新壁纸
 *   recentChat       — 最近聊天 { char, preview }（首页 widget）
 *   updateRecentChat — 更新最近聊天（ChatApp 调用）
 *   navigate         — 导航到 App（由 App.jsx 注入实现）
 *
 * BRIDGE[CharPhone → activeChar]：CharPhoneApp 通过 initialChar prop
 *   传入角色，暂时仍依赖 prop。后续可改为直接从 useApp().activeChar 读取。
 *
 * BRIDGE[preset → chat]：ChatApp 通过 activePreset prop 获取预设，
 *   后续应直接从 useApp().activePreset 读取，去除 prop 传递。
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/settings.js';
import { eventBus } from './eventBus.js';
import type { Character, ApiPreset, AppContextValue } from '../types/index.js';

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, onNavigate }: { children: React.ReactNode; onNavigate: (appId: string) => void }) {
  const [activeChar, _setActiveChar] = useState<Character | null>(null);
  const [activePreset, setActivePreset] = useState<ApiPreset | null>(null);
  const [wallpaper, setWallpaperState] = useState<string | null>(
    () => localStorage.getItem('ics_wallpaper') || null
  );
  const [recentChat, setRecentChatState] = useState<{ char: Character; preview: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem('ics_recent_chat') || 'null'); }
    catch { return null; }
  });

  useEffect(() => {
    settingsService.getActivePreset()
      .then(p => { if (p) setActivePreset(p); })
      .catch(() => {});
  }, []);

  const setActiveChar = useCallback((char: Character | null) => {
    _setActiveChar(char);
    eventBus.emit('char:activated', { char });
  }, []);

  const updateWallpaper = useCallback((url: string | null) => {
    setWallpaperState(url);
    try { localStorage.setItem('ics_wallpaper', url || ''); } catch {}
  }, []);

  const updateRecentChat = useCallback((char: Character, content: string) => {
    const recent = { char, preview: content };
    setRecentChatState(recent);
    try { localStorage.setItem('ics_recent_chat', JSON.stringify(recent)); } catch {}
    eventBus.emit('recentChat:update', recent);
  }, []);

  const navigate = useCallback((appId: string, params: { char?: Character } = {}) => {
    if (params.char) setActiveChar(params.char);
    onNavigate(appId);
  }, [onNavigate, setActiveChar]);

  // 监听角色更新事件，若更新的是当前角色则同步
  useEffect(() => {
    return eventBus.on('char:updated', ({ char }) => {
      _setActiveChar(prev => prev?.id === char?.id ? char : prev);
    });
  }, []);

  // 监听预设切换
  useEffect(() => {
    return eventBus.on('preset:changed', (preset) => {
      setActivePreset(preset);
    });
  }, []);

  const value: AppContextValue = {
    activeChar, setActiveChar,
    activePreset, setActivePreset,
    wallpaper, updateWallpaper,
    recentChat, updateRecentChat,
    navigate,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
