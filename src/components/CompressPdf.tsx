import React, { useState, useRef } from 'react';
import { pdfjsLib, jsPDF, formatBytes } from '../utils/pdfUtils';
import { Minimize2, FileText, ArrowDownToLine } from 'lucide-react';

export default function CompressPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.6);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState<{ orig: number, new: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (newFile: File | null) => {
    if (!newFile || !newFile.name.endsWith('.pdf')) return;
    setFile(newFile);
    setStats(null);
  };

  const compressPdf = async () => {
    if (!file) return;
    setIsCompressing(true);
    setProgress(10);
    setStatus('Loading PDF...');

    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let npdf: jsPDF | null = null;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        setStatus(`Compressing page ${i}/${pdf.numPages}...`);
        setProgress(10 + ((i / pdf.numPages) * 80));
        
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1.2 });
        const cv = document.createElement('canvas');
        cv.width = vp.width;
        cv.height = vp.height;
        
        // @ts-ignore
        await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
        const imgData = cv.toDataURL('image/jpeg', quality);
        
        if (!npdf) {
          npdf = new jsPDF({ orientation: vp.width > vp.height ? 'landscape' : 'portrait', unit: 'pt', format: [vp.width, vp.height] });
        } else {
          npdf.addPage([vp.width, vp.height], vp.width > vp.height ? 'landscape' : 'portrait');
        }
        
        npdf.addImage(imgData, 'JPEG', 0, 0, vp.width, vp.height);
      }
      
      if (!npdf) return;
      
      setProgress(95);
      setStatus('Saving...');
      
      const blob = npdf.output('blob');
      setStats({ orig: file.size, new: blob.size });
      
      npdf.save('compressed.pdf');
      setProgress(100);
      setStatus('Done!');
    } catch (err) {
      console.error(err);
      setStatus('Error compressing PDF');
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6 bg-slate-950">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/30 to-amber-400/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Minimize2 className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">PDF Compressor</h2>
        </div>
        <p className="text-sm text-slate-400 mb-8 ml-13">Reduce PDF size while keeping quality</p>

        <div 
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-6 ${isDragging ? 'border-red-500 bg-red-500/10' : 'border-slate-700 hover:border-red-500 hover:bg-red-500/5'}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <FileText className="w-10 h-10 mx-auto mb-3 text-slate-400" />
          <div className="text-sm font-semibold mb-1 truncate px-4">{file ? file.name : 'Upload PDF File'}</div>
          <div className="text-xs text-slate-500">{file ? formatBytes(file.size) : 'Click or drag & drop'}</div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={(e) => handleFile(e.target.files?.[0] || null)} />

        <div className="mb-6">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Compression Quality</label>
          <div className="flex gap-2">
            {[
              { q: 0.9, label: 'High', desc: 'Small reduction', color: 'blue' },
              { q: 0.6, label: 'Medium', desc: 'Balanced', color: 'amber' },
              { q: 0.3, label: 'Low', desc: 'Max savings', color: 'red' }
            ].map((opt) => (
              <button
                key={opt.q}
                onClick={() => setQuality(opt.q)}
                className={`flex-1 p-3 rounded-xl border-2 transition-all text-center ${quality === opt.q ? `border-${opt.color}-500 bg-${opt.color}-500/10` : 'border-slate-800 hover:border-slate-700 bg-slate-950'}`}
              >
                <div className={`text-sm font-bold mb-1 ${quality === opt.q ? `text-${opt.color}-400` : 'text-slate-300'}`}>{opt.label}</div>
                <div className="text-[10px] text-slate-500">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-slate-300">{formatBytes(stats.orig)}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Original</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">{formatBytes(stats.new)}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Compressed</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-indigo-400">
                {Math.round((1 - stats.new / stats.orig) * 100)}%
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Saved</div>
            </div>
          </div>
        )}

        {isCompressing && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>{status}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        <button 
          onClick={compressPdf}
          disabled={!file || isCompressing}
          className="w-full bg-gradient-to-br from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/20"
        >
          <ArrowDownToLine className="w-5 h-5" /> Compress & Download
        </button>
      </div>
    </div>
  );
}
