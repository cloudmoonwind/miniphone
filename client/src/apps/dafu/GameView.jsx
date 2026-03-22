/**
 * GameView.jsx — Main game screen
 * Layout: Board (55%) + InfoBar (36px) + DramaPanel (remaining ~40%)
 * DiceFloat overlaid on board center when waitingFor==='roll'
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Board from './components/Board.jsx';
import InfoBar from './components/InfoBar.jsx';
import DramaPanel from './components/DramaPanel.jsx';
import CharBubble from './components/CharBubble.jsx';
import DiceFloat from './components/DiceFloat.jsx';
import StrategyQuiz from './components/StrategyQuiz.jsx';
import ConfessionGame from './components/ConfessionGame.jsx';
import TruthSpinner from './components/TruthSpinner.jsx';
import { THEME, api } from './theme.js';

export default function GameView({ game: initGame, onGameEnd }) {
  const [game, setGame] = useState(initGame);
  const [rolling, setRolling] = useState(false);
  const [diceResult, setDiceResult] = useState(null);
  const [showDice, setShowDice] = useState(false);
  const [charBubble, setCharBubble] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const prevLogLen = useRef((initGame?.log || []).length);

  const mode = game?.mode || '恋爱';
  const t = THEME[mode] || THEME['恋爱'];
  const curPlayer = game?.players?.[game?.currentPlayerIndex];
  const isUserTurn = curPlayer?.id === 'user';
  const wf = game?.waitingFor;
  const charP = game?.players?.find(p => p.id === 'char');

  // Detect new char reactions in log
  useEffect(() => {
    const log = game?.log || [];
    if (log.length > prevLogLen.current) {
      for (let i = log.length - 1; i >= prevLogLen.current; i--) {
        if (log[i]?.type === 'chat' && log[i]?.playerId === 'char') {
          setCharBubble({ text: log[i].text });
          break;
        }
      }
    }
    prevLogLen.current = log.length;
  }, [game?.log?.length]);

  // Auto-trigger char turn after delay
  useEffect(() => {
    if (!game || rolling || loading) return;
    if (wf !== 'roll' || isUserTurn) return;
    const timer = setTimeout(triggerCharTurn, 2400);
    return () => clearTimeout(timer);
  }, [game?.currentPlayerIndex, game?.round, wf]);

  // Show special modals:
  // - 益智: StrategyQuiz shows on 'choice' (host AI generated A/B/C choices)
  // - 恋爱: ConfessionGame shows on 'special' (corner cell)
  // - 十八禁: TruthSpinner shows on 'special' (jail cell)
  useEffect(() => {
    if (wf === 'special') setShowSpecialModal(true);
    if (wf === 'choice' && mode === '益智') setShowSpecialModal(true);
  }, [wf]);

  const withLoading = async (fn) => {
    setLoading(true);
    try { return await fn(); } finally { setLoading(false); }
  };

  const triggerCharTurn = async () => {
    if (rolling || loading) return;
    setRolling(true);
    try {
      const r = await api('/game/char-turn', { method: 'POST' });
      if (r.game) {
        setGame(r.game);
        if (r.roll) {
          setDiceResult(r.roll);
          setShowDice(true);
        }
      }
    } finally {
      setRolling(false);
    }
  };

  const handleRoll = async () => {
    if (rolling || loading || !isUserTurn || wf !== 'roll') return;
    setRolling(true);
    try {
      const r = await api('/game/roll', { method: 'POST' });
      if (r.game) {
        setGame(r.game);
        if (r.roll) {
          setDiceResult(r.roll);
          setShowDice(true);
        }
      }
    } finally {
      setRolling(false);
    }
  };

  const handleBranch = async (cellId) => {
    await withLoading(async () => {
      const r = await api('/game/branch', {
        method: 'POST',
        body: JSON.stringify({ chosenCellId: cellId }),
      });
      if (r.game) setGame(r.game);
    });
  };

  const handleChoice = async (key) => {
    const choiceObj = (game.currentChoices || []).find(c => c.key === key);
    await withLoading(async () => {
      const r = await api('/game/choice', {
        method: 'POST',
        body: JSON.stringify({ choiceKey: key, choiceText: choiceObj?.text || key }),
      });
      if (r.game) setGame(r.game);
    });
  };

  const handleEndTurn = async () => {
    if (wf === 'game_end') {
      onGameEnd(game);
      return;
    }
    await withLoading(async () => {
      const r = await api('/game/end-turn', { method: 'POST' });
      if (r.game) {
        setGame(r.game);
        setShowDice(false);
      }
      if (r.gameOver) onGameEnd(r.game);
    });
  };

  const handleChat = async (message) => {
    const r = await api('/game/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    if (r.game) setGame(r.game);
    return r;
  };

  const handleEndGame = async () => {
    if (!window.confirm('结束游戏并存档？')) return;
    try {
      const r = await api('/game/end', { method: 'POST' });
      onGameEnd(r);
    } catch {}
  };

  const handleDiceDone = () => {
    setShowDice(false);
  };

  if (!game) return null;

  const isWaiting = loading || rolling;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: t.bg,
    }}>
      {/* ── App header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 10px',
        background: 'rgba(0,0,0,0.4)',
        borderBottom: `1px solid ${t.accent}15`,
        flexShrink: 0,
        gap: 8,
      }}>
        <span style={{
          fontSize: 10,
          color: t.accent,
          fontWeight: 'bold',
          letterSpacing: 1,
          flex: 1,
          opacity: 0.9,
        }}>
          {t.hallTitle}
        </span>
        <span style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
        }}>
          {game.mode} · 第 {game.round} 轮
        </span>
        <button
          onClick={handleEndGame}
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.18)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          结束
        </button>
      </div>

      {/* ── Info bar ── */}
      <InfoBar game={game} mode={mode} />

      {/* ── Board area (55%) ── */}
      <div style={{
        flexShrink: 0,
        height: '55%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 4px 4px',
        overflow: 'hidden',
      }}>
        <Board
          game={game}
          mode={mode}
          showReachable={wf === 'roll' && isUserTurn} />

        {/* Char reaction bubble */}
        <AnimatePresence>
          {charBubble && (
            <CharBubble
              text={charBubble.text}
              charName={charP?.name || '角色'}
              mode={mode}
              onDismiss={() => setCharBubble(null)} />
          )}
        </AnimatePresence>

        {/* Dice float overlay — only when waiting for roll */}
        <AnimatePresence>
          {(wf === 'roll' || showDice) && (
            <motion.div
              key="dice-float"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DiceFloat
                mode={mode}
                isUserTurn={isUserTurn}
                rolling={rolling}
                diceResult={showDice ? diceResult : null}
                onRoll={handleRoll}
                onDone={handleDiceDone} />

              {/* Char turn: show proxy button */}
              {wf === 'roll' && !isUserTurn && !rolling && (
                <button
                  onClick={triggerCharTurn}
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    color: `${t.accent}60`,
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${t.accent}20`,
                    borderRadius: 8,
                    padding: '3px 10px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  代为操作
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Drama panel (remaining ~40%) ── */}
      <DramaPanel
        game={game}
        mode={mode}
        onChoice={handleChoice}
        onEndTurn={handleEndTurn}
        onChat={handleChat}
        onBranch={handleBranch}
        charReaction={charBubble?.text}
        isLoading={isWaiting} />

      {/* ── Special modals ── */}
      <AnimatePresence>
        {showSpecialModal && wf === 'choice' && mode === '益智' && (
          <StrategyQuiz
            key="strategy"
            game={game}
            onChoice={async (key) => {
              setShowSpecialModal(false);
              await handleChoice(key);
            }}
            onClose={() => setShowSpecialModal(false)} />
        )}

        {showSpecialModal && wf === 'special' && mode === '恋爱' && (
          <ConfessionGame
            key="confession"
            game={game}
            onSubmit={handleChat}
            onClose={() => {
              setShowSpecialModal(false);
              handleEndTurn();
            }} />
        )}

        {showSpecialModal && wf === 'special' && mode === '十八禁' && (
          <TruthSpinner
            key="truth"
            game={game}
            onAction={async (msg) => {
              await handleChat(msg);
            }}
            onClose={() => {
              setShowSpecialModal(false);
              handleEndTurn();
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}
