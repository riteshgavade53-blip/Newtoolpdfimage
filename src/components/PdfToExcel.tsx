import React, { useState, useRef } from 'react';
import { pdfjsLib, XLSX } from '../utils/pdfUtils';
import { Table, FileText, ArrowDownToLine } from 'lucide-react';

export default function PdfToExcel() {
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<string[][][]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (newFile: File | null) => {
    if (!newFile || !newFile.name.endsWith('.pdf')) return;
    setFile(newFile);
    setTables([]);
    setIsProcessing(true);
    
    try {
      const buf = await newFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      
      const newTables: string[][][] = [];
      for (let pg = 1; pg <= pdf.numPages; pg++) {
        const page = await pdf.getPage(pg);
        const tc = await page.getTextContent();
        const vp = page.getViewport({ scale: 1 });
        const pgH = vp.height;
        
        const items = tc.items
          .filter((it: any) => it.str.trim())
          .map((it: any) => ({
            x: Math.round(it.transform[4] * 10) / 10,
            y: Math.round((pgH - it.transform[5]) * 10) / 10,
            w: Math.abs(it.width),
            h: Math.abs(it.height) || 10,
            text: it.str.trim()
          }));
          
        if (!items.length) { newTables.push([]); continue; }
        
        const avgCharWidth = (() => {
          const samples = items.filter(i => i.text.length > 0 && i.w > 0).slice(0, 200);
          if (!samples.length) return 6;
          const widths = samples.map(i => i.w / Math.max(i.text.length, 1));
          widths.sort((a, b) => a - b);
          return widths[Math.floor(widths.length / 2)] || 6;
        })();
        
        const rowTolerance = Math.max(3, Math.round((items.reduce((s, i) => s + i.h, 0) / items.length) * 0.6));
        const rowMap = new Map<number, any[]>();
        items.forEach(it => {
          let foundKey = null;
          for (const [ky] of rowMap) {
            if (Math.abs(ky - it.y) <= rowTolerance) { foundKey = ky; break; }
          }
          const key = foundKey ?? it.y;
          if (!rowMap.has(key)) rowMap.set(key, []);
          rowMap.get(key)!.push(it);
        });
        
        const sortedRows = [...rowMap.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, cells]) => cells.sort((a, b) => a.x - b.x));
        
        const gapThreshold = Math.max(10, avgCharWidth * 2.2);
        const rowCells = sortedRows.map(row => {
          const cells: { x: number; w: number; text: string }[] = [];
          let current = row[0];
          let cellText = current.text;
          let cellStart = current.x;
          let cellEnd = current.x + current.w;
          
          for (let i = 1; i < row.length; i++) {
            const it = row[i];
            const gap = it.x - cellEnd;
            if (gap > gapThreshold) {
              cells.push({ x: cellStart, w: cellEnd - cellStart, text: cellText });
              cellText = it.text;
              cellStart = it.x;
              cellEnd = it.x + it.w;
            } else {
              cellText += ' ' + it.text;
              cellEnd = Math.max(cellEnd, it.x + it.w);
            }
          }
          cells.push({ x: cellStart, w: cellEnd - cellStart, text: cellText });
          return cells;
        });
        
        const allX = rowCells.flatMap(r => r.map(c => c.x));
        const colCenters = clusterPositions(allX, Math.max(12, avgCharWidth * 2.6));
        
        const tableData = rowCells.map(row => {
          const rowOut = new Array(Math.max(colCenters.length, 1)).fill('');
          row.forEach(cell => {
            const colIdx = findNearestColumn(cell.x, colCenters);
            rowOut[colIdx] = rowOut[colIdx] ? rowOut[colIdx] + ' ' + cell.text : cell.text;
          });
          return rowOut;
        }).filter(r => r.some(c => c.trim()));
        
        if (!tableData.length) {
          const fallback = sortedRows.map(row => [row.map(c => c.text).join(' ')]);
          newTables.push(fallback);
        } else {
          newTables.push(tableData);
        }
      }
      setTables(newTables);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  function clusterPositions(allX: number[], threshold: number) {
    if (!allX.length) return [0];
    const sorted = [...allX].sort((a, b) => a - b);
    const clusters: number[][] = [];
    let current: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= threshold) current.push(sorted[i]);
      else { clusters.push(current); current = [sorted[i]]; }
    }
    clusters.push(current);
    return clusters.map(c => c.reduce((a, b) => a + b, 0) / c.length);
  }

  function findNearestColumn(x: number, centers: number[]) {
    if (!centers.length) return 0;
    let best = 0;
    let bestDist = Math.abs(x - centers[0]);
    for (let i = 1; i < centers.length; i++) {
      const dist = Math.abs(x - centers[i]);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  }

  const convertToExcel = () => {
    if (!tables.some(t => t.length > 0)) return;
    
    const wb = XLSX.utils.book_new();
    
    tables.forEach((pg, i) => {
      if (!pg.length) return;
      const ws = XLSX.utils.aoa_to_sheet(pg);
      XLSX.utils.book_append_sheet(wb, ws, 'Page ' + (i + 1));
    });
    
    XLSX.writeFile(wb, 'pdf-to-excel.xlsx');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-emerald-400 mb-3">Convert PDF to Excel</h2>
          <p className="text-slate-400">Extract tables and data from your PDF documents into editable Excel spreadsheets instantly.</p>
        </div>

        {!file ? (
          <div 
            className={`border-4 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <Table className="w-20 h-20 mx-auto mb-6 text-emerald-500/50" />
            <div className="text-2xl font-bold text-slate-200 mb-2">Drag & Drop your PDF here</div>
            <div className="text-slate-500 mb-6">or click to browse files</div>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full transition-colors">
              Select PDF File
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
          </div>
        ) : isProcessing ? (
          <div className="border-2 border-slate-800 rounded-2xl p-16 text-center bg-slate-900/50">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto mb-6"></div>
            <div className="text-xl font-bold text-slate-200 mb-2">Converting your file...</div>
            <div className="text-slate-500">Please wait while we extract the tables.</div>
          </div>
        ) : (
          <div className="border-2 border-emerald-500/30 rounded-2xl p-12 text-center bg-emerald-500/5">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ArrowDownToLine className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-200 mb-2">Conversion Complete!</div>
            <div className="text-slate-400 mb-8">{tables.filter(t => t.length > 0).length} tables extracted successfully.</div>
            
            <div className="flex gap-4 justify-center">
              <button 
                onClick={convertToExcel}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <ArrowDownToLine className="w-5 h-5" /> Download Excel
              </button>
              <button 
                onClick={() => { setFile(null); setTables([]); }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-8 rounded-full transition-colors"
              >
                Convert Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
