/**
 * DramaPanel.jsx — Narrative / choices area
 * Mode-specific backgrounds, typewriter text, choice buttons, chat input
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';
import { THEME } from '../theme.js';

// Typewriter hook
function useTypewriter(text, speed = 20) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!text) { setDisplayed(''); setDone(true); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(timerRef.current); setDone(true); }
    }, speed);
    return () => clearInterval(timerRef.current);
  }, [text, speed]);

  return { displayed, done };
}

// Atmosphere bar (十八禁 only)
function AtmosphereBar({ value, mode }) {
  const theme = THEME[mode];
  return (
    <div style={{
      padding: '6px 14px 4px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      borderBottom: `1px solid rgba(255,255,255,0.04)`,
    }}>
      <span style={{ fontSize: 10 }}>❄️</span>
      <div style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, value))}%`,
          borderRadius: 2,
          background: 'linear-gradient(90deg, #60a5fa, #a855f7, #ef4444)',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
        <div style={{
          position: 'absolute',
          top: -2,
          left: `${Math.max(0, Math.min(100, value))}%`,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'white',
          transform: 'translateX(-50%)',
          transition: 'left 0.8s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 0 6px rgba(255,255,255,0.5)',
        }} />
      </div>
      <span style={{ fontSize: 10 }}>🔥</span>
      <span style={{
        fontSize: 9,
        color: 'rgba(255,255,255,0.3)',
        minWidth: 24,
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

// Floating petals (恋爱 mode)
function FloatingPetals() {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: '50% 0 50% 0',
          background: `rgba(244,114,182,${0.15 + i * 0.05})`,
          top: `${10 + i * 18}%`,
          right: `${5 + i * 4}%`,
          animation: `petal-fall-${i} ${6 + i * 2}s ease-in-out infinite`,
          animationDelay: `${i * 1.5}s`,
          pointerEvents: 'none',
        }} />
      ))}
      <style>{`
        @keyframes petal-fall-0 { 0%,100%{transform:translateY(0) rotate(0deg);opacity:0.5} 50%{transform:translateY(18px) rotate(20deg);opacity:0.8} }
        @keyframes petal-fall-1 { 0%,100%{transform:translateY(0) rotate(10deg);opacity:0.4} 50%{transform:translateY(14px) rotate(-15deg);opacity:0.7} }
        @keyframes petal-fall-2 { 0%,100%{transform:translateY(0) rotate(-5deg);opacity:0.35} 50%{transform:translateY(22px) rotate(25deg);opacity:0.65} }
        @keyframes petal-fall-3 { 0%,100%{transform:translateY(0) rotate(15deg);opacity:0.3} 50%{transform:translateY(10px) rotate(-10deg);opacity:0.6} }
      `}</style>
    </>
  );
}

// Candlelight border (十八禁)
function CandleflickBorder({ accent }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      animation: 'candleflick 3s ease-in-out infinite',
      border: `1px solid ${accent}30`,
    }}>
      <style>{`
        @keyframes candleflick {
          0%,100% { border-color: ${accent}30; box-shadow: inset 0 0 20px ${accent}05; }
          33% { border-color: ${accent}50; box-shadow: inset 0 0 30px ${accent}08; }
          66% { border-color: ${accent}25; box-shadow: inset 0 0 15px ${accent}04; }
        }
      `}</style>
    </div>
  );
}

// Choice buttons per mode
function ChoiceButton({ choice, index, mode, onClick, disabled }) {
  const theme = THEME[mode] || THEME['恋爱'];

  let prefix = choice.key;
  let suffix = '';
  let bgOverride = null;
  let borderOverride = null;

  if (mode === '恋爱') {
    const prefixes = ['💝 主动', '🌸 温柔', '💬 聊天'];
    prefix = prefixes[index] || choice.key;
  } else if (mode === '十八禁') {
    suffix = index === 0 ? ' 🔥' : index === 1 ? ' ✨' : ' ❄️';
    if (index === 0) {
      borderOverride = '#ef4444';
      bgOverride = 'rgba(239,68,68,0.12)';
    }
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(choice.key)}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: mode === '恋爱' ? 20 : mode === '益智' ? 8 : 12,
        textAlign: 'left',
        background: bgOverride || theme.choiceBg,
        border: `1px solid ${borderOverride || theme.choiceBorder}50`,
        color: theme.text,
        fontSize: 13,
        lineHeight: 1.55,
        marginBottom: 7,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        transition: 'all 0.2s',
      }}
    >
      {mode === '益智' ? (
        <span style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 4,
          background: `${theme.choiceBorder}25`,
          border: `1px solid ${theme.choiceBorder}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 'bold',
          color: theme.accent,
        }}>
          {choice.key}
        </span>
      ) : (
        <span style={{
          fontSize: 11,
          color: theme.accent,
          flexShrink: 0,
          marginTop: 1,
          opacity: 0.85,
        }}>
          {prefix}
        </span>
      )}
      <span style={{ flex: 1 }}>
        {mode !== '益智' && (
          <span style={{ fontSize: 10, color: theme.accent, marginRight: 6 }}>
            {choice.key}
          </span>
        )}
        {choice.text}
        {suffix && (
          <span style={{ marginLeft: 4 }}>{suffix}</span>
        )}
      </span>
    </motion.button>
  );
}

// CharCommentCard: slides from right when narrative done
function CharCommentCard({ charName, text, mode, onDiscuss }) {
  const theme = THEME[mode] || THEME['恋爱'];
  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      style={{
        marginTop: 8,
        padding: '10px 12px',
        borderRadius: 14,
        background: `${theme.accent}10`,
        border: `1px solid ${theme.accent}30`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: theme.accent,
        marginTop: 4,
        flexShrink: 0,
        boxShadow: `0 0 6px ${theme.accent}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 9, color: theme.accent, fontWeight: 'bold', marginBottom: 3 }}>
          {charName} 说
        </p>
        <p style={{ fontSize: 11, color: theme.text, lineHeight: 1.55, opacity: 0.85 }}>
          {text}
        </p>
      </div>
      {onDiscuss && (
        <button onClick={onDiscuss} style={{
          flexShrink: 0,
          fontSize: 10,
          color: theme.accent,
          background: `${theme.accent}15`,
          border: `1px solid ${theme.accent}30`,
          borderRadius: 8,
          padding: '3px 8px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
          和她讨论
        </button>
      )}
    </motion.div>
  );
}

export default function DramaPanel({
  game,
  mode,
  onChoice,
  onEndTurn,
  onChat,
  onBranch,
  charReaction,
  isLoading,
}) {
  const theme = THEME[mode] || THEME['恋爱'];
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [atmosphere, setAtmosphere] = useState(30);
  const scrollRef = useRef(null);

  const wf = game?.waitingFor;
  const curPlayer = game?.players?.[game?.currentPlayerIndex];
  const charP = game?.players?.find(p => p.id === 'char');
  const choices = game?.currentChoices || [];

  const { displayed: narrativeText, done: narrativeDone } = useTypewriter(
    game?.currentNarrative || '', 18
  );

  // Update atmosphere on choice
  const handleChoice = (key) => {
    if (mode === '十八禁') {
      const idx = choices.findIndex(c => c.key === key);
      const delta = idx === 0 ? 15 : idx === 1 ? 5 : -10;
      setAtmosphere(prev => Math.max(0, Math.min(100, prev + delta)));
    }
    onChoice(key);
  };

  // Chat submit
  const handleChatSubmit = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatLoading(true);
    try {
      await onChat(msg);
    } finally {
      setChatLoading(false);
    }
  };

  // Auto-scroll log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [game?.log?.length, narrativeText]);

  // Current cell name for scene label
  const currentCell = game?.cells?.find(c => {
    const curP = game?.players?.[game?.currentPlayerIndex];
    return curP && c.id === curP.position;
  });

  const dramaBackground =
    mode === '益智'
      ? 'rgba(5,15,35,0.97)'
      : mode === '恋爱'
      ? 'rgba(30,10,40,0.97)'
      : 'rgba(10,5,18,0.98)';

  const isWaiting = isLoading || chatLoading;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: dramaBackground,
      borderTop: `1px solid ${theme.accent}20`,
      position: 'relative',
    }}>
      {/* Candlelight border for 十八禁 */}
      {mode === '十八禁' && <CandleflickBorder accent={theme.accent} />}

      {/* Floating petals for 恋爱 */}
      {mode === '恋爱' && <FloatingPetals />}

      {/* Atmosphere bar for 十八禁 */}
      {mode === '十八禁' && <AtmosphereBar value={atmosphere} mode={mode} />}

      {/* Scene label */}
      {currentCell && (
        <div style={{
          padding: '6px 14px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}>
          <div style={{
            width: 3,
            height: 12,
            borderRadius: 2,
            background: theme.accent,
            opacity: 0.7,
          }} />
          <span style={{
            fontSize: 10,
            color: theme.dramaLabelColor,
            letterSpacing: 0.5,
            fontWeight: 'bold',
            opacity: 0.8,
          }}>
            {currentCell.name}
          </span>
        </div>
      )}

      {/* Narrative + log area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 14px 6px',
          scrollbarWidth: 'none',
        }}
      >
        {narrativeText ? (
          <div>
            <p style={{
              fontSize: 9,
              color: theme.dramaLabelColor,
              marginBottom: 6,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontWeight: 'bold',
              opacity: 0.7,
            }}>
              {theme.dramaLabel}
            </p>
            <p style={{
              fontSize: 13,
              color: theme.text,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
            }}>
              {narrativeText}
              {!narrativeDone && (
                <span style={{ opacity: 0.5, animation: 'blink 0.8s step-end infinite' }}>
                  ▋
                </span>
              )}
            </p>

            {/* Char comment card */}
            <AnimatePresence>
              {narrativeDone && charReaction && (
                <CharCommentCard
                  charName={charP?.name || '角色'}
                  text={charReaction}
                  mode={mode}
                  onDiscuss={() => onChat?.('（和你讨论这段剧情）')}
                />
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Chat log */
          <div>
            {(game?.log || []).slice(-6).map((entry, i) => {
              if (entry.type === 'system' || entry.type === 'event') {
                return (
                  <div key={i} style={{
                    textAlign: 'center',
                    margin: '5px 0',
                  }}>
                    <span style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.28)',
                      padding: '2px 10px',
                      borderRadius: 99,
                      background: 'rgba(255,255,255,0.04)',
                    }}>
                      {entry.text}
                    </span>
                  </div>
                );
              }
              if (entry.type === 'narrative') {
                return (
                  <p key={i} style={{
                    fontSize: 12,
                    color: theme.text,
                    lineHeight: 1.75,
                    margin: '6px 0',
                    fontStyle: 'italic',
                    opacity: 0.65,
                    padding: '0 2px',
                  }}>
                    {entry.text}
                  </p>
                );
              }
              if (entry.type === 'roll') {
                return (
                  <p key={i} style={{
                    fontSize: 11,
                    color: theme.accent,
                    textAlign: 'center',
                    margin: '4px 0',
                    opacity: 0.6,
                  }}>
                    {entry.text}
                  </p>
                );
              }
              if (entry.type === 'chat') {
                const isUser = entry.playerId === 'user';
                return (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    margin: '5px 0',
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '7px 11px',
                      borderRadius: 12,
                      background: isUser ? `${theme.cellProp}30` : `${theme.accent}12`,
                      border: `1px solid ${isUser ? theme.cellProp : theme.accent}25`,
                      fontSize: 12,
                      color: theme.text,
                      lineHeight: 1.55,
                    }}>
                      {!isUser && (
                        <p style={{ fontSize: 9, color: theme.accent, marginBottom: 3, fontWeight: 'bold' }}>
                          {charP?.name}
                        </p>
                      )}
                      {entry.text}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {isWaiting && !narrativeText && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
            <Loader2 size={16} className="animate-spin" style={{ color: `${theme.accent}50` }} />
          </div>
        )}
      </div>

      {/* Action area */}
      <div style={{
        flexShrink: 0,
        padding: '8px 12px 12px',
        borderTop: `1px solid rgba(255,255,255,0.05)`,
      }}>
        {/* Branch choice */}
        {wf === 'branch_choice' && (() => {
          const curP = game?.players?.find(p => p.id === curPlayer?.id);
          const branchInfo = curP?.pendingBranch?.branchInfo;
          if (!branchInfo) return null;
          return (
            <div>
              <p style={{
                fontSize: 11,
                color: theme.accent,
                marginBottom: 7,
                textAlign: 'center',
                opacity: 0.8,
              }}>
                前方有分叉路口，选择方向
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {branchInfo.options.map((cellId, i) => {
                  const cell = game?.cells?.find(c => c.id === cellId);
                  return (
                    <motion.button
                      key={cellId}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onBranch(cellId)}
                      disabled={isWaiting}
                      style={{
                        padding: '10px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 'bold',
                        background: theme.choiceBg,
                        border: `1px solid ${theme.choiceBorder}45`,
                        color: theme.text,
                        cursor: 'pointer',
                        opacity: isWaiting ? 0.5 : 1,
                      }}
                    >
                      {i === 0 ? '← ' : '→ '}{cell?.name || `路线${i + 1}`}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Choices */}
        <AnimatePresence>
          {wf === 'choice' && choices.length > 0 && (
            <motion.div
              key="choices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {choices.map((c, i) => (
                <ChoiceButton
                  key={c.key}
                  choice={c}
                  index={i}
                  mode={mode}
                  onClick={handleChoice}
                  disabled={isWaiting || !narrativeDone} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue / End turn button */}
        {(wf === 'turn_end' || wf === 'narrative' || wf === 'special') && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onEndTurn}
            disabled={isWaiting}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: 13,
              fontSize: 13,
              color: isWaiting ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)',
              cursor: isWaiting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isWaiting ? '处理中…' : '继续 →'}
          </motion.button>
        )}

        {/* Chat input */}
        {wf === 'chat' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
              placeholder={`对 ${charP?.name || '角色'} 说…`}
              style={{
                flex: 1,
                borderRadius: 12,
                padding: '9px 12px',
                fontSize: 13,
                background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${theme.accent}25`,
                color: 'white',
                outline: 'none',
              }}
            />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                padding: '9px 12px',
                borderRadius: 12,
                border: 'none',
                cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                background: `${theme.accent}20`,
                color: theme.accent,
                opacity: !chatInput.trim() ? 0.35 : 1,
              }}
            >
              {chatLoading
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />}
            </motion.button>
          </div>
        )}

        {/* Game over */}
        {wf === 'game_end' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onEndTurn}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 'bold',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              boxShadow: '0 4px 16px rgba(217,119,6,0.3)',
            }}
          >
            查看对局结果
          </motion.button>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:0.5} 50%{opacity:0} }
      `}</style>
    </div>
  );
}
