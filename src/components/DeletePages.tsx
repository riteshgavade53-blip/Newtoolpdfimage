import React, { useState, useRef } from 'react';
import { pdfjsLib, jsPDF } from '../utils/pdfUtils';
import { Trash2, FileText, ArrowDownToLine, CheckSquare, Square } from 'lucide-react';

export default function DeletePages() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<{ num: number, dataUrl: string }[]>([]);
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
      const vp = page.getViewport({ scale: 0.5 });
      const cv = document.createElement('canvas');
      cv.width = vp.width;
      cv.height = vp.height;
      // @ts-ignore
      await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
      newPages.push({ num: i, dataUrl: cv.toDataURL('image/jpeg', 0.8) });
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

  const deletePages = async () => {
    if (!file || selected.size === 0 || selected.size === pages.length) return;
    setIsProcessing(true);
    
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let npdf: jsPDF | null = null;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        if (selected.has(i)) continue;
        
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2 });
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
      
      if (npdf) npdf.save('pages-deleted.pdf');
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
          <Trash2 className="w-4 h-4 text-red-400" /> Delete Pages
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div 
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-red-500 bg-red-500/10' : 'border-slate-700 hover:border-red-500 hover:bg-red-500/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <div className="text-sm font-semibold mb-1 truncate px-2">{file ? file.name : 'Upload PDF'}</div>
            <div className="text-xs text-slate-500">Then select pages to remove</div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>

        <div className="p-4 border-b border-slate-800 space-y-4">
          <div className="text-xs text-slate-400">{pages.length} pages loaded</div>
          <div className="text-xs text-red-400 font-semibold">{selected.size} pages selected for deletion</div>
          
          <div className="flex gap-2">
            <button onClick={selectAll} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors">Select All</button>
            <button onClick={clearSelection} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors">Clear</button>
          </div>
        </div>

        <div className="p-4 mt-auto">
          <button 
            onClick={deletePages}
            disabled={!file || selected.size === 0 || selected.size === pages.length || isProcessing}
            className="w-full bg-gradient-to-br from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowDownToLine className="w-4 h-4" /> Delete & Download
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        {pages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Trash2 className="w-16 h-16 mb-4 opacity-50" />
            <div className="font-semibold text-lg text-slate-300">Upload a PDF to manage pages</div>
            <div className="text-sm mt-2">Select the pages you want to delete</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pages.map((p) => {
              const isSelected = selected.has(p.num);
              return (
                <div 
                  key={p.num} 
                  onClick={() => toggleSelection(p.num)}
                  className={`bg-slate-900 border-2 rounded-xl overflow-hidden cursor-pointer transition-all relative group ${isSelected ? 'border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,1)]' : 'border-slate-800 hover:border-slate-600 hover:-translate-y-1'}`}
                >
                  <div className={`absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-red-500 text-white' : 'bg-black/50 text-white/50 opacity-0 group-hover:opacity-100'}`}>
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </div>
                  <img src={p.dataUrl} alt={`Page ${p.num}`} className={`w-full h-auto block transition-all ${isSelected ? 'opacity-50 grayscale' : ''}`} />
                  <div className={`p-2 text-center text-xs font-semibold ${isSelected ? 'text-red-400 bg-red-500/10' : 'text-slate-400'}`}>
                    Page {p.num}
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
