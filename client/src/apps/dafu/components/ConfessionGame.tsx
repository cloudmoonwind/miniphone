/**
 * ConfessionGame.jsx — 恋爱 mode confession mini-game
 * Shows when mode==='恋爱' AND waitingFor==='special'
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { THEME } from '../theme.js';

const TEMPLATES = [
  '我喜欢你',
  '做我女朋友吧',
  '我想和你在一起',
  '你是我想找的人',
];

export default function ConfessionGame({ game, onSubmit, onClose }) {
  const theme = THEME['恋爱'];
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState(null); // { text, sentiment: 'success'|'pending'|'failure' }

  const charP = game?.players?.find(p => p.id === 'char');
  const context = game?.currentNarrative || '';

  const handleSubmit = async () => {
    const msg = text.trim();
    if (!msg || submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit(msg);
      // Parse sentiment from the game response
      const lastLog = result?.game?.log?.slice(-1)[0];
      const replyText = lastLog?.text || '…';
      // Simple sentiment heuristic
      const successWords = ['好', '愿意', '喜欢', '答应', '可以', '同意', '开心', '感动'];
      const failWords = ['不', '拒绝', '不行', '算了', '别'];
      const isSuccess = successWords.some(w => replyText.includes(w));
      const isFail = failWords.some(w => replyText.includes(w));
      setResponse({
        text: replyText,
        sentiment: isSuccess ? 'success' : isFail ? 'failure' : 'pending',
      });
    } catch {
      setResponse({ text: '…', sentiment: 'pending' });
    } finally {
      setSubmitting(false);
    }
  };

  const sentimentConfig = {
    success: {
      icon: '💝',
      title: '心动了！',
      color: '#f472b6',
      bg: 'rgba(244,114,182,0.12)',
      border: 'rgba(244,114,182,0.35)',
    },
    pending: {
      icon: '💭',
      title: '她还在考虑…',
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.1)',
      border: 'rgba(167,139,250,0.3)',
    },
    failure: {
      icon: '💔',
      title: '暂时还不行呢',
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.08)',
      border: 'rgba(148,163,184,0.2)',
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Floating hearts background */}
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          position: 'absolute',
          fontSize: 16,
          opacity: 0.08,
          animation: `float-heart-${i} ${5 + i}s ease-in-out infinite`,
          animationDelay: `${i * 0.8}s`,
          left: `${15 + i * 16}%`,
          bottom: `${10 + (i % 3) * 15}%`,
          pointerEvents: 'none',
        }}>
          ♥
        </div>
      ))}

      <motion.div
        initial={{ scale: 0.75, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 25 }}
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'linear-gradient(160deg, #160a20, #2a0e38)',
          border: `1.5px solid ${theme.accent}35`,
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px ${theme.accent}10`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px 12px',
          background: `linear-gradient(135deg, ${theme.accent}12, transparent)`,
          borderBottom: `1px solid ${theme.accent}18`,
          textAlign: 'center',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <p style={{
            fontSize: 10,
            color: theme.accent,
            letterSpacing: 1.5,
            marginBottom: 4,
            opacity: 0.75,
          }}>
            KEY MOMENT
          </p>
          <h3 style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: 'white',
          }}>
            关键时刻
          </h3>
        </div>

        <AnimatePresence mode="wait">
          {response ? (
            /* Response view */
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ padding: '20px 18px 24px' }}
            >
              <div style={{
                padding: '16px',
                borderRadius: 16,
                background: sentimentConfig[response.sentiment].bg,
                border: `1px solid ${sentimentConfig[response.sentiment].border}`,
                textAlign: 'center',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  {sentimentConfig[response.sentiment].icon}
                </div>
                <p style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: sentimentConfig[response.sentiment].color,
                  marginBottom: 10,
                }}>
                  {sentimentConfig[response.sentiment].title}
                </p>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.25)',
                  textAlign: 'left',
                }}>
                  <p style={{ fontSize: 9, color: theme.accent, marginBottom: 4, fontWeight: 'bold' }}>
                    {charP?.name || '她'} 说
                  </p>
                  <p style={{ fontSize: 12, color: theme.text, lineHeight: 1.65 }}>
                    {response.text}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 14,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                }}
              >
                继续游戏
              </button>
            </motion.div>
          ) : (
            /* Input view */
            <motion.div
              key="input"
              style={{ padding: '14px 16px 20px' }}
            >
              {/* Scene context */}
              {context && (
                <div style={{
                  marginBottom: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: `${theme.accent}08`,
                  border: `1px solid ${theme.accent}18`,
                }}>
                  <p style={{
                    fontSize: 11,
                    color: theme.text,
                    lineHeight: 1.6,
                    opacity: 0.7,
                    fontStyle: 'italic',
                  }}>
                    {context.slice(0, 100)}{context.length > 100 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* Template buttons */}
              <p style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                marginBottom: 8,
              }}>
                快速选择
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 12,
              }}>
                {TEMPLATES.map(t => (
                  <button
                    key={t}
                    onClick={() => setText(t)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      background: text === t ? `${theme.accent}22` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${text === t ? theme.accent + '50' : 'rgba(255,255,255,0.1)'}`,
                      color: text === t ? theme.accent : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Text input */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="说出你的告白词…"
                  rows={3}
                  style={{
                    width: '100%',
                    borderRadius: 14,
                    padding: '10px 12px',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${theme.accent}25`,
                    color: 'white',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: 1.6,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: 'white',
                  border: 'none',
                  cursor: text.trim() ? 'pointer' : 'not-allowed',
                  background: text.trim()
                    ? `linear-gradient(135deg, ${theme.accent}, #be185d)`
                    : 'rgba(255,255,255,0.08)',
                  opacity: submitting ? 0.6 : 1,
                  boxShadow: text.trim() ? `0 4px 16px ${theme.accent}25` : 'none',
                  transition: 'all 0.3s',
                }}
              >
                {submitting ? '发送中…' : '表白'}
                {!submitting && <Send size={14} style={{ display: 'inline', marginLeft: 6, verticalAlign: 'middle' }} />}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style>{`
        @keyframes float-heart-0 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-20px) scale(1.1)} }
        @keyframes float-heart-1 { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-15px) rotate(10deg)} }
        @keyframes float-heart-2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-25px)} }
        @keyframes float-heart-3 { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-18px) rotate(5deg)} }
        @keyframes float-heart-4 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.2)} }
      `}</style>
    </motion.div>
  );
}
