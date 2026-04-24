import React, { useState, useRef } from 'react';
import { mammoth, XLSX, jsPDF, html2canvas } from '../utils/pdfUtils';
import { GoogleGenAI, Type } from '@google/genai';
import { FileText, ArrowDownToLine, File, Table } from 'lucide-react';

export default function WordConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'pdf' | 'excel'>('pdf');
  const [htmlContent, setHtmlContent] = useState('');
  const [rawText, setRawText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [aiStatus, setAiStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [pdfSettings, setPdfSettings] = useState({
    pageSize: 'a4',
    orientation: 'portrait',
    margins: { top: 25, bottom: 25, left: 25, right: 25 },
    font: 'times'
  });

  const [excelSettings, setExcelSettings] = useState({
    mode: 'all'
  });

  const handleFile = async (newFile: File | null) => {
    if (!newFile) return;
    setFile(newFile);
    setHtmlContent('');
    setRawText('');
    
    try {
      let plainText = '';
      if (newFile.name.toLowerCase().endsWith('.docx')) {
        const buf = await newFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        setHtmlContent(result.value);
        plainText = result.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        setRawText(plainText);
      } else {
        const text = await newFile.text();
        plainText = text;
        setRawText(text);
        setHtmlContent(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'));
      }
      setPageCount(Math.max(1, Math.ceil(plainText.length / 2500)));
    } catch (err) {
      console.error(err);
    }
  };

  const convertWord = async () => {
    if (!htmlContent && !rawText) return;
    setIsProcessing(true);
    
    try {
      if (mode === 'pdf') {
        await convertToPdf();
      } else {
        await convertToExcel();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToPdf = async () => {
    const { pageSize, orientation, margins, font } = pdfSettings;
    const fontName = font === 'times' ? 'Times New Roman' : font === 'courier' ? 'Courier New' : 'Helvetica, Arial, sans-serif';
    
    const pageSizes = {
      a4: { p: [794, 1123], l: [1123, 794] },
      letter: { p: [816, 1056], l: [1056, 816] },
      legal: { p: [816, 1344], l: [1344, 816] }
    };
    
    const [pgW, pgH] = orientation === 'portrait' ? pageSizes[pageSize as keyof typeof pageSizes].p : pageSizes[pageSize as keyof typeof pageSizes].l;
    const safeMargins = {
      top: Number.isFinite(margins.top) ? margins.top : 25,
      right: Number.isFinite(margins.right) ? margins.right : 25,
      bottom: Number.isFinite(margins.bottom) ? margins.bottom : 25,
      left: Number.isFinite(margins.left) ? margins.left : 25,
    };

    const container = document.createElement('div');
    container.style.cssText = `position: fixed; top: 0; left: 0; opacity: 0; pointer-events: none; width: ${pgW}px; background: white; z-index: -1;`;

    const viewport = document.createElement('div');
    viewport.style.cssText = `position: relative; width: ${pgW}px; height: ${pgH}px; overflow: hidden; background: #fff;`;

    const pageDiv = document.createElement('div');
    pageDiv.style.cssText = `position: absolute; top: 0; left: 0; width: ${pgW}px; min-height: ${pgH}px; background: white; padding: ${safeMargins.top}px ${safeMargins.right}px ${safeMargins.bottom}px ${safeMargins.left}px; font-family: ${fontName}; font-size: 12pt; line-height: 1.6; color: #000; box-sizing: border-box; word-wrap: break-word; overflow: visible;`;
    
    pageDiv.innerHTML = `
      <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h1 { font-size: 20pt; font-weight: bold; margin: 16px 0 8px; }
        h2 { font-size: 16pt; font-weight: bold; margin: 14px 0 6px; }
        h3 { font-size: 14pt; font-weight: bold; margin: 12px 0 4px; }
        p { margin: 0 0 8px; }
        ul, ol { margin: 0 0 8px 24px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #000; padding: 5px 8px; font-size: 10pt; }
        th { background: #f0f0f0; font-weight: bold; }
        hr { border: 0; border-top: 1px solid #000; margin: 8px 0; }
        [style*="border"] { border-color: #000 !important; }
      </style>
      ${htmlContent || rawText.replace(/\n/g, '<br>')}
    `;
    
    viewport.appendChild(pageDiv);
    container.appendChild(viewport);
    document.body.appendChild(container);

    try {
      await new Promise(res => setTimeout(res, 120));

      pageDiv.style.transform = 'translateY(0)';
      const totalH = Math.max(pageDiv.scrollHeight, pgH);
      const numPages = Math.max(1, Math.ceil(totalH / pgH));
      const pdf = new jsPDF({ orientation: orientation as 'portrait' | 'landscape', unit: 'px', format: [pgW, pgH], hotfixes: ['px_scaling'] });

      for (let p = 0; p < numPages; p++) {
        pageDiv.style.transform = `translateY(-${p * pgH}px)`;
        await new Promise(res => requestAnimationFrame(() => res(null)));

        const canvas = await html2canvas(viewport, {
          scale: 1.8,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: pgW,
          height: pgH,
          windowWidth: pgW,
          windowHeight: pgH,
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (p > 0) pdf.addPage([pgW, pgH]);
        pdf.addImage(imgData, 'JPEG', 0, 0, pgW, pgH, undefined, 'FAST');
      }

      pdf.save('word-converted.pdf');
    } finally {
      document.body.removeChild(container);
    }
  };

  const convertToExcel = async () => {
    const wb = XLSX.utils.book_new();
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = htmlContent || '<p>' + rawText.replace(/\n/g, '</p><p>') + '</p>';
    
    let data: string[][] = [];
    
    if (excelSettings.mode === 'tables') {
      const tables = tmpDiv.querySelectorAll('table');
      if (tables.length > 0) {
        setAiStatus('');
        const aiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
        const tableText = Array.from(tables).map(tbl => {
          const rows: string[] = [];
          tbl.querySelectorAll('tr').forEach(tr => {
            const cells = Array.from(tr.querySelectorAll('td,th')).map(td => (td.textContent || '').trim().replace(/\s+/g, ' '));
            if (cells.some(c => c)) rows.push(cells.join('\t'));
          });
          return rows.join('\n');
        }).join('\n\n');
        
        if (aiKey && tableText.trim()) {
          try {
            setAiStatus('AI is organizing item names and prices...');
            const ai = new GoogleGenAI({ apiKey: aiKey });
            const prompt = `
              Extract menu-like items and their prices from the following Word tables.
              Return JSON with an "items" array where each item has:
              - name: item name (no price included)
              - price: price (empty string if not present)
              If a row has multiple columns, treat the most price-like value as the price.
            `;
            
            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: {
                parts: [
                  { text: prompt },
                  { text: tableText }
                ]
              },
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          price: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              }
            });
            
            const jsonStr = response.text?.trim() || '{}';
            const parsed = JSON.parse(jsonStr);
            const items = (parsed.items || []).filter((it: any) => it?.name || it?.price);
            if (items.length) {
              const rows = [['Item Name', 'Price'], ...items.map((it: any) => [it.name || '', it.price || ''])];
              const ws = XLSX.utils.aoa_to_sheet(rows);
              XLSX.utils.book_append_sheet(wb, ws, 'Items');
            }
          } catch (err) {
            console.error(err);
          } finally {
            setAiStatus('');
          }
        } else if (!aiKey) {
          setAiStatus('AI key missing: set VITE_GEMINI_API_KEY to enable item/price extraction.');
        }
        
        tables.forEach((tbl, ti) => {
          const tdata: string[][] = [];
          tbl.querySelectorAll('tr').forEach(tr => {
            const row: string[] = [];
            tr.querySelectorAll('td,th').forEach(cell => row.push(cell.textContent?.trim().replace(/\s+/g, ' ') || ''));
            if (row.some(c => c)) tdata.push(row);
          });
          if (tdata.length) {
            const ws = XLSX.utils.aoa_to_sheet(tdata);
            XLSX.utils.book_append_sheet(wb, ws, 'Table ' + (ti + 1));
          }
        });
        if (!aiKey) setTimeout(() => setAiStatus(''), 2500);
      } else {
        data = htmlToRows(tmpDiv);
      }
    } else if (excelSettings.mode === 'all') {
      data = htmlToRows(tmpDiv);
    } else {
      data = htmlToParagraphRows(tmpDiv);
    }
    
    if (data.length > 0) {
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    }
    
    XLSX.writeFile(wb, 'word-converted.xlsx');
  };

  const htmlToRows = (container: HTMLElement) => {
    const rows: string[][] = [];
    const blocks = container.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,td,th,div');
    
    blocks.forEach(el => {
      if (el.closest('table') && !['TD', 'TH'].includes(el.tagName)) return;
      if (['LI', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName) && el.parentElement !== container && !['UL', 'OL', 'BODY', 'DIV'].includes(el.parentElement?.tagName || '')) return;
      
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text) return;
      
      if (text.includes('\t')) { rows.push(text.split('\t').map(c => c.trim()).filter(c => c)); return; }

      const pipeCols = text.split(/\s*[|¦]\s*/).map(c => c.trim()).filter(c => c);
      if (pipeCols.length > 1) { rows.push(pipeCols); return; }
      
      const colonMatch = text.match(/^([^:]{1,40}):\s+(.+)$/);
      if (colonMatch) { rows.push([colonMatch[1].trim(), colonMatch[2].trim()]); return; }
      
      const dashMatch = text.match(/^([^\-]{1,40})\s+[-–—]\s+(.+)$/);
      if (dashMatch) { rows.push([dashMatch[1].trim(), dashMatch[2].trim()]); return; }
      
      const spaceCols = text.split(/\s{2,}/).map(c => c.trim()).filter(c => c);
      if (spaceCols.length > 1) { rows.push(spaceCols); return; }
      
      rows.push([text]);
    });
    
    return rows.filter(r => r.length && r.some(c => c));
  };

  const htmlToParagraphRows = (container: HTMLElement) => {
    const rows: string[][] = [];
    let currentHead = '';
    const children = Array.from(container.children);
    
    if (!children.length) return (container.textContent || '').split('\n').filter(l => l.trim()).map(l => [l.trim()]);
    
    children.forEach(el => {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text) return;
      const tag = el.tagName;
      
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
        currentHead = text;
        rows.push([text, '']);
      } else if (tag === 'TABLE') {
        el.querySelectorAll('tr').forEach(tr => {
          const r: string[] = [];
          tr.querySelectorAll('td,th').forEach(cell => r.push(cell.textContent?.trim() || ''));
          if (r.some(c => c)) rows.push(r);
        });
      } else if (['UL', 'OL'].includes(tag)) {
        el.querySelectorAll('li').forEach(li => {
          const t = (li.textContent || '').trim();
          if (t) rows.push([currentHead, t]);
        });
      } else {
        const colonMatch = text.match(/^([^:]{1,40}):\s+(.+)$/);
        if (colonMatch) rows.push([colonMatch[1].trim(), colonMatch[2].trim()]);
        else rows.push([currentHead || '', text]);
      }
    });
    
    return rows.filter(r => r.length && r.some(c => c));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-800 font-bold text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" /> Word Converter
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
            <div className="text-sm font-semibold mb-1 truncate px-2">{file ? file.name : 'Upload Word File'}</div>
            <div className="text-xs text-slate-500">.docx, .doc, .txt, .rtf</div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".doc,.docx,.txt,.rtf" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>

        <div className="p-4 border-b border-slate-800 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Conversion Mode</label>
            <div className="flex gap-2">
              <button onClick={() => setMode('pdf')} className={`flex-1 py-2 rounded-lg border-2 transition-all text-xs font-semibold flex items-center justify-center gap-1 ${mode === 'pdf' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-800 hover:border-slate-700 text-slate-400'}`}><File className="w-3 h-3" /> To PDF</button>
              <button onClick={() => setMode('excel')} className={`flex-1 py-2 rounded-lg border-2 transition-all text-xs font-semibold flex items-center justify-center gap-1 ${mode === 'excel' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 hover:border-slate-700 text-slate-400'}`}><Table className="w-3 h-3" /> To Excel</button>
            </div>
          </div>
          
          {mode === 'pdf' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Page Size</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={pdfSettings.pageSize} onChange={e => setPdfSettings({ ...pdfSettings, pageSize: e.target.value })}>
                  <option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Orientation</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={pdfSettings.orientation} onChange={e => setPdfSettings({ ...pdfSettings, orientation: e.target.value })}>
                  <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Margins (mm)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={pdfSettings.margins.top} onChange={e => setPdfSettings({ ...pdfSettings, margins: { ...pdfSettings.margins, top: parseInt(e.target.value) } })} placeholder="Top" />
                  <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={pdfSettings.margins.bottom} onChange={e => setPdfSettings({ ...pdfSettings, margins: { ...pdfSettings.margins, bottom: parseInt(e.target.value) } })} placeholder="Bottom" />
                  <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={pdfSettings.margins.left} onChange={e => setPdfSettings({ ...pdfSettings, margins: { ...pdfSettings.margins, left: parseInt(e.target.value) } })} placeholder="Left" />
                  <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={pdfSettings.margins.right} onChange={e => setPdfSettings({ ...pdfSettings, margins: { ...pdfSettings.margins, right: parseInt(e.target.value) } })} placeholder="Right" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Font</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={pdfSettings.font} onChange={e => setPdfSettings({ ...pdfSettings, font: e.target.value })}>
                  <option value="times">Times New Roman</option><option value="helvetica">Helvetica</option><option value="courier">Courier New</option>
                </select>
              </div>
            </div>
          )}
          
          {mode === 'excel' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Extract Mode</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-500 transition-colors" value={excelSettings.mode} onChange={e => setExcelSettings({ ...excelSettings, mode: e.target.value })}>
                  <option value="all">📋 All Text — Har line alag row</option>
                  <option value="tables">📊 Tables Only — Word tables → Excel</option>
                  <option value="paragraphs">📄 Paragraphs — Heading + content</option>
                </select>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-800 p-3 rounded-lg leading-relaxed">
                💡 <strong className="text-slate-300">Tips:</strong><br/>
                • Tab-separated data auto-splits into columns<br/>
                • "Name: Value" format → 2 columns<br/>
                • 2+ spaces → column separator
              </div>
            </div>
          )}
        </div>

        <div className="p-4 mt-auto">
          <button 
            onClick={convertWord}
            disabled={(!htmlContent && !rawText) || isProcessing}
            className={`w-full font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white ${mode === 'pdf' ? 'bg-gradient-to-br from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400' : 'bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400'}`}
          >
            <ArrowDownToLine className="w-4 h-4" /> Convert to {mode === 'pdf' ? 'PDF' : 'Excel'}
          </button>
          {aiStatus && <div className="text-[10px] text-slate-400 mt-2">{aiStatus}</div>}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Document Preview</div>
          <div className="text-xs text-slate-500">~{pageCount} pages</div>
        </div>
        
        {(!htmlContent && !rawText) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-900 border-2 border-dashed border-slate-800 rounded-2xl">
            <FileText className="w-16 h-16 mb-4 opacity-50" />
            <div className="font-semibold text-lg text-slate-300">Upload a Word document</div>
            <div className="text-sm mt-2">Preview will appear here</div>
          </div>
        ) : (
          <div className="flex-1 bg-slate-200 rounded-xl p-8 overflow-y-auto shadow-inner">
            <div 
              ref={previewRef}
              className="bg-white mx-auto shadow-2xl rounded-sm p-12 text-black font-serif text-base leading-relaxed max-w-4xl min-h-[800px]"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
              dangerouslySetInnerHTML={{ __html: htmlContent || rawText.replace(/\n/g, '<br>') }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
