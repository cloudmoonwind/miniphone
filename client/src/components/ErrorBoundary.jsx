import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col h-full bg-white items-center justify-center p-6 gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center"><AlertTriangle size={24} className="text-red-400" /></div>
          <p className="font-bold text-gray-800 text-center">页面出错了</p>
          <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-mono break-all leading-relaxed">
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-5 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold"
          >
            返回重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
