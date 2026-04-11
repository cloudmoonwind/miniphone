import { useState, useEffect, useMemo } from 'react';
import { dreamsService } from '../../services/dreams.js';

/**
 * useDreams — 梦境数据管理
 *
 * charId === undefined/null → 全部角色模式：
 *   拉取 /api/dreams（全局），每个角色最多5条，总计最多30条
 *   此模式只读（无法新增/生成，删除/解梦使用 dream.charId）
 *
 * charId = 字符串 → 单角色模式：CRUD 全开
 */
export const useDreams = (charId) => {
  const [dreams, setDreams]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]     = useState('');

  // ── 加载 ───────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);

    if (!charId) {
      // 全角色模式：拉全局梦境，每个角色最多5条，总计30条
      dreamsService.listAll()
        .then(all => {
          if (!Array.isArray(all)) { setDreams([]); return; }
          const sorted = all.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
          const perChar = {};
          const limited = sorted.filter(d => {
            perChar[d.charId] = (perChar[d.charId] || 0) + 1;
            return perChar[d.charId] <= 5;
          }).slice(0, 30);
          setDreams(limited);
        })
        .catch(() => setDreams([]))
        .finally(() => setLoading(false));
      return;
    }

    // 单角色模式
    dreamsService.list(charId)
      .then(data => setDreams(Array.isArray(data) ? data : []))
      .catch(() => setDreams([]))
      .finally(() => setLoading(false));
  }, [charId]);

  const uninterpreted = useMemo(() => dreams.filter(d => !d.interpreted),  [dreams]);
  const interpreted   = useMemo(() => dreams.filter(d => d.interpreted),   [dreams]);

  // ── 新增（仅单角色模式有效） ────────────────────────────────────
  const addDream = async (form) => {
    if (!charId || (!form.title && !form.content)) return;
    const tmpId = `tmp-${Date.now()}`;
    const tmp = {
      id: tmpId, charId, ...form,
      interpreted: false, interpretation: '',
      timestamp: new Date().toISOString(),
      skyX: 12 + Math.random() * 70,
      skyY: 8  + Math.random() * 55,
    };
    setDreams(prev => [tmp, ...prev]);
    try {
      const created = await dreamsService.create(charId, form);
      setDreams(prev => prev.map(d =>
        d.id === tmpId ? { ...created, skyX: tmp.skyX, skyY: tmp.skyY } : d
      ));
    } catch {
      setDreams(prev => prev.filter(d => d.id !== tmpId));
    }
  };

  // ── 解梦（使用 dream 自身的 charId，支持全角色模式）─────────────
  const interpretDream = async (id, interpretation) => {
    const dream    = dreams.find(d => d.id === id);
    const targetId = dream?.charId || charId;
    if (!targetId) return;
    const waterX = 8  + Math.random() * 78;
    const waterY = 12 + Math.random() * 65;
    const patch  = { interpreted: true, interpretation, waterX, waterY };
    setDreams(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    try {
      await dreamsService.update(targetId, id, patch);
    } catch {}
    return { waterX, waterY };
  };

  // ── 删除（使用 dream 自身的 charId，支持全角色模式）─────────────
  const deleteDream = async (id) => {
    const dream    = dreams.find(d => d.id === id);
    const targetId = dream?.charId || charId;
    setDreams(prev => prev.filter(d => d.id !== id));
    if (!targetId) return;
    try {
      await dreamsService.delete(targetId, id);
    } catch {
      if (charId) {
        dreamsService.list(charId)
          .then(d => setDreams(Array.isArray(d) ? d : []))
          .catch(() => {});
      }
    }
  };

  // ── AI 生成（仅单角色模式）──────────────────────────────────────
  const generateDream = async () => {
    if (!charId || generating) return;
    setGenerating(true);
    setGenError('');
    try {
      const dream = await dreamsService.generate(charId, {});
      const withPos = {
        ...dream,
        skyX: dream.skyX ?? (12 + Math.random() * 70),
        skyY: dream.skyY ?? (8  + Math.random() * 55),
      };
      setDreams(prev => [withPos, ...prev]);
    } catch (e) {
      setGenError(e.message || 'AI生成失败');
      setTimeout(() => setGenError(''), 4000);
    } finally {
      setGenerating(false);
    }
  };

  return {
    dreams, loading,
    uninterpreted, interpreted,
    generating, genError,
    addDream, interpretDream, deleteDream, generateDream,
  };
};
