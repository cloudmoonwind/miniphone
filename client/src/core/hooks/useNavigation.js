import { useApp } from '../AppContext.jsx';

/**
 * useNavigation — 获取导航函数
 *
 * @returns {Function} navigate(appId: string, params?: { char? }) => void
 */
export function useNavigation() {
  const { navigate } = useApp();
  return navigate;
}
