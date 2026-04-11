/**
 * 角色手机 — 全屏独立体验
 *
 * 这是角色的手机，不是用户的。
 * 角色是手机主人 → 角色消息在右边，用户消息在左边。
 *
 * 布局模拟一个真实手机：
 *   - 主屏：app 图标网格（消息、联系人、朋友圈、相册、备忘等）
 *   - 消息：联系人列表 → 点击进入聊天
 *   - 联系人：用户 + 同组角色（NPC）
 *   - 朋友圈：角色生活动态（来自 life store）
 *
 * 数据来源：
 *   - 与用户的聊天 → messages store（已有数据）
 *   - 与 NPC 的聊天 → 未来由 NPC 系统生成
 *   - 朋友圈动态 → life store 的生活日志
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Phone, Search, Send, Camera, MessageCircle,
  Users, Image, FileText, Settings, Bookmark,
  RefreshCw, ChevronLeft, Heart, MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';
import { api } from '../services/api.js';

const MSG_SEP = '\u001E';

/* ── 手机状态栏 ─────────────────────────────────────────────────── */
const PhoneStatusBar = () => {
  const now = new Date();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <div className="flex items-center justify-between px-5 pt-1.5 pb-1 text-white/50 text-[10px] shrink-0">
      <span>{time}</span>
      <div className="w-20 h-4 bg-gray-900/80 rounded-full" />
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5 items-end h-3">
          {[2,3,4,5].map(h => <div key={h} className="w-1 rounded-sm bg-white/50" style={{ height: `${h * 2.5}px` }} />)}
        </div>
        <div className="w-5 h-2.5 border border-white/40 rounded-sm relative">
          <div className="absolute inset-[1.5px] rounded-sm bg-white/50" style={{ width: '60%' }} />
          <div className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-[2.5px] h-1.5 bg-white/30 rounded-r-sm" />
        </div>
      </div>
    </div>
  );
};

