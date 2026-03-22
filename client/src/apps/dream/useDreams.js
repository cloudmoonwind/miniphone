import { useState, useEffect, useMemo } from 'react';
import { dreamsService } from '../../services/dreams.js';

// 梦境数据管理 hook（所有服务器交互集中在这里）
export const useDreams = (charId) => {
  const [dreams, setDreams]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]   = useState('');

  // 加载梦境列表
  useEffect(() => {
    if (!charId) { setDreams([]); return; }
    setLoading(true);
    dreamsService.list(charId)
      .then(data => setDreams(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [charId]);

  const uninterpreted = useMemo(() => dreams.filter(d => !d.interpreted),  [dreams]);
  const interpreted   = useMemo(() => dreams.filter(d => d.interpreted),   [dreams]);

  // 手动新增（乐观更新）
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
      setDreams(prev => prev.map(d => d.id === tmpId
        ? { ...created, skyX: tmp.skyX, skyY: tmp.skyY } : d));
    } catch {
      setDreams(prev => prev.filter(d => d.id !== tmpId));
    }
  };

  // 解梦（乐观更新），返回 { waterX, waterY } 供触发涟漪
  const interpretDream = async (id, interpretation) => {
    const waterX = 8  + Math.random() * 78;
    const waterY = 12 + Math.random() * 65;
    const patch  = { interpreted: true, interpretation, waterX, waterY };
    setDreams(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    try {
      await dreamsService.update(charId, id, patch);
    } catch {}
    return { waterX, waterY };
  };

  // 删除（乐观更新）
  const deleteDream = async (id) => {
    setDreams(prev => prev.filter(d => d.id !== id));
    try {
      await dreamsService.delete(charId, id);
    } catch {
      dreamsService.list(charId).then(d => setDreams(Array.isArray(d) ? d : [])).catch(() => {});
    }
  };

  // AI 生成
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
