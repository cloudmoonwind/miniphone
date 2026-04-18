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
import { Card, api } from './types';

export default function SuixiangApp({ onBack }: { onBack: () => void }) {
  const [cards, setCards]   = useState<Card[]>([]);
  const [mode, setMode]     = useState<'scene' | 'card'>('scene');

  const loadCards = async () => {
    const data = await api('/suixiang/cards');
    setCards(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadCards(); }, []);

  const switchToCard  = () => setMode('card');
  const switchToScene = () => setMode('scene');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {mode === 'scene' ? (
          <motion.div
            key="scene"
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <WaterScene
              cards={cards}
              onBack={onBack}
              onSwitchMode={switchToCard}
              onCardUpdate={loadCards}
            />
          </motion.div>
        ) : (
          <motion.div
            key="card"
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <CardListView
              cards={cards}
              onBack={onBack}
              onSwitchMode={switchToScene}
              onCardUpdate={loadCards}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
