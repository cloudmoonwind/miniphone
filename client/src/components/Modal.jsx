/**
 * Modal — 通用底部滑入弹窗
 *
 * Props:
 *   open      — 是否显示
 *   onClose   — 关闭回调
 *   title     — 标题（可选）
 *   children  — 内容
 *   maxH      — 最大高度 class（默认 'max-h-[80vh]'）
 */
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, maxH = 'max-h-[80vh]' }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col ${maxH}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            {title && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <h2 className="font-semibold text-gray-800">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 rounded-full"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
