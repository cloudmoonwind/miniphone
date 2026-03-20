import React, { useState, useRef } from 'react';
import { ChevronLeft, Image as ImageIcon, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PlaceholderApp from '../components/PlaceholderApp';

// --- 组件：美化 App ---
const BeautifyApp = ({ onBack, onBackgroundChange }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onBackgroundChange(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <PlaceholderApp appName="美化" onBack={onBack}>
      <div className="p-4">
        <button onClick={() => fileInputRef.current.click()} className="w-full bg-white p-4 rounded-lg shadow-sm border text-left">
          <h3 className="font-semibold">更换壁纸</h3>
          <p className="text-xs text-gray-500 mt-1">从本地选择一张图片作为桌面背景。</p>
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      </div>
    </PlaceholderApp>
  );
};

export default BeautifyApp;
