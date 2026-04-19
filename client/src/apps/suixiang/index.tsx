/**
 * 随想 App 入口
 * - 默认进入溪流场景模式
 * - 右上角切换图标可切换到传统卡片列表模式
 * - 卡片数据在此统一加载，两个视图共享同一份数据
 */
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WaterScene    from './WaterScene';
import CardListView  from './CardListView';
import FlowEditor    from './FlowEditor';
import { Card, api } from './types';

type Mode = 'scene' | 'card' | 'editor';

export default function SuixiangApp({ onBack }: { onBack: () => void }) {
  const [cards, setCards]   = useState<Card[]>([]);
  const [mode, setMode]     = useState<Mode>('scene');

  const loadCards = async () => {
    const data = await api('/suixiang/cards');
    setCards(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadCards(); }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">

        {mode === 'scene' && (
          <motion.div key="scene" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <WaterScene
              cards={cards}
              onBack={onBack}
              onSwitchMode={() => setMode('card')}
              onOpenEditor={() => setMode('editor')}
              onCardUpdate={loadCards}
            />
          </motion.div>
        )}

        {mode === 'card' && (
          <motion.div key="card" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <CardListView
              cards={cards}
              onBack={onBack}
              onSwitchMode={() => setMode('scene')}
              onCardUpdate={loadCards}
            />
          </motion.div>
        )}

        {mode === 'editor' && (
          <motion.div key="editor" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3 }}
          >
            <FlowEditor onBack={() => setMode('scene')} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
