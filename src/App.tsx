import React, { useState } from 'react';
import { Home as HomeIcon, Edit2, Image as ImageIcon, Minimize2, Trash2, FileText, FileImage, RotateCw, Sparkles } from 'lucide-react';
import Home from './components/Home';
import Editor from './components/Editor';
import ImagesToPdf from './components/ImagesToPdf';
import CompressPdf from './components/CompressPdf';
import DeletePages from './components/DeletePages';
import WordConverter from './components/WordConverter';
import PdfToImage from './components/PdfToImage';
import RotatePages from './components/RotatePages';
import CleanExcel from './components/CleanExcel';

const tabs = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'editor', label: 'PDF & Image Edit', icon: Edit2 },
  { id: 'img2pdf', label: 'Images->PDF', icon: ImageIcon },
  { id: 'compress', label: 'Compress', icon: Minimize2 },
  { id: 'delete', label: 'Delete Pages', icon: Trash2 },
  { id: 'word', label: 'Word Converter', icon: FileText },
  { id: 'pdf2img', label: 'PDF->Image', icon: FileImage },
  { id: 'rotate', label: 'Rotate Pages', icon: RotateCw },
  { id: 'cleanexcel', label: 'Clean Excel', icon: Sparkles },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[700px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] translate-x-1/4 translate-y-1/4"></div>
      </div>

      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0 bg-gradient-to-br from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          PDF Suite Pro
        </div>

        <div className="w-px h-5 bg-slate-800 shrink-0"></div>

        <div className="flex gap-1 overflow-x-auto flex-1 scrollbar-hide pb-0.5 items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-300'
                }`}
              >
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>}
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="relative z-10 h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden">
        {activeTab === 'home' && <Home onNavigate={setActiveTab} />}
        {activeTab === 'editor' && <Editor />}
        {activeTab === 'img2pdf' && <ImagesToPdf />}
        {activeTab === 'compress' && <CompressPdf />}
        {activeTab === 'delete' && <DeletePages />}
        {activeTab === 'word' && <WordConverter />}
        {activeTab === 'pdf2img' && <PdfToImage />}
        {activeTab === 'rotate' && <RotatePages />}
        {activeTab === 'cleanexcel' && <CleanExcel />}
      </main>
    </div>
  );
}
