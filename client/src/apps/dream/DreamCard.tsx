import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { DREAM_TYPES, hexRgb, AnimeStar as StarSVG } from './dreamUtils.jsx';
import cardBorderImg  from './assets/cardBorder.jpg';
import starCurtainImg from './assets/starCurtain.jpg';

/**
 * DreamCard — 从星星飞向中心后展开的梦境卡片
 * 顶部有星星圆形区域（点击关闭），卡片退出用 clipPath 向上收起
 */
export const DreamCard = ({ dream, color, rays = 4, rotDeg = 0, starPhase = 0, onClose, onInterpret, onDelete }) => {
  const [text, setText] = useState(dream.interpretation || '');
  const [r, g, b] = hexRgb(color);

  const handleInterpret = async () => {
    await onInterpret(dream.id, text);
  };

  return (
    // 全屏蒙层
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 96,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
        background: 'rgba(2,4,16,0.88)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {/* 卡片外层（含吊帘溢出区） */}
      <motion.div
        initial={{ scale: 0.12, opacity: 0, y: 12 }}
        animate={{ scale: 1,    opacity: 1, y: 0 }}
        exit={{   scale: 0.88,  opacity: 0, y: -16 }}
        transition={{
          default: { type: 'spring', stiffness: 260, damping: 24, mass: 0.8 },
          exit:    { duration: 0.28, ease: 'easeIn' },
        }}
        style={{ position: 'relative', width: '100%', maxWidth: 390 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 星星吊帘（黑底用 screen 消除，金色保留，卡片顶部溢出） */}
        <div style={{
          position: 'absolute', top: -64, left: -8, right: -8, height: 130,
          overflow: 'hidden', pointerEvents: 'none', zIndex: 3,
        }}>
          <img
            src={starCurtainImg}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top center',
              mixBlendMode: 'screen',
              filter: 'brightness(0.75) saturate(1.4)',
            }}
            alt=""
          />
        </div>

        {/* 卡片主体 */}
        <div
          style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column',
            borderRadius: 24, overflow: 'hidden',
            maxHeight: '80vh',
            background: `linear-gradient(150deg, rgba(6,10,32,0.97) 0%, rgba(${r},${g},${b},0.13) 100%)`,
            boxShadow: `0 0 80px rgba(${r},${g},${b},0.22), 0 30px 90px rgba(0,0,0,0.8)`,
          }}
        >
          {/* 边框素材（白色花纹 screen 叠加 + 蓝紫滤镜）*/}
          <img
            src={cardBorderImg}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'fill',
              mixBlendMode: 'screen',
              filter: 'sepia(1) hue-rotate(195deg) saturate(5) brightness(0.78)',
              pointerEvents: 'none', zIndex: 10,
            }}
            alt=""
          />

          {/* 顶部星星区域（点击关闭）*/}
          <div
            onClick={onClose}
            style={{
              position: 'relative', zIndex: 11,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              height: 130, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{ position: 'relative', width: 115, height: 115 }}>
              <StarSVG size={120} color={color} rays={rays} rotation={rotDeg} phase={starPhase} className="" style={{}} />
            </div>
          </div>

        {/* 标题 */}
        <div style={{ padding: '20px 20px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 6, minHeight: 42,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${color} 0%, rgba(${r},${g},${b},0.15) 100%)`,
              boxShadow: `0 0 14px ${color}70`,
              flexShrink: 0, marginTop: 3,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, color: 'white', fontSize: 18, lineHeight: 1.3, margin: 0 }}>
                {dream.title || '无标题梦境'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 12, padding: '2px 8px', borderRadius: 999,
                  background: `rgba(${r},${g},${b},0.2)`,
                  color, border: `1px solid rgba(${r},${g},${b},0.35)`,
                }}>
                  {DREAM_TYPES[dream.type]?.label}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  {new Date(dream.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </span>
                <span style={{ fontSize: 12, letterSpacing: '0.1em', color: `rgba(${r},${g},${b},0.75)` }}>
                  {'◆'.repeat(Math.min(Math.ceil(dream.importance / 2), 5))}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: 6, borderRadius: '50%', border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0,
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 8px' }}>
          {dream.content && (
            <div style={{
              padding: 16, borderRadius: 16, marginBottom: 16,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <p style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.78)', margin: 0 }}>
                {dream.content}
              </p>
            </div>
          )}

          {dream.interpreted ? (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: `rgba(${r},${g},${b},0.6)` }}>解读</p>
              <div style={{
                padding: 12, borderRadius: 12,
                background: `rgba(${r},${g},${b},0.1)`,
                border: `1px solid rgba(${r},${g},${b},0.2)`,
              }}>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', margin: 0 }}>
                  {dream.interpretation || '（未填写）'}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'rgba(255,255,255,0.35)' }}>
                写下你的感受…
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="联想、感受、或解读这个梦…"
                rows={3}
                style={{
                  width: '100%', padding: '12px', fontSize: 14,
                  borderRadius: 12, resize: 'none', outline: 'none',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid rgba(${r},${g},${b},0.22)`,
                  color: 'rgba(255,255,255,0.82)',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div style={{ padding: '12px 20px 24px', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button
            onClick={() => onDelete(dream.id)}
            style={{
              padding: '10px 16px', borderRadius: 12,
              border: '1px solid rgba(200,70,70,0.25)', background: 'transparent',
              color: 'rgba(200,100,100,0.8)', cursor: 'pointer',
            }}
          >
            <Trash2 size={15} />
          </button>
          {!dream.interpreted ? (
            <button
              onClick={handleInterpret}
              style={{
                flex: 1, padding: '10px', fontSize: 14, fontWeight: 600,
                borderRadius: 12, border: 'none', cursor: 'pointer', color: 'white',
                background: `linear-gradient(135deg, rgba(${r},${g},${b},0.75), rgba(${Math.round(r*0.5)},${Math.round(g*0.6)},${Math.min(Math.round(b*1.3),255)},0.85))`,
                boxShadow: `0 4px 24px rgba(${r},${g},${b},0.35)`,
              }}
            >
              解梦并安放
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', fontSize: 14, borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              }}
            >
              关闭
            </button>
          )}
        </div>
        </div>{/* /card主体 */}
      </motion.div>
    </motion.div>
  );
};
