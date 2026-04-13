/**
 * worldbook/index.tsx — 知识库主入口
 *
 * 管理世界书/事件书 tab 切换，
 * 将 openWBBook 状态提升至此层，使进入书详情时隐藏顶栏（沉浸式）。
 */
import React, { useState } from 'react';
import { ChevronLeft, BookCopy } from 'lucide-react';
import { getWBSettings } from './api';
import { SpineStrip, PageStack, InnerShadow } from './ui';
import { WorldbookTab, BookDetail } from './WorldbookTab';
import { EventBooksTab } from './EventBooksTab';

export default function WorldbookApp({ onBack }: { onBack: () => void }) {
  const [tab,        setTab]        = useState<'世界书' | '事件书'>('世界书');
  const [openWBBook, setOpenWBBook] = useState<any>(null);

  const entriesPerPage = (() => {
    const s = getWBSettings();
    return s.entriesPerPage ?? 8;
  })();

  // 进入书详情：全屏替换，隐藏顶栏
  if (openWBBook) {
    return (
      <BookDetail
        book={openWBBook}
        onBack={() => setOpenWBBook(null)}
        entriesPerPage={entriesPerPage}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative"
      style={{ backgroundImage: 'url(/paper-bg.jpg)', backgroundSize: 'cover' }}>

      <SpineStrip />
      <PageStack />
      <InnerShadow />

      {/* 顶栏 */}
      <div className="flex items-center px-4 pt-3 pb-2 gap-2 shrink-0">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 transition-colors">
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <BookCopy size={15} strokeWidth={1.3} className="text-gray-500" />
        <span className="font-semibold text-gray-800 flex-1 text-sm">知识库</span>
        <div className="flex gap-3 text-xs text-gray-500">
          {(['世界书', '事件书'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-0.5 transition-colors ${tab === t ? 'text-gray-900 border-b border-gray-700' : 'hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === '世界书'
          ? <WorldbookTab onOpenBook={setOpenWBBook} />
          : <EventBooksTab />
        }
      </div>
    </div>
  );
}
