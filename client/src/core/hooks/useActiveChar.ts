import { useApp } from '../AppContext.jsx';

/**
 * useActiveChar — 读写当前活跃角色
 *
 * @returns {{ activeChar: object|null, setActiveChar: Function }}
 */
export function useActiveChar() {
  const { activeChar, setActiveChar } = useApp();
  return { activeChar, setActiveChar };
}
