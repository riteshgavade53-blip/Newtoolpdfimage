import React, { useState, useRef, useEffect } from 'react';
import { pdfjsLib, jsPDF, loadImgEl } from '../utils/pdfUtils';
import { Edit2, FileText, ArrowDownToLine, Type, Square, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, FilePlus, Copy, ClipboardPaste } from 'lucide-react';

interface Layer {
  id: number;
  type: 'text' | 'shape' | 'img';
  x: number;
  y: number;
  w?: number;
  h?: number;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  shapeType?: 'rect' | 'circle' | 'line' | 'arrow';
  fill?: string;
  stroke?: string;
  opacity?: number;
  imgSrc?: string;
  page: number;
}

interface CustomPage {
  id: string;
  type: 'pdf' | 'blank';
  pdfPageNum?: number;
}

export default function Editor() {
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [scale, setScale] = useState(1.5);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [editingTextId, setEditingTextId] = useState<number | null>(null);
  const [copiedLayer, setCopiedLayer] = useState<Layer | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef<'top' | 'bottom' | null>(null);
  const wheelCooldownRef = useRef(0);
  const layerHistoryRef = useRef<Layer[][]>([]);
  const prevLayersRef = useRef<Layer[]>([]);
  const isUndoingRef = useRef(false);

  const handleFile = async (newFile: File | null) => {
    if (!newFile || !newFile.name.endsWith('.pdf')) return;
    setFile(newFile);
    setLayers([]);
    setSelectedLayerId(null);
    setEditingTextId(null);
    setPageNum(1);
    
    const buf = await newFile.arrayBuffer();
    const loadedPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    setPdf(loadedPdf);
    
    const initialPages: CustomPage[] = Array.from({ length: loadedPdf.numPages }, (_, i) => ({
      id: `pdf-${i + 1}`,
      type: 'pdf',
      pdfPageNum: i + 1
    }));
    setCustomPages(initialPages);
  };

  useEffect(() => {
    if (customPages.length > 0) renderPage();
  }, [pdf, pageNum, scale, customPages]);
  
  useEffect(() => {
    const target = scrollTargetRef.current;
    if (!target || !mainScrollRef.current) return;
    const el = mainScrollRef.current;
    requestAnimationFrame(() => {
      if (target === 'top') el.scrollTop = 0;
      if (target === 'bottom') el.scrollTop = el.scrollHeight;
      scrollTargetRef.current = null;
    });
  }, [pageNum]);

  const pasteLayer = (layerToPaste: Layer) => {
    const pasted: Layer = {
      ...layerToPaste,
      id: Date.now(),
      page: pageNum,
      x: layerToPaste.x + 12,
      y: layerToPaste.y + 12
    };
    setLayers(prev => [...prev, pasted]);
    setSelectedLayerId(pasted.id);
    setEditingTextId(null);
  };

  const undoLayers = () => {
    const history = layerHistoryRef.current;
    if (history.length === 0) return;
    const previous = history.pop()!;
    isUndoingRef.current = true;
    setLayers(previous.map(layer => ({ ...layer })));
    setSelectedLayerId(prev => previous.some(layer => layer.id === prev) ? prev : null);
    setEditingTextId(prev => previous.some(layer => layer.id === prev) ? prev : null);
  };

  useEffect(() => {
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      prevLayersRef.current = layers.map(layer => ({ ...layer }));
      return;
    }

    const previous = prevLayersRef.current;
    const changed = JSON.stringify(previous) !== JSON.stringify(layers);
    if (!changed) return;

    if (previous.length || layers.length) {
      layerHistoryRef.current.push(previous.map(layer => ({ ...layer })));
      if (layerHistoryRef.current.length > 100) layerHistoryRef.current.shift();
    }

    prevLayersRef.current = layers.map(layer => ({ ...layer }));
  }, [layers]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      const withMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (withMod && key === 'z' && !e.shiftKey && !isTypingTarget) {
        e.preventDefault();
        undoLayers();
        return;
      }

      if (isTypingTarget) return;

      if (withMod && key === 'c' && selectedLayerId) {
        e.preventDefault();
        const selected = layers.find(l => l.id === selectedLayerId);
        if (selected) setCopiedLayer({ ...selected });
        return;
      }

      if (withMod && key === 'v') {
        if (!copiedLayer || customPages.length === 0) return;
        e.preventDefault();
        pasteLayer(copiedLayer);
        return;
      }

      if ((key === 'delete' || key === 'backspace') && selectedLayerId) {
        e.preventDefault();
        deleteLayer(selectedLayerId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedLayerId, layers, copiedLayer, pageNum, customPages.length]);

  const renderTaskRef = useRef<any>(null);

  const renderPage = async () => {
    const currentPage = customPages[pageNum - 1];
    if (!currentPage || !canvasRef.current) return;
    
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (e) {}
    }
    
    const cv = canvasRef.current;
    
    if (currentPage.type === 'blank') {
      cv.width = 595 * scale;
      cv.height = 842 * scale;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      return;
    }
    
    if (!pdf) return;
    
    try {
      const page = await pdf.getPage(currentPage.pdfPageNum!);
      const vp = page.getViewport({ scale });
      cv.width = vp.width;
      cv.height = vp.height;
      
      const renderTask = page.render({ canvasContext: cv.getContext('2d')!, viewport: vp });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error(err);
      }
    }
  };

  const addBlankPage = () => {
    const newPages = [...customPages, { id: `blank-${Date.now()}`, type: 'blank' }];
    setCustomPages(newPages);
    setPageNum(newPages.length);
  };

  const addText = () => {
    const newLayer: Layer = {
      id: Date.now(),
      type: 'text',
      page: pageNum,
      x: 50,
      y: 50,
      content: 'Double-click to edit',
      w: 180,
      h: 44,
      fontFamily: 'Arial',
      fontSize: 18,
      color: '#000000',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left'
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
    setEditingTextId(newLayer.id);
  };

  const addShape = (shapeType: 'rect' | 'circle') => {
    const newLayer: Layer = {
      id: Date.now(),
      type: 'shape',
      page: pageNum,
      shapeType,
      x: 50,
      y: 50,
      w: 100,
      h: 100,
      fill: '#000000',
      stroke: '#000000',
      opacity: 1
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const url = URL.createObjectURL(e.target.files[0]);
    const newLayer: Layer = {
      id: Date.now(),
      type: 'img',
      page: pageNum,
      x: 50,
      y: 50,
      w: 150,
      h: 150,
      imgSrc: url
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  const updateLayer = (id: number, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const changeTextSize = (id: number, delta: number) => {
    const layer = layers.find(l => l.id === id);
    if (!layer || layer.type !== 'text') return;
    const current = layer.fontSize || 18;
    updateLayer(id, { fontSize: Math.max(6, Math.min(300, current + delta)) });
  };

  const copySelectedLayer = () => {
    const selected = layers.find(l => l.id === selectedLayerId);
    if (!selected) return;
    setCopiedLayer({ ...selected });
  };

  const pasteCopiedLayer = () => {
    if (!copiedLayer || customPages.length === 0) return;
    pasteLayer(copiedLayer);
  };

  const deleteLayer = (id: number) => {
    setLayers(layers.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const exportPdf = async () => {
    if (customPages.length === 0) return;
    setIsProcessing(true);
    
    try {
      let npdf: jsPDF | null = null;
      
      for (let i = 0; i < customPages.length; i++) {
        const currentPage = customPages[i];
        const cv = document.createElement('canvas');
        let vpWidth = 595 * 2;
        let vpHeight = 842 * 2;
        
        if (currentPage.type === 'pdf' && pdf) {
          const page = await pdf.getPage(currentPage.pdfPageNum!);
          const vp = page.getViewport({ scale: 2 });
          vpWidth = vp.width;
          vpHeight = vp.height;
          cv.width = vpWidth;
          cv.height = vpHeight;
          const ctx = cv.getContext('2d')!;
          // @ts-ignore
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        } else {
          cv.width = vpWidth;
          cv.height = vpHeight;
          const ctx = cv.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, vpWidth, vpHeight);
        }
        
        const ctx = cv.getContext('2d')!;
        const pageLayers = layers.filter(l => l.page === i + 1);
        
        for (const layer of pageLayers) {
          if (layer.type === 'text') {
            const bw = (layer.w || 140) * 2;
            const bh = (layer.h || 34) * 2;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(layer.x * 2, layer.y * 2, bw, bh);
            ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize! * 2}px ${layer.fontFamily}`;
            ctx.fillStyle = layer.color!;
            ctx.textAlign = layer.textAlign as CanvasTextAlign;
            
            const lines = (layer.content || '').split('\n');
            lines.forEach((line, lineIdx) => {
              ctx.fillText(line, layer.x * 2, layer.y * 2 + (layer.fontSize! * 2) + (lineIdx * layer.fontSize! * 2.4));
            });
          } else if (layer.type === 'shape') {
            ctx.globalAlpha = layer.opacity!;
            ctx.fillStyle = layer.fill!;
            ctx.strokeStyle = layer.stroke!;
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (layer.shapeType === 'rect') {
              ctx.rect(layer.x * 2, layer.y * 2, layer.w! * 2, layer.h! * 2);
              ctx.fill(); ctx.stroke();
            } else if (layer.shapeType === 'circle') {
              ctx.ellipse(layer.x * 2 + layer.w!, layer.y * 2 + layer.h!, layer.w!, layer.h!, 0, 0, Math.PI * 2);
              ctx.fill(); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          } else if (layer.type === 'img' && layer.imgSrc) {
            const img = await loadImgEl(layer.imgSrc);
            ctx.drawImage(img, layer.x * 2, layer.y * 2, layer.w! * 2, layer.h! * 2);
          }
        }
        
        const imgData = cv.toDataURL('image/jpeg', 0.95);
        const pw = vpWidth / 2;
        const ph = vpHeight / 2;
        
        if (!npdf) {
          npdf = new jsPDF({ orientation: pw > ph ? 'landscape' : 'portrait', unit: 'pt', format: [pw, ph] });
        } else {
          npdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
        }
        npdf.addImage(imgData, 'JPEG', 0, 0, pw, ph);
      }
      
      if (npdf) npdf.save('edited-document.pdf');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    if (editingTextId === id) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', id.toString());
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    e.dataTransfer.setData('offsetX', (e.clientX - rect.left).toString());
    e.dataTransfer.setData('offsetY', (e.clientY - rect.top).toString());
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(id)) return;
    
    const offsetX = parseFloat(e.dataTransfer.getData('offsetX'));
    const offsetY = parseFloat(e.dataTransfer.getData('offsetY'));
    
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / scale;
      const y = (e.clientY - rect.top - offsetY) / scale;
      updateLayer(id, { x, y });
    }
  };

  const startResize = (e: React.MouseEvent, id: number, handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w') => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    const textContent = layer.content || '';
    const textLines = textContent.split('\n');
    const longestLine = textLines.reduce((max, line) => Math.max(max, line.length), 0);
    const baseFontSize = layer.fontSize || 18;
    const autoW = Math.max(60, longestLine * baseFontSize * 0.6 + 12);
    const autoH = Math.max(baseFontSize * 1.5, textLines.length * baseFontSize * 1.2 + 12);
    const startW = layer.w || (layer.type === 'text' ? autoW : 100);
    const startH = layer.h || (layer.type === 'text' ? autoH : 100);
    const startFontSize = layer.fontSize || 18;
    const startLX = layer.x;
    const startLY = layer.y;
    const minSize = 20;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      let newW = startW;
      let newH = startH;
      let newX = startLX;
      let newY = startLY;
      
      if (handle.includes('e')) newW = startW + dx;
      if (handle.includes('s')) newH = startH + dy;
      if (handle.includes('w')) { newW = startW - dx; newX = startLX + dx; }
      if (handle.includes('n')) { newH = startH - dy; newY = startLY + dy; }
      
      if (newW < minSize) {
        if (handle.includes('w')) newX = startLX + (startW - minSize);
        newW = minSize;
      }
      if (newH < minSize) {
        if (handle.includes('n')) newY = startLY + (startH - minSize);
        newH = minSize;
      }

      if (layer.type === 'text') {
        const ratio = Math.min(newW / startW, newH / startH);
        const newFontSize = Math.max(6, Math.round(startFontSize * ratio));
        updateLayer(id, { w: newW, h: newH, x: newX, y: newY, fontSize: newFontSize });
      } else {
        updateLayer(id, { w: newW, h: newH, x: newX, y: newY });
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);
  
  const handleMainWheel = (e: React.WheelEvent) => {
    if (!mainScrollRef.current || customPages.length <= 1) return;
    const now = Date.now();
    if (now - wheelCooldownRef.current < 300) return;
    const el = mainScrollRef.current;
    const atTop = el.scrollTop <= 2;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    
    if (e.deltaY > 20 && atBottom && pageNum < customPages.length) {
      wheelCooldownRef.current = now;
      scrollTargetRef.current = 'top';
      setPageNum(pageNum + 1);
      e.preventDefault();
    } else if (e.deltaY < -20 && atTop && pageNum > 1) {
      wheelCooldownRef.current = now;
      scrollTargetRef.current = 'bottom';
      setPageNum(pageNum - 1);
      e.preventDefault();
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto z-20">
        <div className="p-4 border-b border-slate-800 font-bold text-sm flex items-center gap-2">
          <Edit2 className="w-4 h-4 text-indigo-400" /> PDF Editor
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div 
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5'}`}
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

        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Add Elements</div>
          <div className="flex gap-2">
            <button onClick={addText} disabled={customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><Type className="w-3 h-3" /> Text</button>
            <button onClick={() => addShape('rect')} disabled={customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><Square className="w-3 h-3" /> Shape</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => imgInputRef.current?.click()} disabled={customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><ImageIcon className="w-3 h-3" /> Image</button>
            <button onClick={addBlankPage} disabled={customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><FilePlus className="w-3 h-3" /> Blank Page</button>
          </div>
          <div className="flex gap-2">
            <button onClick={copySelectedLayer} disabled={!selectedLayerId} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><Copy className="w-3 h-3" /> Copy</button>
            <button onClick={pasteCopiedLayer} disabled={!copiedLayer || customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><ClipboardPaste className="w-3 h-3" /> Paste</button>
          </div>
          <div className="text-[10px] text-slate-500">Shortcut: Ctrl/Cmd + C, V, Z, Delete</div>
          <input type="file" ref={imgInputRef} className="hidden" accept="image/*" onChange={addImage} />
        </div>

        {selectedLayer && (
          <div className="p-4 border-b border-slate-800 space-y-3 bg-indigo-500/5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-center">
              Properties
              <button onClick={() => deleteLayer(selectedLayer.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
            </div>
            
            {selectedLayer.type === 'text' && (
              <>
                <div className="flex gap-2">
                  <input type="color" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-slate-800 border border-slate-700" title="Text Color" />
                  <input type="number" min="6" max="300" value={selectedLayer.fontSize} onChange={e => updateLayer(selectedLayer.id, { fontSize: Math.max(6, Math.min(300, Number(e.target.value) || 18)) })} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs outline-none focus:border-indigo-500" title="Font Size" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => changeTextSize(selectedLayer.id, -2)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-1.5 rounded-lg transition-colors">A-</button>
                  <input type="range" min="6" max="120" value={selectedLayer.fontSize || 18} onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })} className="flex-[2] accent-indigo-500" />
                  <button onClick={() => changeTextSize(selectedLayer.id, 2)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-1.5 rounded-lg transition-colors">A+</button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${selectedLayer.fontWeight === 'bold' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                  >
                    Bold
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={copySelectedLayer} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> Copy Text</button>
                  <button onClick={pasteCopiedLayer} disabled={!copiedLayer} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><ClipboardPaste className="w-3 h-3" /> Paste Text</button>
                </div>
                <div className="text-xs text-slate-400 italic mt-2">Double-click to edit. Drag handles to resize from any side.</div>
              </>
            )}
            
            {selectedLayer.type === 'shape' && (
              <>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 w-10">Fill</span>
                  <input type="color" value={selectedLayer.fill} onChange={e => updateLayer(selectedLayer.id, { fill: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-slate-800 border border-slate-700" />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 w-10">Stroke</span>
                  <input type="color" value={selectedLayer.stroke} onChange={e => updateLayer(selectedLayer.id, { stroke: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-slate-800 border border-slate-700" />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 w-10">Opacity</span>
                  <input type="range" min="0" max="1" step="0.05" value={selectedLayer.opacity} onChange={e => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })} className="flex-1 accent-indigo-500" />
                </div>
                <div className="text-[10px] text-slate-500">For full cover, keep opacity at 1.0 and use a dark fill.</div>
              </>
            )}
          </div>
        )}

        <div className="p-4 mt-auto">
          <button 
            onClick={exportPdf}
            disabled={customPages.length === 0 || isProcessing}
            className="w-full bg-gradient-to-br from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowDownToLine className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div
        ref={mainScrollRef}
        className="flex-1 overflow-auto bg-slate-950 p-6 flex flex-col items-center relative"
        onWheel={handleMainWheel}
        onClick={() => { setSelectedLayerId(null); setEditingTextId(null); }}
      >
        {customPages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Edit2 className="w-16 h-16 mb-4 opacity-50" />
            <div className="font-semibold text-lg text-slate-300">Open a PDF or start blank</div>
            <div className="text-sm mt-2">Use the sidebar to upload your file</div>
            <button onClick={() => {
              setCustomPages([{ id: `blank-${Date.now()}`, type: 'blank' }]);
              setPageNum(1);
            }} className="mt-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-6 rounded-full transition-colors">Start with Blank Page</button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 shadow-lg z-10 sticky top-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => setPageNum(Math.max(1, pageNum - 1))} disabled={pageNum <= 1} className="text-slate-400 hover:text-slate-200 disabled:opacity-30">◀</button>
              <span className="text-xs font-semibold text-slate-300 w-16 text-center">Page {pageNum} / {customPages.length}</span>
              <button onClick={() => setPageNum(Math.min(customPages.length, pageNum + 1))} disabled={pageNum >= customPages.length} className="text-slate-400 hover:text-slate-200 disabled:opacity-30">▶</button>
              <div className="w-px h-4 bg-slate-700"></div>
              <button onClick={() => setScale(Math.max(0.5, scale - 0.2))} className="text-slate-400 hover:text-slate-200"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-xs font-semibold text-slate-300 w-12 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(Math.min(3, scale + 0.2))} className="text-slate-400 hover:text-slate-200"><ZoomIn className="w-4 h-4" /></button>
            </div>
            
            <div 
              className="relative shadow-2xl bg-white"
              ref={overlayRef}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={(e) => { e.stopPropagation(); if (e.target === overlayRef.current) { setSelectedLayerId(null); setEditingTextId(null); } }}
            >
              <canvas ref={canvasRef} className="block pointer-events-none" />
              
              {layers.filter(l => l.page === pageNum).map(layer => (
                <div
                  key={layer.id}
                  draggable={editingTextId !== layer.id}
                  onDragStart={(e) => handleDragStart(e, layer.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); if (layer.type === 'text') setEditingTextId(layer.id); }}
                  className={`absolute ${editingTextId !== layer.id ? 'cursor-move' : 'cursor-text'} ${selectedLayerId === layer.id ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                  style={{
                      left: layer.x * scale,
  top: layer.y * scale,
  width: layer.type === 'text' ? (layer.w ? layer.w * scale : 'auto') : (layer.w ? layer.w * scale : '100px'),
  height: layer.type === 'text' ? (layer.h ? layer.h * scale : 'auto') : (layer.h ? layer.h * scale : '100px'),
  opacity: layer.opacity,
  color: layer.color,
  fontFamily: layer.fontFamily,
  fontSize: layer.fontSize ? layer.fontSize * scale : undefined,
  fontWeight: layer.fontWeight,
  fontStyle: layer.fontStyle,
  textDecoration: layer.textDecoration,
  textAlign: layer.textAlign as any,
  backgroundColor: layer.type === 'shape' ? layer.fill : 'White',
  border: layer.type === 'shape' ? `${2 * scale}px solid ${layer.stroke}` : 'none',
  borderRadius: layer.shapeType === 'circle' ? '50%' : '0',
  minWidth: layer.type === 'text' ? '30px' : undefined,
  padding: layer.type === 'text' ? `${2 * scale}px` : undefined,
  display: 'inline-block',
                  }}
                >
                  {layer.type === 'text' && (
  editingTextId === layer.id ? (
    <textarea
  value={layer.content}
  onChange={(e) => {
    updateLayer(layer.id, { content: e.target.value });
  }}
  className="bg-transparent outline-none resize-none overflow-hidden w-full h-full"
  style={{
    height: "100%",
    minHeight: "1em",
    lineHeight: "1.2"
  }}
/>
  ) : (
    <div className="whitespace-pre-wrap" style={{ lineHeight: '1.2' }}>{layer.content}</div>
  )
)}
                  {layer.type === 'img' && <img src={layer.imgSrc} alt="" className="w-full h-full object-contain pointer-events-none" />}
                  
                  {selectedLayerId === layer.id && (
                    <>
                      {[
                        { dir: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
                        { dir: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
                        { dir: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
                        { dir: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
                        { dir: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
                        { dir: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
                        { dir: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
                        { dir: 'w', left: '0%', top: '50%', cursor: 'ew-resize' },
                      ].map(h => (
                        <div
                          key={h.dir}
                          className="absolute w-3 h-3 bg-indigo-500 border-2 border-white rounded-full shadow-sm"
                          style={{ left: h.left, top: h.top, cursor: h.cursor, transform: 'translate(-50%, -50%)' }}
                          onMouseDown={(e) => startResize(e, layer.id, h.dir as any)}
                        />
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