/* ── 手机主屏 ── */
const HomeScreen = ({ char, onOpenScreen, onLongPress }) => {
  const longPressTimer = useRef(null);
  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => onLongPress?.(), 700);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const apps = [
    { id: 'messages', name: '消息',   icon: MessageCircle, color: '#22d3ee' },
    { id: 'contacts', name: '联系人', icon: Users,         color: '#60a5fa' },
    { id: 'feed',     name: '朋友圈', icon: Heart,         color: '#f472b6' },
    { id: 'gallery',  name: '相册',   icon: Image,         color: '#a78bfa' },
    { id: 'notes',    name: '备忘录', icon: FileText,      color: '#fbbf24' },
    { id: 'bookmarks',name: '收藏',   icon: Bookmark,      color: '#34d399' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* 角色壁纸区域（长按返回角色系统） */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 select-none"
        style={{ background: 'linear-gradient(160deg, #1a1a2e, #16213e, #0f3460)' }}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}>
        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur overflow-hidden border border-white/20 shadow-xl mb-3">
          <Avatar value={char?.avatar} name={char?.name} size={64} rounded />
        </div>
        <p className="text-white/80 font-medium text-lg">{char?.name}的手机</p>
        <p className="text-white/30 text-xs mt-1">长按返回角色系统</p>
      </div>

      {/* App 网格 */}
      <div className="bg-gray-950 px-6 py-5">
        <div className="grid grid-cols-3 gap-4">
          {apps.map(app => (
            <button key={app.id} onClick={() => onOpenScreen(app.id)}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: `${app.color}20`, border: `1px solid ${app.color}30` }}>
                <app.icon size={22} style={{ color: app.color }} />
              </div>
              <span className="text-white/60 text-[10px]">{app.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── 消息/联系人列表 ── */
const ContactsList = ({ char, contacts, onOpenChat, onBack }) => (
  <div className="flex-1 flex flex-col bg-gray-950">
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 shrink-0">
      <button onClick={onBack} className="p-1 hover:bg-gray-800 rounded-lg"><ArrowLeft size={16} className="text-white/60" /></button>
      <span className="text-white font-bold text-base flex-1">消息</span>
    </div>
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-3 py-2">
        <Search size={13} className="text-gray-600" />
        <span className="text-gray-600 text-xs">搜索</span>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">
      {contacts.map(c => (
        <button key={c.id} onClick={() => onOpenChat(c)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-900/50 transition-colors border-b border-gray-900/30">
          <div className="relative">
            <Avatar value={c.avatar} name={c.name} size={40} rounded />
            {c.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-gray-950" />}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-sm font-medium">{c.name}</p>
            <p className="text-gray-500 text-xs truncate">{c.lastMsg}</p>
          </div>
          {c.msgCount > 0 && (
            <span className="text-[10px] text-gray-500">{c.msgCount}条</span>
          )}
        </button>
      ))}
      {contacts.length <= 1 && (
        <div className="text-center py-10">
          <Users size={20} className="text-gray-700 mx-auto mb-2" />
          <p className="text-gray-600 text-xs">同世界的角色会出现在这里</p>
          <p className="text-gray-700 text-[10px] mt-1">给角色分配相同的分组</p>
        </div>
      )}
    </div>
  </div>
);

/* ── 聊天界面 ── */
const ChatScreen = ({ char, contact, onBack }) => {
  const [msgs, setMsgs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (contact.isUser) {
        try {
          const data = await api.get(`/api/characters/${char.id}/messages`);
          setMsgs((data || []).sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)).slice(-50));
        } catch { setMsgs([]); }
      } else {
        // NPC 对话暂无数据
        setMsgs([]);
      }
      setLoading(false);
    })();
  }, [char, contact]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  return (
    <div className="flex-1 flex flex-col bg-gray-950 min-h-0">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-900/80 border-b border-gray-800/50 shrink-0">
        <button onClick={onBack} className="p-1 hover:bg-gray-800 rounded-lg"><ArrowLeft size={16} className="text-white/60" /></button>
        <Avatar value={contact.avatar} name={contact.name} size={28} rounded />
        <div className="flex-1">
          <p className="text-white text-sm font-medium">{contact.name}</p>
          <p className={`text-[10px] ${contact.online ? 'text-green-400/70' : 'text-gray-600'}`}>{contact.online ? '在线' : '离线'}</p>
        </div>
        <Phone size={15} className="text-white/30" />
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {loading && <div className="flex justify-center py-8"><RefreshCw size={14} className="animate-spin text-gray-600" /></div>}
        {!loading && msgs.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle size={20} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-600 text-xs">
              {contact.isUser ? '还没有聊天记录' : `和${contact.name}还没聊过天`}
            </p>
            {!contact.isUser && <p className="text-gray-700 text-[10px] mt-1">NPC 对话会在角色生活中自然产生</p>}
          </div>
        )}
        {msgs.map(m => {
          // 角色视角：char 消息在右（手机主人），user 消息在左
          const isOwner = m.sender !== 'user';
          const layers = m.content?.includes(MSG_SEP) ? m.content.split(MSG_SEP).filter(Boolean) : [m.content || ''];
          return (
            <div key={m.id} className={`flex gap-2 ${isOwner ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isOwner && (
                <Avatar value={contact.avatar} name={contact.name} size={24} rounded className="shrink-0 mt-auto" />
              )}
              <div className={`max-w-[72%] flex flex-col ${isOwner ? 'items-end' : 'items-start'}`}>
                {layers.map((layer, i) => (
                  <div key={i} className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed mb-0.5
                    ${isOwner
                      ? 'bg-indigo-500 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700/30'
                    }`}>{layer}</div>
                ))}
                <span className="text-[9px] text-gray-600 px-1 mt-0.5">{(m.userTimestamp || m.timestamp)?.slice(11, 16)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 输入栏（只读） */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-900/80 border-t border-gray-800/50 shrink-0">
        <div className="flex-1 bg-gray-800 rounded-full px-3 py-1.5 text-gray-500 text-xs">输入消息…</div>
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <Send size={12} className="text-indigo-400" />
        </div>
      </div>
    </div>
  );
};

/* ── 朋友圈 ── */
const FeedScreen = ({ char, onBack }) => {
  const [lifeLogs, setLifeLogs] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/characters/${char.id}/life?limit=10`);
        setLifeLogs(data || []);
      } catch { setLifeLogs([]); }
      setLoading(false);
    })();
  }, [char]);

  return (
    <div className="flex-1 flex flex-col bg-gray-950">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-900/80 border-b border-gray-800/50 shrink-0">
        <button onClick={onBack} className="p-1 hover:bg-gray-800 rounded-lg"><ArrowLeft size={16} className="text-white/60" /></button>
        <span className="text-white text-sm font-medium flex-1">朋友圈</span>
        <Camera size={15} className="text-white/30" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 头像封面 */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar value={char?.avatar} name={char?.name} size={48} rounded />
          <div>
            <p className="text-white/80 text-sm font-medium">{char?.name}</p>
            <p className="text-gray-600 text-[10px]">的朋友圈</p>
          </div>
        </div>

        {loading && <div className="flex justify-center py-8"><RefreshCw size={14} className="animate-spin text-gray-600" /></div>}

        {!loading && lifeLogs.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 text-xs">暂时还没有动态</p>
            <p className="text-gray-700 text-[10px] mt-1">生成角色日常生活后，动态会出现在这里</p>
          </div>
        )}

        {lifeLogs.map(log => (
          <div key={log.id} className="bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Avatar value={char?.avatar} name={char?.name} size={28} rounded />
              <div className="flex-1">
                <p className="text-white/70 text-xs font-medium">{char?.name}</p>
                <p className="text-gray-600 text-[9px]">
                  {log.period || log.generatedAt?.slice(0, 10)}
                  {log.timeOfDay && ` · ${({ morning: '早晨', afternoon: '下午', evening: '傍晚', night: '深夜' })[log.timeOfDay] || log.timeOfDay}`}
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{log.content}</p>
            {log.summary && (
              <p className="text-gray-500 text-[10px] mt-2 italic">— {log.summary}</p>
            )}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-800/30">
              <button className="flex items-center gap-1 text-gray-600 text-[10px] hover:text-pink-400 transition-colors">
                <Heart size={10} /> 赞
              </button>
              <button className="flex items-center gap-1 text-gray-600 text-[10px] hover:text-blue-400 transition-colors">
                <MessageSquare size={10} /> 评论
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
 * 主组件
 * ═══════════════════════════════════════════════════════════════════ */
export default function CharPhoneApp({ onBack, initialChar }) {
  const [chars, setChars]       = useState([]);
  const [char, setChar]         = useState(null);
  const [screen, setScreen]     = useState('home'); // home | messages | chat | contacts | feed | gallery | notes | bookmarks
  const [activeContact, setActiveContact] = useState(null);

  useEffect(() => {
    api.get('/api/characters').then(data => {
      const list = Array.isArray(data) ? data : [];
      setChars(list);
      setChar(initialChar ? (list.find(c => c.id === initialChar.id) || list[0]) : list[0] || null);
    }).catch(() => {});
  }, [initialChar]);

  // 构建联系人列表
  const contacts = useMemo(() => {
    if (!char) return [];
    const list = [{ id: 'user', name: '你', avatar: '', isUser: true, lastMsg: '点击查看聊天记录', online: true, msgCount: 0 }];
    if (char.group) {
      (chars || []).filter(c => c.id !== char.id && c.group === char.group).forEach(c => {
        list.push({
          id: c.id, name: c.name, avatar: c.avatar || '',
          isUser: false, lastMsg: '还没有聊过', online: Math.random() > 0.5, msgCount: 0,
        });
      });
    }
    return list;
  }, [char, chars]);

  const openChat = (contact) => {
    setActiveContact(contact);
    setScreen('chat');
  };

  const goBack = () => {
    if (screen === 'chat') { setScreen('messages'); setActiveContact(null); }
    else if (screen === 'home') onBack();
    else setScreen('home');
  };

  if (!char) return (
    <div className="flex flex-col h-full bg-gray-950 items-center justify-center">
      <p className="text-gray-500 text-sm">没有选择角色</p>
      <button onClick={onBack} className="mt-2 text-cyan-400 text-xs">返回</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <PhoneStatusBar />
      <AnimatePresence mode="wait">
        <motion.div key={screen + (activeContact?.id || '')}
          className="flex-1 flex flex-col overflow-hidden min-h-0"
          initial={{ opacity: 0, x: screen === 'home' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}>
          {screen === 'home' && (
            <HomeScreen char={char} onOpenScreen={(s) => setScreen(s)} onLongPress={onBack} />
          )}
          {(screen === 'messages' || screen === 'contacts') && (
            <ContactsList char={char} contacts={contacts} onOpenChat={openChat} onBack={goBack} />
          )}
          {screen === 'chat' && activeContact && (
            <ChatScreen char={char} contact={activeContact} onBack={goBack} />
          )}
          {screen === 'feed' && (
            <FeedScreen char={char} onBack={goBack} />
          )}
          {(screen === 'gallery' || screen === 'notes' || screen === 'bookmarks') && (
            <div className="flex-1 flex flex-col bg-gray-950">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 shrink-0">
                <button onClick={goBack} className="p-1 hover:bg-gray-800 rounded-lg"><ArrowLeft size={16} className="text-white/60" /></button>
                <span className="text-white font-bold text-base">{
                  screen === 'gallery' ? '相册' : screen === 'notes' ? '备忘录' : '收藏'
                }</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-600 text-xs">功能开发中…</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 底部指示器 */}
      <div className="flex justify-center py-1.5 bg-gray-950 shrink-0">
        <button onClick={goBack} className="w-24 h-1 bg-gray-800 rounded-full hover:bg-gray-600 transition-colors" />
      </div>
    </div>
  );
}
