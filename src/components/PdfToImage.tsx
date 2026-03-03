import React, { useState, useRef } from 'react';
import { pdfjsLib, JSZip } from '../utils/pdfUtils';
import { FileImage, FileText, ArrowDownToLine, Download } from 'lucide-react';

export default function PdfToImage() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<{ num: number, dataUrl: string, canvas: HTMLCanvasElement }[]>([]);
  const [format, setFormat] = useState('jpeg');
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(2);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(999);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (newFile: File | null) => {
    if (!newFile || !newFile.name.endsWith('.pdf')) return;
    setFile(newFile);
    setPages([]);
    
    const buf = await newFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    
    setToPage(pdf.numPages);
    convertPdfToImg(newFile, 1, pdf.numPages);
  };

  const convertPdfToImg = async (pdfFile: File = file!, startPage: number = fromPage, endPage: number = toPage) => {
    if (!pdfFile) return;
    setIsProcessing(true);
    
    try {
      const buf = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      
      const start = Math.max(1, startPage);
      const end = Math.min(pdf.numPages, endPage);
      
      const newPages = [];
      for (let i = start; i <= end; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale });
        const cv = document.createElement('canvas');
        cv.width = vp.width;
        cv.height = vp.height;
        // @ts-ignore
        await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
        
        // Thumbnail
        const thumbCv = document.createElement('canvas');
        const thumbScale = Math.min(1, 200 / vp.width);
        thumbCv.width = vp.width * thumbScale;
        thumbCv.height = vp.height * thumbScale;
        const thumbCtx = thumbCv.getContext('2d')!;
        thumbCtx.drawImage(cv, 0, 0, thumbCv.width, thumbCv.height);
        
        newPages.push({ num: i, dataUrl: thumbCv.toDataURL('image/jpeg', 0.8), canvas: cv });
      }
      setPages(newPages);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSingle = (index: number) => {
    const { canvas, num } = pages[index];
    const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg';
    const dataUrl = canvas.toDataURL(mime, quality);
    
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `page-${num}.${ext}`;
    a.click();
  };

  const downloadAll = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    
    try {
      const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg';
      const zip = new JSZip();
      
      for (const { canvas, num } of pages) {
        const dataUrl = canvas.toDataURL(mime, quality);
        const base64 = dataUrl.split(',')[1];
        zip.file(`page-${num}.${ext}`, base64, { base64: true });
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pdf-pages.zip';
      a.click();
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
          <FileImage className="w-4 h-4 text-pink-400" /> PDF → Image
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div 
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-pink-500 bg-pink-500/10' : 'border-slate-700 hover:border-pink-500 hover:bg-pink-500/5'}`}
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Output Format</label>
            <div className="flex gap-2">
              {['jpeg', 'png', 'webp'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`flex-1 py-1.5 rounded-lg border-2 transition-all text-xs font-semibold uppercase ${format === fmt ? 'border-pink-500 bg-pink-500/10 text-pink-400' : 'border-slate-800 hover:border-slate-700 text-slate-400'}`}
                >
                  {fmt === 'jpeg' ? 'JPG' : fmt}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Quality / Scale</label>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-slate-400 w-12">Quality</span>
              <input type="range" min="0.3" max="1" step="0.05" value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))} className="flex-1 accent-pink-500" />
              <span className="text-xs font-bold text-pink-400 w-8">{Math.round(quality * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-12">Scale</span>
              <select className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-pink-500 transition-colors" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))}>
                <option value="1">1x (72 DPI)</option>
                <option value="2">2x (144 DPI)</option>
                <option value="3">3x (216 DPI)</option>
                <option value="4">4x (288 DPI)</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Page Range</label>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-slate-400 w-8">From</span>
              <input type="number" min="1" value={fromPage} onChange={(e) => setFromPage(parseInt(e.target.value))} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-pink-500 transition-colors" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-8">To</span>
              <input type="number" min="1" value={toPage} onChange={(e) => setToPage(parseInt(e.target.value))} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-pink-500 transition-colors" placeholder="All" />
            </div>
          </div>
        </div>

        <div className="p-4 mt-auto space-y-2">
          <div className="text-xs text-slate-400 mb-2">{toPage || 0} pages loaded</div>
          <div className="flex gap-2">
            <button 
              onClick={convertPdfToImg}
              disabled={!file || isProcessing}
              className="flex-1 bg-gradient-to-br from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <FileImage className="w-3 h-3" /> Convert
            </button>
            <button 
              onClick={downloadAll}
              disabled={pages.length === 0 || isProcessing}
              className="flex-1 bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <ArrowDownToLine className="w-3 h-3" /> ZIP All
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        {pages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <FileImage className="w-16 h-16 mb-4 opacity-50" />
            <div className="font-semibold text-lg text-slate-300">Upload a PDF to convert pages to images</div>
            <div className="text-sm mt-2">Each page becomes a separate image file</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pages.map((p, i) => (
              <div key={p.num} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative group hover:border-pink-500/50 hover:-translate-y-1 transition-all">
                <div className="bg-black relative">
                  <img src={p.dataUrl} alt={`Page ${p.num}`} className="w-full h-auto block" />
                  <button 
                    onClick={() => downloadSingle(i)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/70 hover:bg-emerald-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Download this page"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3">
                  <div className="text-xs font-semibold text-slate-300">Page {p.num} · {format.toUpperCase()}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.canvas.width}×{p.canvas.height}px</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
