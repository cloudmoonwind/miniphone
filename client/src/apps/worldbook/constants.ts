/**
 * worldbook/constants.ts — 静态常量 & 类型
 */
import { Lock, Clock, Play, Check } from 'lucide-react';

export interface Opt { value: string; label: string }

export const POSITIONS: Opt[] = [
  { value: 'system-top',    label: 'System顶' },
  { value: 'system-bottom', label: 'System底' },
  { value: 'before-chat',   label: '对话前' },
  { value: 'after-chat',    label: '对话后' },
  { value: 'depth',         label: '指定深度' },
];

export const FILTER_LOGICS: Opt[] = [
  { value: 'AND_ANY', label: '任一' },
  { value: 'AND_ALL', label: '全部' },
  { value: 'NOT_ANY', label: '排除任一' },
  { value: 'NOT_ALL', label: '排除全部' },
];

export const EVT_SCOPES: Opt[] = [
  { value: 'global',    label: '全局' },
  { value: 'character', label: '角色专属' },
];

export const EVT_STATUSES = [
  { value: 'locked',    label: '锁定',   icon: Lock,  bg: 'bg-gray-100',  text: 'text-gray-500' },
  { value: 'pending',   label: '待触发', icon: Clock, bg: 'bg-amber-100', text: 'text-amber-600' },
  { value: 'active',    label: '进行中', icon: Play,  bg: 'bg-blue-100',  text: 'text-blue-600' },
  { value: 'completed', label: '已完成', icon: Check, bg: 'bg-green-100', text: 'text-green-600' },
];

export const getStatus = (v: string) => EVT_STATUSES.find(s => s.value === v) ?? EVT_STATUSES[0];
