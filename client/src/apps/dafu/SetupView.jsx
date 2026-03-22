/**
 * SetupView.jsx — Game setup: mode, playType, character, presets
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';
import { THEME, api } from './theme.js';

export default function SetupView({ initMode, onInvite }) {
  const [mode, setMode] = useState(initMode || '恋爱');
  const [playType, setPlayType] = useState('线上');
  const [chars, setChars] = useState([]);
  const [presets, setPresets] = useState([]);
  const [books, setBooks] = useState([]);
  const [selChar, setSelChar] = useState(null);
  const [hostPreset, setHostPreset] = useState('');
  const [charPreset, setCharPreset] = useState('');
  const [wbBook, setWbBook] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const t = THEME[mode] || THEME['恋爱'];

  useEffect(() => {
    Promise.all([
      fetch('/api/characters').then(r => r.json()).catch(() => []),
      fetch('/api/settings/presets').then(r => r.json()).catch(() => []),
      fetch('/api/worldbook/books').then(r => r.json()).catch(() => []),
      api('/config').catch(() => ({})),
    ]).then(([c, p, b, cfg]) => {
      setChars(Array.isArray(c) ? c : []);
      setPresets(Array.isArray(p) ? p : []);
      setBooks(Array.isArray(b) ? b : []);
      if (cfg?.hostPresetId) setHostPreset(cfg.hostPresetId);
      if (cfg?.charPresetId) setCharPreset(cfg.charPresetId);
      // Auto-select mode-appropriate worldbook
      const modeKeywords = { '益智': '华尔街', '恋爱': '约会之旅', '十八禁': '欲望迷宫' };
      const keyword = modeKeywords[mode] || mode;
      const autoBook = (Array.isArray(b) ? b : []).find(bk => bk.enabled && bk.name.includes('大富翁') && (bk.name.includes(keyword) || bk.name.includes(mode)));
      if (autoBook && !wbBook) setWbBook(autoBook.id);
      setLoading(false);
    });
  }, []);

  // Update worldbook when mode changes
  useEffect(() => {
    if (books.length === 0) return;
    const modeKeywords = { '益智': '华尔街', '恋爱': '约会之旅', '十八禁': '欲望迷宫' };
    const keyword = modeKeywords[mode] || mode;
    const autoBook = books.find(bk => bk.enabled && bk.name.includes('大富翁') && (bk.name.includes(keyword) || bk.name.includes(mode)));
    if (autoBook) setWbBook(autoBook.id);
    else setWbBook('');
  }, [mode, books]);

  const selectStyle = {
    width: '100%',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${t.accent}20`,
    color: 'rgba(255,255,255,0.8)',
    outline: 'none',
    appearance: 'none',
  };

  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: t.bg,
      }}>
        <Loader2 size={24} className="animate-spin" style={{ color: `${t.accent}40` }} />
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '16px 16px 24px',
      scrollbarWidth: 'none',
      background: t.bg,
    }}>
      {/* Mode selector */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 10,
          letterSpacing: 0.5,
        }}>
          游戏模式
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {['益智', '恋爱', '十八禁'].map(m => {
            const mt = THEME[m];
            const isSel = mode === m;
            return (
              <motion.button
                key={m}
                onClick={() => setMode(m)}
                whileTap={{ scale: 0.96 }}
                style={{
                  padding: '12px 4px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 'bold',
                  background: isSel ? `${mt.accent}15` : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${isSel ? mt.accent + '70' : 'rgba(255,255,255,0.08)'}`,
                  color: isSel ? mt.accent : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isSel && (
                  <motion.div
                    layoutId="mode-sel"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: `${mt.accent}08`,
                      borderRadius: 12,
                    }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{m}</span>
                {isSel && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 20,
                    height: 2,
                    borderRadius: 1,
                    background: mt.accent,
                  }} />
                )}
              </motion.button>
            );
          })}
        </div>
        {/* Mode description */}
        <motion.p
          key={mode}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: 10,
            color: `${t.accent}70`,
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {t.hallSub}
        </motion.p>
      </div>

      {/* Play type */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 10,
          letterSpacing: 0.5,
        }}>
          游玩方式
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { v: '线上', l: '线上', sub: '视频连麦' },
            { v: '线下', l: '线下', sub: '面对面' },
          ].map(({ v, l, sub }) => (
            <button
              key={v}
              onClick={() => setPlayType(v)}
              style={{
                padding: '10px',
                borderRadius: 11,
                fontSize: 12,
                background: playType === v ? `${t.accent}12` : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${playType === v ? t.accent + '55' : 'rgba(255,255,255,0.07)'}`,
                color: playType === v ? 'white' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Character selection */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 10,
          letterSpacing: 0.5,
        }}>
          邀请角色
        </p>
        {chars.length === 0 ? (
          <div style={{
            padding: '16px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
              暂无角色
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', marginTop: 3 }}>
              请先在结缘中添加角色
            </p>
          </div>
        ) : (
          <div style={{
            maxHeight: 180,
            overflowY: 'auto',
            scrollbarWidth: 'none',
          }}>
            {chars.map(c => (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelChar(c)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  marginBottom: 7,
                  cursor: 'pointer',
                  background: selChar?.id === c.id ? `${t.accent}10` : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${selChar?.id === c.id ? t.accent + '55' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.2s',
                }}
              >
                <Avatar value={c.avatar} name={c.name} size={28} rounded className="shrink-0" />
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <p style={{
                    fontSize: 13,
                    color: selChar?.id === c.id ? 'white' : 'rgba(255,255,255,0.65)',
                    fontWeight: selChar?.id === c.id ? 'bold' : 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {c.name}
                  </p>
                  {c.tagline && (
                    <p style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.25)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 1,
                    }}>
                      {c.tagline}
                    </p>
                  )}
                </div>
                {selChar?.id === c.id && (
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: t.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 10,
                    color: '#0a0a0a',
                    fontWeight: 'bold',
                  }}>
                    ✓
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Advanced settings toggle */}
      <button
        onClick={() => setShowAdvanced(s => !s)}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: 10,
          fontSize: 11,
          color: `${t.accent}60`,
          background: 'rgba(255,255,255,0.03)',
          border: `1px dashed ${t.accent}20`,
          cursor: 'pointer',
          marginBottom: showAdvanced ? 12 : 20,
          transition: 'all 0.2s',
        }}
      >
        {showAdvanced ? '收起高级设置 ↑' : '高级设置 ↓'}
      </button>

      {/* Advanced settings */}
      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ marginBottom: 20, overflow: 'hidden' }}
        >
          {/* Worldbook */}
          {books.filter(b => b.enabled).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>
                棋盘世界书
              </p>
              <select
                value={wbBook}
                onChange={e => setWbBook(e.target.value)}
                style={selectStyle}
              >
                <option value="">使用内置默认内容</option>
                {books.filter(b => b.enabled).map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Host preset */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>
              主持人 AI 预设
            </p>
            <select
              value={hostPreset}
              onChange={e => setHostPreset(e.target.value)}
              style={selectStyle}
            >
              <option value="">使用默认预设</option>
              {presets.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          {/* Char preset */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>
              角色 AI 预设
            </p>
            <select
              value={charPreset}
              onChange={e => setCharPreset(e.target.value)}
              style={selectStyle}
            >
              <option value="">使用默认预设</option>
              {presets.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Submit button */}
      <motion.button
        whileHover={selChar ? { scale: 1.02 } : {}}
        whileTap={selChar ? { scale: 0.97 } : {}}
        onClick={() => {
          if (!selChar) return;
          onInvite({
            mode, playType, char: selChar,
            hostPresetId: hostPreset || null,
            charPresetId: charPreset || null,
            wbBookId: wbBook || null,
          });
        }}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 16,
          fontSize: 15,
          fontWeight: 'bold',
          color: selChar ? 'white' : 'rgba(255,255,255,0.3)',
          cursor: selChar ? 'pointer' : 'not-allowed',
          border: 'none',
          background: selChar
            ? `linear-gradient(135deg, ${t.accent}, ${t.cellProp})`
            : 'rgba(255,255,255,0.06)',
          boxShadow: selChar ? `0 4px 16px ${t.accent}25` : 'none',
          transition: 'all 0.3s',
        }}
      >
        {selChar ? `向 ${selChar.name} 发送邀请` : '请先选择角色'}
      </motion.button>
    </div>
  );
}
