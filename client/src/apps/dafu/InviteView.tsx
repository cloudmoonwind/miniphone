/**
 * InviteView.jsx — Sending invite to character, showing response
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';
import { THEME, api } from './theme.js';

export default function InviteView({ setup, onAccepted, onDeclined }) {
  const [status, setStatus] = useState('sending');
  const [reply, setReply] = useState('');
  const [accepted, setAccepted] = useState(false);
  const t = THEME[setup.mode] || THEME['恋爱'];

  useEffect(() => {
    api('/invite', {
      method: 'POST',
      body: JSON.stringify({
        charId: setup.char.id,
        mode: setup.mode,
        playType: setup.playType,
      }),
    })
      .then(d => {
        setReply(d.reply || '好啊，一起来玩吧！');
        setAccepted(d.accepted !== false);
        setStatus('replied');
      })
      .catch(() => {
        setReply('好啊，一起来玩吧！');
        setAccepted(true);
        setStatus('replied');
      });
  }, []);

  const modeLabel = {
    '益智': '华尔街征途',
    '恋爱': '约会之旅',
    '十八禁': '欲望迷宫',
  }[setup.mode] || setup.mode;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 20px',
      gap: 0,
      background: t.bg,
    }}>
      <AnimatePresence mode="wait">
        {status === 'sending' ? (
          <motion.div
            key="sending"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              padding: '0 24px',
            }}
          >
            {/* Animated envelope / invitation */}
            <div style={{
              width: 70,
              height: 70,
              borderRadius: 20,
              background: `${t.accent}15`,
              border: `2px solid ${t.accent}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}>
              <Avatar value={setup.char.avatar} name={setup.char.name} size={42} rounded />
              {/* Sending pulse */}
              <motion.div
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{
                  position: 'absolute',
                  inset: -8,
                  borderRadius: 28,
                  border: `2px solid ${t.accent}`,
                  pointerEvents: 'none',
                }} />
            </div>

            <Loader2
              size={20}
              className="animate-spin"
              style={{ color: `${t.accent}70` }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.75)',
                marginBottom: 6,
              }}>
                正在向 {setup.char.name} 发送邀请…
              </p>
              <div style={{
                display: 'inline-flex',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: `${t.accent}10`,
                border: `1px solid ${t.accent}20`,
              }}>
                <span style={{ fontSize: 10, color: t.accent, opacity: 0.8 }}>
                  {modeLabel}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>·</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  {setup.playType}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="replied"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            style={{ width: '100%' }}
          >
            {/* Character header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              padding: '0 4px',
            }}>
              <Avatar value={setup.char.avatar} name={setup.char.name} size={38} rounded />
              <div>
                <p style={{ fontSize: 14, fontWeight: 'bold', color: 'white', marginBottom: 2 }}>
                  {setup.char.name}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  对你的邀请回复了
                </p>
              </div>
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 20,
                background: accepted ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${accepted ? '#16a34a40' : '#ef444430'}`,
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: accepted ? '#4ade80' : '#f87171',
                }} />
                <span style={{
                  fontSize: 9,
                  color: accepted ? '#4ade80' : '#f87171',
                  fontWeight: 'bold',
                }}>
                  {accepted ? '同意' : '婉拒'}
                </span>
              </div>
            </div>

            {/* Reply bubble */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                borderRadius: 16,
                padding: '14px 16px',
                marginBottom: 20,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${t.accent}25`,
                position: 'relative',
              }}
            >
              {/* Bubble pointer */}
              <div style={{
                position: 'absolute',
                top: -7,
                left: 22,
                width: 12,
                height: 8,
                background: 'rgba(255,255,255,0.05)',
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              }} />
              <p style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.7,
              }}>
                {reply}
              </p>
            </motion.div>

            {/* Action button */}
            {accepted ? (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onAccepted}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 16,
                  fontSize: 15,
                  fontWeight: 'bold',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  background: `linear-gradient(135deg, ${t.accent}, ${t.cellProp})`,
                  boxShadow: `0 4px 16px ${t.accent}25`,
                }}
              >
                开始游戏
              </motion.button>
            ) : (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onDeclined}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 16,
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                }}
              >
                重新选择
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
