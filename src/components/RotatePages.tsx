import React, { useState, useRef } from 'react';
import { pdfjsLib, jsPDF } from '../utils/pdfUtils';
import { RotateCw, FileText, ArrowDownToLine, CheckSquare, Square, RotateCcw } from 'lucide-react';

export default function RotatePages() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<{ num: number, dataUrl: string, angle: number }[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (newFile: File | null) => {
    if (!newFile || !newFile.name.endsWith('.pdf')) return;
    setFile(newFile);
    setPages([]);
    setSelected(new Set());
    
    const buf = await newFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    
    const newPages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 0.7 });
      const cv = document.createElement('canvas');
      cv.width = vp.width;
      cv.height = vp.height;
      // @ts-ignore
      await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
      newPages.push({ num: i, dataUrl: cv.toDataURL('image/jpeg', 0.8), angle: 0 });
    }
    setPages(newPages);
  };

  const toggleSelection = (num: number) => {
    const newSel = new Set(selected);
    if (newSel.has(num)) newSel.delete(num);
    else newSel.add(num);
    setSelected(newSel);
  };

  const selectAll = () => setSelected(new Set(pages.map(p => p.num)));
  const clearSelection = () => setSelected(new Set());

  const rotatePage = (num: number, delta: number) => {
    setPages(pages.map(p => p.num === num ? { ...p, angle: (p.angle + delta + 360) % 360 } : p));
  };

  const rotateAll = (delta: number) => {
    setPages(pages.map(p => ({ ...p, angle: (p.angle + delta + 360) % 360 })));
  };

  const rotateSelected = (delta: number) => {
    setPages(pages.map(p => selected.has(p.num) ? { ...p, angle: (p.angle + delta + 360) % 360 } : p));
  };

  const resetRotations = () => {
    setPages(pages.map(p => ({ ...p, angle: 0 })));
  };

  const exportRotatedPdf = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let npdf: jsPDF | null = null;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const angle = pages.find(p => p.num === i)?.angle || 0;
        
        const vp = page.getViewport({ scale: 2, rotation: angle });
        const cv = document.createElement('canvas');
        cv.width = vp.width;
        cv.height = vp.height;
        // @ts-ignore
        await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
        
        const imgData = cv.toDataURL('image/jpeg', 0.95);
        const pw = vp.width / 2;
        const ph = vp.height / 2;
        
        if (!npdf) {
          npdf = new jsPDF({ orientation: pw > ph ? 'landscape' : 'portrait', unit: 'pt', format: [pw, ph] });
        } else {
          npdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
        }
        npdf.addImage(imgData, 'JPEG', 0, 0, pw, ph);
      }
      
      if (npdf) npdf.save('rotated-pages.pdf');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-800 font-bold text-sm flex items-center gap-2">
          <RotateCw className="w-4 h-4 text-amber-400" /> Rotate Pages
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div 
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 hover:border-amber-500 hover:bg-amber-500/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <div className="text-sm font-semibold mb-1 truncate px-2">{file ? file.name : 'Upload PDF'}</div>
            <div className="text-xs text-slate-500">Click or drag & drop</div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>

        <div className="p-4 border-b border-slate-800 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Rotate All Pages</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => rotateAll(-90)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"><RotateCcw className="w-3 h-3" /> 90° Left</button>
              <button onClick={() => rotateAll(90)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"><RotateCw className="w-3 h-3" /> 90° Right</button>
            </div>
            <button onClick={() => rotateAll(180)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors">↕ 180° Flip All</button>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Selected Pages</label>
            <div className="text-xs text-slate-400 mb-2">{selected.size} pages selected</div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => rotateSelected(-90)} className="flex-1 bg-gradient-to-br from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"><RotateCcw className="w-3 h-3" /> Left</button>
              <button onClick={() => rotateSelected(90)} className="flex-1 bg-gradient-to-br from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"><RotateCw className="w-3 h-3" /> Right</button>
            </div>
            <div className="flex gap-2">
              <button onClick={selectAll} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors">Select All</button>
              <button onClick={clearSelection} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors">Clear</button>
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Reset</label>
            <button onClick={resetRotations} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors">↩ Reset All Rotations</button>
          </div>
        </div>

        <div className="p-4 mt-auto">
          <button 
            onClick={exportRotatedPdf}
            disabled={!file || isProcessing}
            className="w-full bg-gradient-to-br from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowDownToLine className="w-4 h-4" /> Export Rotated PDF
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        {pages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <RotateCw className="w-16 h-16 mb-4 opacity-50" />
            <div className="font-semibold text-lg text-slate-300">Upload a PDF to rotate pages</div>
            <div className="text-sm mt-2">Click pages to select, then use sidebar controls</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pages.map((p) => {
              const isSelected = selected.has(p.num);
              return (
                <div 
                  key={p.num} 
                  className={`bg-slate-900 border-2 rounded-xl overflow-hidden cursor-pointer transition-all relative group ${isSelected ? 'border-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.25)]' : 'border-slate-800 hover:border-slate-600'}`}
                >
                  <div 
                    className="h-40 bg-slate-950 flex items-center justify-center overflow-hidden p-2"
                    onClick={() => toggleSelection(p.num)}
                  >
                    <img 
                      src={p.dataUrl} 
                      alt={`Page ${p.num}`} 
                      className="max-w-full max-h-full object-contain transition-transform duration-300" 
                      style={{ transform: `rotate(${p.angle}deg)` }} 
                    />
                  </div>
                  <div className={`absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-amber-500 text-white' : 'bg-black/70 border border-slate-600 text-transparent'}`}>
                    {isSelected && <CheckSquare className="w-3 h-3" />}
                  </div>
                  
                  <div className="p-2 flex items-center justify-between bg-slate-900 border-t border-slate-800">
                    <div className="text-xs font-semibold text-slate-400">Page {p.num}</div>
                    <div className="text-[10px] font-bold text-amber-400">{p.angle}°</div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); rotatePage(p.num, -90); }} className="w-6 h-6 rounded bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 flex items-center justify-center text-slate-400 transition-colors"><RotateCcw className="w-3 h-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); rotatePage(p.num, 90); }} className="w-6 h-6 rounded bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 flex items-center justify-center text-slate-400 transition-colors"><RotateCw className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
