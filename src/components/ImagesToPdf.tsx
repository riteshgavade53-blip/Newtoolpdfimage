import React, { useState, useRef } from 'react';
import { jsPDF, loadImgEl } from '../utils/pdfUtils';
import { Plus, X, ArrowDownToLine, Image as ImageIcon } from 'lucide-react';

export default function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [margin, setMargin] = useState(20);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...arr]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const createPdf = async () => {
    if (files.length === 0) return;
    
    const pdf = new jsPDF({
      orientation: orientation as 'portrait' | 'landscape',
      unit: 'px',
      format: pageSize === 'img' ? [800, 1100] : pageSize
    });

    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      const img = await loadImgEl(url);
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const iw = pw - margin * 2;
      const ih = ph - margin * 2;
      const ratio = Math.min(iw / img.width, ih / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      const dx = margin + (iw - dw) / 2;
      const dy = margin + (ih - dh) / 2;
      
      if (i > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', dx, dy, dw, dh);
      URL.revokeObjectURL(url);
    }
    
    pdf.save('images-to-pdf.pdf');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-800 font-bold text-sm flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-400" /> Images → PDF
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div 
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          >
            <Plus className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <div className="text-sm font-semibold mb-1">Add Images</div>
            <div className="text-xs text-slate-500">JPG, PNG, WebP, GIF</div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
        </div>

        <div className="p-4 border-b border-slate-800 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Page Size</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors" value={pageSize} onChange={e => setPageSize(e.target.value)}>
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
              <option value="img">Match Image</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Orientation</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors" value={orientation} onChange={e => setOrientation(e.target.value)}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Margin (px)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors" value={margin} onChange={e => setMargin(Number(e.target.value))} min="0" max="100" />
          </div>
        </div>

        <div className="p-4 mt-auto">
          <button 
            onClick={createPdf}
            disabled={files.length === 0}
            className="w-full bg-gradient-to-br from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowDownToLine className="w-4 h-4" /> Convert to PDF
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
            <div className="font-semibold text-lg text-slate-300">Upload images to get started</div>
            <div className="text-sm mt-2">Drag to reorder, click × to remove</div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {files.map((file, i) => (
              <div key={i} className="relative w-36 h-40 bg-slate-800 border-2 border-slate-700 rounded-xl overflow-hidden shrink-0 group">
                <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center z-10">
                  {i + 1}
                </div>
                <button 
                  onClick={() => removeFile(i)}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-red-500 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-32 object-cover" />
                <div className="px-2 py-1.5 text-[10px] text-slate-400 truncate bg-slate-900 border-t border-slate-700">
                  {file.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
