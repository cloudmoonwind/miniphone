import { ChevronLeft } from 'lucide-react';

// Per-app visual configs: gradient + description + decorative element
const APP_VISUALS = {
  '群聊': {
    gradient: 'from-teal-400 to-cyan-500',
    emoji: '💬',
    desc: '与多位角色同时畅聊',
    detail: '群聊功能将支持多角色实时对话、场景选择和团体故事。',
  },
  '大富翁': {
    gradient: 'from-amber-400 to-orange-500',
    emoji: '🎲',
    desc: '角色与你共玩命运的游戏',
    detail: '大富翁棋盘随机事件由世界书驱动，每局都是不同的故事。',
  },
  '时光邮局': {
    gradient: 'from-rose-400 to-pink-500',
    emoji: '✉️',
    desc: '给未来或过去的自己寄一封信',
    detail: '设定解锁日期，在特定时刻收到来自角色或自己的信件。',
  },
  '无限流': {
    gradient: 'from-violet-500 to-purple-600',
    emoji: '📽️',
    desc: '无限穿越世界的旅行者',
    detail: '每次进入都是一个全新世界——你的选择书写剧情走向。',
  },
  '养宠': {
    gradient: 'from-green-400 to-emerald-500',
    emoji: '🐾',
    desc: '陪伴你的虚拟生命',
    detail: '角色的宠物会随时间成长，对话中的互动影响宠物状态。',
  },
  '约会': {
    gradient: 'from-pink-400 to-rose-400',
    emoji: '🌸',
    desc: '精心策划与角色的特别时光',
    detail: '地图、天气、道枢数值共同决定约会的氛围和走向。',
  },
  'ta的秘密': {
    gradient: 'from-slate-500 to-gray-700',
    emoji: '🔐',
    desc: '隐藏在对话深处的故事碎片',
    detail: '随关系深入逐渐解锁的角色隐藏记忆与秘密档案。',
  },
  '异世界之旅': {
    gradient: 'from-indigo-400 to-blue-500',
    emoji: '🗺️',
    desc: '踏入角色世界的第一步',
    detail: '结合地图与世界书，在角色所在的世界展开探索之旅。',
  },
  '创作': {
    gradient: 'from-yellow-400 to-amber-500',
    emoji: '✍️',
    desc: '与角色共同创作你们的故事',
    detail: '协作写作、角色扮演剧本、AI辅助续写——一切皆可创作。',
  },
  '社区': {
    gradient: 'from-blue-400 to-indigo-500',
    emoji: '🌐',
    desc: '发现他人创作的角色与世界',
    detail: '分享角色设定、世界书、日记——与同好建立连接。',
  },
  'npc管理': {
    gradient: 'from-cyan-400 to-teal-500',
    emoji: '🧑‍🤝‍🧑',
    desc: '管理你世界中的所有人物',
    detail: '统一管理角色、NPC、群像关系网络。',
  },
  '珍藏': {
    gradient: 'from-amber-300 to-yellow-500',
    emoji: '⭐',
    desc: '珍藏那些不想忘记的瞬间',
    detail: '收藏对话片段、生活日志、特别记忆——留住重要时刻。',
  },
  '物品库': {
    gradient: 'from-stone-400 to-gray-500',
    emoji: '🎒',
    desc: '世界中流转的物件与故事',
    detail: '角色送出的礼物、解锁的物品，每件都有它的故事。',
  },
  '记账': {
    gradient: 'from-green-500 to-teal-600',
    emoji: '💰',
    desc: '现实与虚拟世界的资产记录',
    detail: '记录日常开销，也可以记录角色世界的金币积累。',
  },
  '日历': {
    gradient: 'from-sky-400 to-blue-500',
    emoji: '📅',
    desc: '时间的两条线同步流动',
    detail: '现实日历与角色时间轴并排，重要约定一目了然。',
  },
};

const DEFAULT_VISUAL = {
  gradient: 'from-gray-400 to-gray-500',
  emoji: '⚙️',
  desc: '功能建设中',
  detail: '这个功能正在开发中，敬请期待。',
};

const PlaceholderApp = ({ appName, onBack, children }) => {
  if (children) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="h-14 bg-white border-b flex items-center px-4 shadow-sm shrink-0">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="text-gray-600" />
          </button>
          <span className="ml-4 font-bold">{appName}</span>
        </div>
        {children}
      </div>
    );
  }

  const visual = APP_VISUALS[appName] || DEFAULT_VISUAL;

  return (
    <div className={`flex flex-col h-full bg-gradient-to-br ${visual.gradient} relative overflow-hidden`}>
      {/* 装饰背景圆 */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-black/10 rounded-full" />

      {/* 顶栏 */}
      <div className="flex items-center px-4 pt-3 pb-2 shrink-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <span className="ml-2 text-white font-bold text-base">{appName}</span>
      </div>

      {/* 中央内容 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 z-10">
        <div className="text-7xl mb-6 drop-shadow-lg">{visual.emoji}</div>
        <h2 className="text-xl font-bold text-white text-center mb-3 drop-shadow">{visual.desc}</h2>
        <p className="text-white/70 text-sm text-center leading-relaxed">{visual.detail}</p>

        <div className="mt-10 flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
          <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
          <span className="text-xs text-white/80 font-medium">开发中</span>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderApp;
