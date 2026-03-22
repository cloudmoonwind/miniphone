import { useApp } from '../AppContext.jsx';

/**
 * usePreset — 读写当前活跃 API 预设
 *
 * @returns {{ activePreset: object|null, setActivePreset: Function }}
 */
export function usePreset() {
  const { activePreset, setActivePreset } = useApp();
  return { activePreset, setActivePreset };
}
