/**
 * DafuApp.jsx — Entry / routing for 大富翁 shared narrative board game
 * Views: loading → hall → setup → invite → game → record | records
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Trophy } from 'lucide-react';
import HallView from './HallView.jsx';
import SetupView from './SetupView.jsx';
import InviteView from './InviteView.jsx';
import GameView from './GameView.jsx';
import RecordView from './RecordView.jsx';
import { THEME, api } from './theme.js';

// Records list screen
function RecordsListView({ onViewRecord }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/records')
      .then(d => setRecords(Array.isArray(d) ? d : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e0516',
      }}>
        <div className="animate-spin" style={{
          width: 20, height: 20,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#a855f7',
        }} />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e0516',
        gap: 8,
      }}>
        <Trophy size={28} style={{ color: 'rgba(251,191,36,0.2)' }} />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>暂无对局记录</p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)' }}>完成一场游戏后会自动记录</p>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: '#0e0516',
      padding: '12px 14px',
      scrollbarWidth: 'none',
    }}>
      {records.map(r => {
        const t = THEME[r.mode] || THEME['恋爱'];
        const winnerName = r.winner === 'user' ? r.userName : r.charName;
        return (
          <motion.button
            key={r.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onViewRecord(r)}
            style={{
              width: '100%',
              marginBottom: 10,
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${t.accent}20`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 5,
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 'bold',
                color: t.accent,
                padding: '2px 7px',
                borderRadius: 4,
                background: `${t.accent}12`,
              }}>
                {r.mode}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                {r.userName} × {r.charName}
              </span>
              {r.winner && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: '#fbbf24',
                }}>
                  🏆 {winnerName}
                </span>
              )}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>
                {r.round} 轮 · {r.playType}
              </span>
              {r.players?.map(p => (
                <span key={p.id} style={{ fontSize: 10, color: `${p.color}70` }}>
                  {p.name}: {p.score}
                </span>
              ))}
              <span style={{
                marginLeft: 'auto',
                fontSize: 9,
                color: 'rgba(255,255,255,0.15)',
              }}>
                {new Date(r.completedAt || r.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// Game result / end screen
function GameOverView({ game, onViewRecord, onBack }) {
  const t = THEME[game?.mode] || THEME['恋爱'];
  const userP = game?.players?.find(p => p.id === 'user');
  const charP = game?.players?.find(p => p.id === 'char');
  const winnerName = game?.winner === 'user' ? userP?.name : charP?.name;
  const isUserWin = game?.winner === 'user';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.bg,
      padding: '20px',
      gap: 16,
    }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{
          width: '100%',
          padding: '24px',
          borderRadius: 24,
          background: `linear-gradient(160deg, ${t.accent}12, ${t.cellProp}08)`,
          border: `1.5px solid ${t.accent}30`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>
          {isUserWin ? '🏆' : '🎭'}
        </div>
        <h2 style={{
          fontSize: 20,
          fontWeight: 'bold',
          color: 'white',
          marginBottom: 4,
        }}>
          {winnerName ? `${winnerName} 获胜！` : '游戏结束'}
        </h2>
        <p style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.4)',
          marginBottom: 16,
        }}>
          第 {game?.round} 轮 · {game?.mode} 模式
        </p>

        {/* Score cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 16,
        }}>
          {[userP, charP].filter(Boolean).map(p => (
            <div key={p.id} style={{
              padding: '12px',
              borderRadius: 14,
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${p.color}25`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: t.scoreColor, marginBottom: 2 }}>
                {p.score}
              </div>
              <div style={{ fontSize: 11, color: `${p.color}80`, marginBottom: 4 }}>
                {p.name}
              </div>
              {game?.winner === p.id && (
                <div style={{
                  fontSize: 9,
                  color: '#fbbf24',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(251,191,36,0.1)',
                  display: 'inline-block',
                }}>
                  获胜
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => onViewRecord(game)}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 12,
            fontSize: 13,
            color: t.accent,
            background: `${t.accent}12`,
            border: `1px solid ${t.accent}25`,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          查看对局记录
        </button>
        <button
          onClick={onBack}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 12,
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
        >
          返回大厅
        </button>
      </motion.div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function DafuApp({ onBack }) {
  const [view, setView] = useState('loading');
  const [selectedMode, setSelectedMode] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [setup, setSetup] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [gameOver, setGameOver] = useState(null);

  // Check for active game on mount, auto-init worldbooks
  useEffect(() => {
    api('/game')
      .then(async g => {
        if (g?.status === 'active') {
          setActiveGame(g);
          setView('game');
        } else {
          setView('hall');
          try {
            const books = await fetch('/api/worldbook/books').then(r => r.json());
            if (!Array.isArray(books) || !books.some(b => b.name.includes('大富翁'))) {
              await api('/init-worldbooks', { method: 'POST' });
            }
          } catch { /* 非关键流程 */ }
        }
      })
      .catch(() => setView('hall'));
  }, []);

  const goBack = () => {
    if (view === 'hall') { onBack(); return; }
    if (view === 'setup') { setView('hall'); return; }
    if (view === 'invite') { setView('setup'); return; }
    if (view === 'game') {
      if (window.confirm('退出游戏？当前进度不会自动存档。')) setView('hall');
      return;
    }
    if (view === 'record') { setViewRecord(null); setView('hall'); return; }
    if (view === 'records') { setView('hall'); return; }
    if (view === 'gameover') { setGameOver(null); setView('hall'); return; }
    setView('hall');
  };

  const startGame = async () => {
    try {
      const game = await api('/game', {
        method: 'POST',
        body: JSON.stringify({
          mode: setup.mode,
          playType: setup.playType,
          charId: setup.char.id,
          charName: setup.char.name,
          hostPresetId: setup.hostPresetId,
          charPresetId: setup.charPresetId,
          wbBookId: setup.wbBookId,
        }),
      });
      await api('/config', {
        method: 'PUT',
        body: JSON.stringify({
          hostPresetId: setup.hostPresetId,
          charPresetId: setup.charPresetId,
        }),
      }).catch(() => {});
      setActiveGame(game);
      setView('game');
    } catch {
      alert('启动游戏失败，请检查设置');
    }
  };

  const handleGameEnd = (endedGame) => {
    setActiveGame(null);
    setGameOver(endedGame);
    setView('gameover');
  };

  // Title per view
  const titles = {
    hall: '大富翁',
    setup: '游戏设置',
    invite: '发送邀请',
    game: null, // game has its own header
    record: '对局记录',
    records: '所有战绩',
    gameover: '游戏结束',
    loading: null,
  };

  const showBack = view !== 'game' && view !== 'loading';
  const title = titles[view];
  const mode = activeGame?.mode || setup?.mode || selectedMode || '恋爱';
  const t = THEME[mode] || THEME['恋爱'];
  const bgColor = view === 'game' ? 'transparent' : t.bg;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: view === 'loading' ? '#0e0516' : bgColor,
    }}>
      {/* ── Top nav bar (not shown during game or loading) ── */}
      {view !== 'game' && view !== 'loading' && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.4)',
          borderBottom: `1px solid ${t.accent}18`,
          gap: 8,
        }}>
          <button
            onClick={goBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: showBack ? 'rgba(255,255,255,0.6)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: showBack ? 'auto' : 'none',
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 'bold',
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
          }}>
            {title}
          </span>
          {/* Records button in hall */}
          {view === 'hall' ? (
            <button
              onClick={() => setView('records')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              <Trophy size={16} />
            </button>
          ) : (
            <div style={{ width: 26 }} />
          )}
        </div>
      )}

      {/* Loading state */}
      {view === 'loading' && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
          <div className="animate-spin" style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.08)',
            borderTopColor: '#a855f7',
          }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            加载中…
          </span>
        </div>
      )}

      {/* ── View router ── */}
      <AnimatePresence mode="wait">
        {view === 'hall' && (
          <motion.div
            key="hall"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <HallView
              onSelect={(mode) => { setSelectedMode(mode); setView('setup'); }}
              onViewRecords={() => setView('records')}
              onSettings={() => { /* Could open settings */ }} />
          </motion.div>
        )}

        {view === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <SetupView
              initMode={selectedMode}
              onInvite={(s) => { setSetup(s); setView('invite'); }} />
          </motion.div>
        )}

        {view === 'invite' && setup && (
          <motion.div
            key="invite"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <InviteView
              setup={setup}
              onAccepted={startGame}
              onDeclined={() => setView('setup')} />
          </motion.div>
        )}

        {view === 'game' && activeGame && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <GameView
              game={activeGame}
              onGameEnd={handleGameEnd} />
          </motion.div>
        )}

        {view === 'gameover' && gameOver && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <GameOverView
              game={gameOver}
              onViewRecord={(r) => { setViewRecord(r); setView('record'); }}
              onBack={() => { setGameOver(null); setView('hall'); }} />
          </motion.div>
        )}

        {view === 'record' && viewRecord && (
          <motion.div
            key="record"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <RecordView record={viewRecord} />
          </motion.div>
        )}

        {view === 'records' && (
          <motion.div
            key="records"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <RecordsListView
              onViewRecord={(r) => { setViewRecord(r); setView('record'); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
