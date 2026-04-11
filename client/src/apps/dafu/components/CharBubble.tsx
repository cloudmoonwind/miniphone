/**
 * CharBubble.jsx — floating character reaction bubble
 * Positioned top-left of board, auto-dismisses after 4s
 */
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { THEME } from '../theme.js';

export default function CharBubble({ text, charName, mode, onDismiss }) {
  const theme = THEME[mode] || THEME['恋爱'];

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      onClick={onDismiss}
      style={{
        position: 'absolute',
        top: 6,
        left: 6,
        right: 6,
        zIndex: 25,
        background: `rgba(0,0,0,0.82)`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${theme.accent}35`,
        borderRadius: 12,
        padding: '8px 12px',
        cursor: 'pointer',
        boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${theme.accent}15`,
      }}
    >
      {/* Bubble tail */}
      <div style={{
        position: 'absolute',
        bottom: -6,
        left: 20,
        width: 10,
        height: 6,
        background: `rgba(0,0,0,0.82)`,
        clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        borderLeft: `1px solid ${theme.accent}35`,
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: theme.accent,
          boxShadow: `0 0 5px ${theme.accent}`,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 10,
          color: theme.accent,
          fontWeight: 'bold',
          letterSpacing: 0.3,
        }}>
          {charName}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 8,
          color: 'rgba(255,255,255,0.2)',
        }}>
          点击关闭
        </span>
      </div>
      <p style={{
        fontSize: 12,
        color: theme.text,
        lineHeight: 1.55,
        opacity: 0.9,
      }}>
        {text}
      </p>
    </motion.div>
  );
}
