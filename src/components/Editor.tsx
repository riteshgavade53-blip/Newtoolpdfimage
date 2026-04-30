import React, { useState, useRef, useEffect } from 'react';
import { pdfjsLib, jsPDF, loadImgEl, JSZip } from '../utils/pdfUtils';
import { Edit2, FileText, ArrowDownToLine, Type, Square, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, FilePlus, Copy, ClipboardPaste, RotateCw, RotateCcw } from 'lucide-react';

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
  aspectRatio?: number;
  page: number;
}

interface CustomPage {
  id: string;
  type: 'pdf' | 'blank' | 'image';
  pdfDoc?: any;
  pdfPageNum?: number;
  rotation?: number;
  imageSrc?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export default function Editor() {
  const [fileLabel, setFileLabel] = useState<string>('');
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
  const pageHistoryRef = useRef<{ pages: CustomPage[]; layers: Layer[]; pageNum: number; fileLabel: string }[]>([]);
  const lastActionRef = useRef<'page-delete' | 'layer' | 'other'>('other');
  const pageActionRef = useRef(false);

  const createBlankPage = (): CustomPage => ({
    id: `blank-${Date.now()}`,
    type: 'blank',
    rotation: 0
  });

  const measureTextLayerSize = (layer: Layer) => {
    const fontSize = layer.fontSize || 18;
    const text = layer.content || '';
    const lines = text.split('\n');
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (measureCtx) {
      measureCtx.font = `${layer.fontStyle || 'normal'} ${layer.fontWeight || 'normal'} ${fontSize}px ${layer.fontFamily || 'Arial'}`;
    }
    const widestLine = lines.reduce((max, line) => {
      const measuredWidth = measureCtx ? measureCtx.measureText(line || ' ').width : line.length * fontSize * 0.6;
      return Math.max(max, measuredWidth);
    }, 0);
    return {
      w: Math.max(60, Math.ceil(widestLine + 12)),
      h: Math.max(fontSize * 1.5, Math.ceil(lines.length * fontSize * 1.2 + 12))
    };
  };

  const createImageLayerFromFile = async (file: File, targetPage = pageNum) => {
    const imgSrc = URL.createObjectURL(file);
    const img = await loadImgEl(imgSrc);
    const page = customPages[targetPage - 1];
    const pageSize = page ? await getPageBaseSize(page) : { w: 595, h: 842 };
    const maxW = Math.max(120, (pageSize?.w || 595) * 0.7);
    const maxH = Math.max(120, (pageSize?.h || 842) * 0.7);
    const fit = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const width = Math.max(60, Math.round(img.naturalWidth * fit));
    const height = Math.max(60, Math.round(img.naturalHeight * fit));

    return {
      id: Date.now(),
      type: 'img' as const,
      page: targetPage,
      x: 40,
      y: 40,
      w: width,
      h: height,
      imgSrc,
      aspectRatio: img.naturalWidth / img.naturalHeight
    };
  };

  const handleFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (!files.length) return;

    const valid = files.filter((f) => {
      const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
      const isImage = f.type.startsWith('image/');
      return isPdf || isImage;
    });
    if (!valid.length) return;

    const shouldReset = customPages.length === 0;
    if (shouldReset) {
      setLayers([]);
      setSelectedLayerId(null);
      setEditingTextId(null);
      setPageNum(1);
    }

    const newPages: CustomPage[] = [];
    let idCounter = 0;
    const base = Date.now();

    for (const f of valid) {
      const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
      const isImage = f.type.startsWith('image/');

      if (isPdf) {
        const buf = await f.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        const pdfPages: CustomPage[] = Array.from({ length: loadedPdf.numPages }, (_, i) => ({
          id: `pdf-${base}-${idCounter++}`,
          type: 'pdf',
          pdfDoc: loadedPdf,
          pdfPageNum: i + 1,
          rotation: 0
        }));
        newPages.push(...pdfPages);
      } else if (isImage) {
        const imageSrc = URL.createObjectURL(f);
        const img = await loadImgEl(imageSrc);
        newPages.push({
          id: `image-${base}-${idCounter++}`,
          type: 'image',
          imageSrc,
          imageWidth: img.naturalWidth,
          imageHeight: img.naturalHeight,
          rotation: 0
        });
      }
    }

    if (!newPages.length) return;
    setCustomPages(prev => shouldReset ? newPages : [...prev, ...newPages]);
    setFileLabel(valid.length === 1 ? valid[0].name : `${valid.length} files selected`);
  };

  useEffect(() => {
    if (customPages.length > 0) renderPage();
  }, [pageNum, scale, customPages]);
  
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

    if (pageActionRef.current) {
      pageActionRef.current = false;
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
    lastActionRef.current = 'layer';
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
        if (lastActionRef.current === 'page-delete' && pageHistoryRef.current.length > 0) {
          const previous = pageHistoryRef.current.pop()!;
          pageActionRef.current = true;
          isUndoingRef.current = true;
          setCustomPages(previous.pages.map(p => ({ ...p })));
          setLayers(previous.layers.map(l => ({ ...l })));
          setPageNum(previous.pageNum);
          setFileLabel(previous.fileLabel);
          setSelectedLayerId(null);
          setEditingTextId(null);
          lastActionRef.current = pageHistoryRef.current.length > 0 ? 'page-delete' : 'other';
          return;
        }
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

      if ((key === 'delete' || key === 'backspace') && selectedLayerId) {
        e.preventDefault();
        deleteLayer(selectedLayerId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedLayerId, layers, copiedLayer, pageNum, customPages.length]);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (isTypingTarget) return;

      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (!file) return;
        e.preventDefault();

        if (customPages.length === 0) {
          const blankPage = createBlankPage();
          const imageLayer = await createImageLayerFromFile(file, 1);
          setCustomPages([blankPage]);
          setLayers([imageLayer]);
          setPageNum(1);
          setSelectedLayerId(imageLayer.id);
          setEditingTextId(null);
          setFileLabel('Blank Page');
          return;
        }

        const imageLayer = await createImageLayerFromFile(file, pageNum);
        setLayers(prev => [...prev, imageLayer]);
        setSelectedLayerId(imageLayer.id);
        setEditingTextId(null);
        return;
      }

      if (copiedLayer && customPages.length > 0) {
        e.preventDefault();
        pasteLayer(copiedLayer);
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [copiedLayer, customPages, pageNum]);

  const renderTaskRef = useRef<any>(null);

  const renderPage = async () => {
    const currentPage = customPages[pageNum - 1];
    if (!currentPage || !canvasRef.current) return;
    
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (e) {}
    }
    
    const cv = canvasRef.current;
    
    const rotation = currentPage.rotation || 0;

    if (currentPage.type === 'blank') {
      const baseW = 595;
      const baseH = 842;
      const rotSwap = rotation === 90 || rotation === 270;
      cv.width = (rotSwap ? baseH : baseW) * scale;
      cv.height = (rotSwap ? baseW : baseH) * scale;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      return;
    }

    if (currentPage.type === 'image' && currentPage.imageSrc) {
      const img = await loadImgEl(currentPage.imageSrc);
      const naturalW = currentPage.imageWidth || img.naturalWidth;
      const naturalH = currentPage.imageHeight || img.naturalHeight;
      const fitRatio = Math.min(1, 1200 / Math.max(naturalW, naturalH));
      const baseW = Math.max(1, Math.round(naturalW * fitRatio));
      const baseH = Math.max(1, Math.round(naturalH * fitRatio));
      const rotSwap = rotation === 90 || rotation === 270;
      cv.width = Math.max(1, Math.round((rotSwap ? baseH : baseW) * scale));
      cv.height = Math.max(1, Math.round((rotSwap ? baseW : baseH) * scale));
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.save();
      if (rotation === 90) {
        ctx.translate(cv.width, 0);
        ctx.rotate(Math.PI / 2);
      } else if (rotation === 180) {
        ctx.translate(cv.width, cv.height);
        ctx.rotate(Math.PI);
      } else if (rotation === 270) {
        ctx.translate(0, cv.height);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.drawImage(img, 0, 0, baseW * scale, baseH * scale);
      ctx.restore();
      return;
    }
    
    try {
      if (!currentPage.pdfDoc) return;
      const page = await currentPage.pdfDoc.getPage(currentPage.pdfPageNum!);
      const vp = page.getViewport({ scale, rotation });
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
    const newPages = [...customPages, createBlankPage()];
    setCustomPages(newPages);
    setPageNum(newPages.length);
    if (!fileLabel) setFileLabel('Blank Page');
  };

  const getLayerAutoSize = (layer: Layer) => {
    if (layer.type !== 'text') {
      return {
        w: layer.w || 100,
        h: layer.h || 100
      };
    }
    const { w: autoW, h: autoH } = measureTextLayerSize(layer);
    return {
      w: layer.w || autoW,
      h: layer.h || autoH
    };
  };

  const getPageBaseSize = async (page: CustomPage) => {
    const rotation = page.rotation || 0;
    if (page.type === 'blank') {
      const baseW = 595;
      const baseH = 842;
      const rotSwap = rotation === 90 || rotation === 270;
      return { w: rotSwap ? baseH : baseW, h: rotSwap ? baseW : baseH };
    }
    if (page.type === 'image' && page.imageSrc) {
      const naturalW = page.imageWidth || 1;
      const naturalH = page.imageHeight || 1;
      const fitRatio = Math.min(1, 1200 / Math.max(naturalW, naturalH));
      const baseW = Math.max(1, Math.round(naturalW * fitRatio));
      const baseH = Math.max(1, Math.round(naturalH * fitRatio));
      const rotSwap = rotation === 90 || rotation === 270;
      return { w: rotSwap ? baseH : baseW, h: rotSwap ? baseW : baseH };
    }
    if (page.type === 'pdf' && page.pdfDoc) {
      const pdfPage = await page.pdfDoc.getPage(page.pdfPageNum!);
      const vp = pdfPage.getViewport({ scale: 1, rotation });
      return { w: vp.width, h: vp.height };
    }
    return null;
  };

  const rotateCurrentPage = async (dir: 'cw' | 'ccw') => {
    const current = customPages[pageNum - 1];
    if (!current) return;
    const delta = dir === 'cw' ? 90 : -90;
    const baseSize = await getPageBaseSize(current);
    if (!baseSize) return;

    const W = baseSize.w;
    const H = baseSize.h;

    setLayers(prev => prev.map(layer => {
      if (layer.page !== pageNum) return layer;
      const { w, h } = getLayerAutoSize(layer);
      let newX = layer.x;
      let newY = layer.y;
      let newW = w;
      let newH = h;

      if (delta === 90) {
        newX = H - (layer.y + h);
        newY = layer.x;
        newW = h;
        newH = w;
      } else if (delta === -90) {
        newX = layer.y;
        newY = W - (layer.x + w);
        newW = h;
        newH = w;
      }

      return { ...layer, x: newX, y: newY, w: newW, h: newH };
    }));

    setCustomPages(prev => prev.map((p, idx) => {
      if (idx !== pageNum - 1) return p;
      const currentRot = p.rotation || 0;
      const nextRot = (currentRot + delta + 360) % 360;
      return { ...p, rotation: nextRot };
    }));
  };

  const deleteCurrentPage = () => {
    if (customPages.length === 0) return;
    const removeIndex = pageNum - 1;
    pageHistoryRef.current.push({
      pages: customPages.map(p => ({ ...p })),
      layers: layers.map(l => ({ ...l })),
      pageNum,
      fileLabel
    });
    lastActionRef.current = 'page-delete';
    pageActionRef.current = true;
    setCustomPages(prev => prev.filter((_, idx) => idx !== removeIndex));
    setLayers(prev => prev
      .filter(l => l.page !== pageNum)
      .map(l => l.page > pageNum ? { ...l, page: l.page - 1 } : l)
    );
    setSelectedLayerId(null);
    setEditingTextId(null);
    setPageNum(prev => {
      if (customPages.length === 1) return 1;
      if (pageNum === customPages.length) return Math.max(1, prev - 1);
      return prev;
    });
    if (customPages.length === 1) setFileLabel('');
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
    createImageLayerFromFile(e.target.files[0]).then((newLayer) => {
      setLayers(prev => [...prev, newLayer]);
      setSelectedLayerId(newLayer.id);
      setEditingTextId(null);
    });
    e.target.value = '';
  };

  const updateLayer = (id: number, updates: Partial<Layer>) => {
    setLayers(prev => prev.map((layer) => {
      if (layer.id !== id) return layer;
      const nextLayer = { ...layer, ...updates };
      if (nextLayer.type === 'text') {
        // Only enforce min size when NOT actively changing content (e.g. resize handles)
        if (!('content' in updates)) {
          const minSize = measureTextLayerSize(nextLayer);
          nextLayer.w = Math.max(nextLayer.w || 0, minSize.w);
          nextLayer.h = Math.max(nextLayer.h || 0, minSize.h);
        }
      } else if (nextLayer.type === 'img') {
        const ratio = nextLayer.aspectRatio || layer.aspectRatio || ((layer.w && layer.h) ? layer.w / layer.h : 1);
        if (updates.w != null && updates.h == null) {
          nextLayer.h = Math.max(20, Math.round((updates.w as number) / ratio));
        } else if (updates.h != null && updates.w == null) {
          nextLayer.w = Math.max(20, Math.round((updates.h as number) * ratio));
        }
      }
      return nextLayer;
    }));
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

  const exportPdfWithOptions = async (jpegQuality: number, baseScale: number, filename: string) => {
    if (customPages.length === 0) return;
    setIsProcessing(true);
    
    try {
        let npdf: jsPDF | null = null;
      
      for (let i = 0; i < customPages.length; i++) {
        const currentPage = customPages[i];
        const cv = document.createElement('canvas');
        let vpWidth = 595 * baseScale;
        let vpHeight = 842 * baseScale;
        let exportScale = baseScale;
        const rotation = currentPage.rotation || 0;
        
        if (currentPage.type === 'pdf' && currentPage.pdfDoc) {
          const page = await currentPage.pdfDoc.getPage(currentPage.pdfPageNum!);
          const vp = page.getViewport({ scale: baseScale, rotation });
          vpWidth = vp.width;
          vpHeight = vp.height;
          cv.width = vpWidth;
          cv.height = vpHeight;
          const ctx = cv.getContext('2d')!;
          // @ts-ignore
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        } else if (currentPage.type === 'image' && currentPage.imageSrc) {
          const img = await loadImgEl(currentPage.imageSrc);
          const naturalW = currentPage.imageWidth || img.naturalWidth;
          const naturalH = currentPage.imageHeight || img.naturalHeight;
          const fitRatio = Math.min(1, 1200 / Math.max(naturalW, naturalH));
          exportScale = baseScale / fitRatio;
          const baseW = naturalW * baseScale;
          const baseH = naturalH * baseScale;
          const rotSwap = rotation === 90 || rotation === 270;
          vpWidth = rotSwap ? baseH : baseW;
          vpHeight = rotSwap ? baseW : baseH;
          cv.width = vpWidth;
          cv.height = vpHeight;
          const ctx = cv.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, vpWidth, vpHeight);
          ctx.save();
          if (rotation === 90) {
            ctx.translate(vpWidth, 0);
            ctx.rotate(Math.PI / 2);
          } else if (rotation === 180) {
            ctx.translate(vpWidth, vpHeight);
            ctx.rotate(Math.PI);
          } else if (rotation === 270) {
            ctx.translate(0, vpHeight);
            ctx.rotate(-Math.PI / 2);
          }
          ctx.drawImage(img, 0, 0, baseW, baseH);
          ctx.restore();
        } else {
          if (currentPage.type === 'blank') {
            const rotSwap = rotation === 90 || rotation === 270;
            vpWidth = (rotSwap ? 842 : 595) * baseScale;
            vpHeight = (rotSwap ? 595 : 842) * baseScale;
          }
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
            const bw = (layer.w || 140) * exportScale;
            const bh = (layer.h || 34) * exportScale;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(layer.x * exportScale, layer.y * exportScale, bw, bh);
            ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize! * exportScale}px ${layer.fontFamily}`;
            ctx.fillStyle = layer.color!;
            ctx.textAlign = layer.textAlign as CanvasTextAlign;
            
            const lines = (layer.content || '').split('\n');
            lines.forEach((line, lineIdx) => {
              ctx.fillText(line, layer.x * exportScale, layer.y * exportScale + (layer.fontSize! * exportScale) + (lineIdx * layer.fontSize! * exportScale * 1.2));
            });
          } else if (layer.type === 'shape') {
            ctx.globalAlpha = layer.opacity!;
            ctx.fillStyle = layer.fill!;
            ctx.strokeStyle = layer.stroke!;
            ctx.lineWidth = 2 * exportScale;
            ctx.beginPath();
            if (layer.shapeType === 'rect') {
              ctx.rect(layer.x * exportScale, layer.y * exportScale, layer.w! * exportScale, layer.h! * exportScale);
              ctx.fill(); ctx.stroke();
            } else if (layer.shapeType === 'circle') {
              const rx = (layer.w! * exportScale) / 2;
              const ry = (layer.h! * exportScale) / 2;
              ctx.ellipse(layer.x * exportScale + rx, layer.y * exportScale + ry, rx, ry, 0, 0, Math.PI * 2);
              ctx.fill(); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          } else if (layer.type === 'img' && layer.imgSrc) {
            const img = await loadImgEl(layer.imgSrc);
            ctx.drawImage(img, layer.x * exportScale, layer.y * exportScale, layer.w! * exportScale, layer.h! * exportScale);
          }
        }
        
        const imgData = cv.toDataURL('image/jpeg', jpegQuality);
        const pw = vpWidth / baseScale;
        const ph = vpHeight / baseScale;
        
        if (!npdf) {
          npdf = new jsPDF({ orientation: pw > ph ? 'landscape' : 'portrait', unit: 'pt', format: [pw, ph] });
        } else {
          npdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
        }
        npdf.addImage(imgData, 'JPEG', 0, 0, pw, ph);
      }
      
      if (npdf) npdf.save(filename);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportPdf = () => exportPdfWithOptions(0.95, 2, 'edited-document.pdf');
  const exportCompressedPdf = (level: 'low' | 'normal' | 'high') => {
    const options = {
      low: { jpegQuality: 0.8, baseScale: 1.5, filename: 'edited-document-low-compression.pdf' },
      normal: { jpegQuality: 0.65, baseScale: 1.2, filename: 'edited-document-normal-compression.pdf' },
      high: { jpegQuality: 0.45, baseScale: 1, filename: 'edited-document-high-compression.pdf' }
    } as const;
    const selected = options[level];
    exportPdfWithOptions(selected.jpegQuality, selected.baseScale, selected.filename);
  };

  const exportImagesZip = async () => {
    if (customPages.length === 0) return;
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      const baseScale = 2;
      const jpegQuality = 0.95;

      for (let i = 0; i < customPages.length; i++) {
        const currentPage = customPages[i];
        const cv = document.createElement('canvas');
        let vpWidth = 595 * baseScale;
        let vpHeight = 842 * baseScale;
        let exportScale = baseScale;
        const rotation = currentPage.rotation || 0;

        if (currentPage.type === 'pdf' && currentPage.pdfDoc) {
          const page = await currentPage.pdfDoc.getPage(currentPage.pdfPageNum!);
          const vp = page.getViewport({ scale: baseScale, rotation });
          vpWidth = vp.width;
          vpHeight = vp.height;
          cv.width = vpWidth;
          cv.height = vpHeight;
          const ctx = cv.getContext('2d')!;
          // @ts-ignore
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        } else if (currentPage.type === 'image' && currentPage.imageSrc) {
          const img = await loadImgEl(currentPage.imageSrc);
          const naturalW = currentPage.imageWidth || img.naturalWidth;
          const naturalH = currentPage.imageHeight || img.naturalHeight;
          const fitRatio = Math.min(1, 1200 / Math.max(naturalW, naturalH));
          exportScale = baseScale / fitRatio;
          const baseW = naturalW * baseScale;
          const baseH = naturalH * baseScale;
          const rotSwap = rotation === 90 || rotation === 270;
          vpWidth = rotSwap ? baseH : baseW;
          vpHeight = rotSwap ? baseW : baseH;
          cv.width = vpWidth;
          cv.height = vpHeight;
          const ctx = cv.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, vpWidth, vpHeight);
          ctx.save();
          if (rotation === 90) {
            ctx.translate(vpWidth, 0);
            ctx.rotate(Math.PI / 2);
          } else if (rotation === 180) {
            ctx.translate(vpWidth, vpHeight);
            ctx.rotate(Math.PI);
          } else if (rotation === 270) {
            ctx.translate(0, vpHeight);
            ctx.rotate(-Math.PI / 2);
          }
          ctx.drawImage(img, 0, 0, baseW, baseH);
          ctx.restore();
        } else {
          if (currentPage.type === 'blank') {
            const rotSwap = rotation === 90 || rotation === 270;
            vpWidth = (rotSwap ? 842 : 595) * baseScale;
            vpHeight = (rotSwap ? 595 : 842) * baseScale;
          }
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
            const bw = (layer.w || 140) * exportScale;
            const bh = (layer.h || 34) * exportScale;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(layer.x * exportScale, layer.y * exportScale, bw, bh);
            ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize! * exportScale}px ${layer.fontFamily}`;
            ctx.fillStyle = layer.color!;
            ctx.textAlign = layer.textAlign as CanvasTextAlign;

            const lines = (layer.content || '').split('\n');
            lines.forEach((line, lineIdx) => {
              ctx.fillText(line, layer.x * exportScale, layer.y * exportScale + (layer.fontSize! * exportScale) + (lineIdx * layer.fontSize! * exportScale * 1.2));
            });
          } else if (layer.type === 'shape') {
            ctx.globalAlpha = layer.opacity!;
            ctx.fillStyle = layer.fill!;
            ctx.strokeStyle = layer.stroke!;
            ctx.lineWidth = 2 * exportScale;
            ctx.beginPath();
            if (layer.shapeType === 'rect') {
              ctx.rect(layer.x * exportScale, layer.y * exportScale, layer.w! * exportScale, layer.h! * exportScale);
              ctx.fill(); ctx.stroke();
            } else if (layer.shapeType === 'circle') {
              const rx = (layer.w! * exportScale) / 2;
              const ry = (layer.h! * exportScale) / 2;
              ctx.ellipse(layer.x * exportScale + rx, layer.y * exportScale + ry, rx, ry, 0, 0, Math.PI * 2);
              ctx.fill(); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          } else if (layer.type === 'img' && layer.imgSrc) {
            const img = await loadImgEl(layer.imgSrc);
            ctx.drawImage(img, layer.x * exportScale, layer.y * exportScale, layer.w! * exportScale, layer.h! * exportScale);
          }
        }

        const dataUrl = cv.toDataURL('image/jpeg', jpegQuality);
        const base64 = dataUrl.split(',')[1];
        const name = `page-${String(i + 1).padStart(3, '0')}.jpg`;
        zip.file(name, base64, { base64: true });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pages-images.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
    const autoSize = layer.type === 'text' ? measureTextLayerSize(layer) : { w: 100, h: 100 };
    const startW = layer.w || autoSize.w;
    const startH = layer.h || autoSize.h;
    const startFontSize = layer.fontSize || 18;
    const startLX = layer.x;
    const startLY = layer.y;
    const minSize = layer.type === 'shape' ? 2 : 20;

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
        const widthRatio = newW / startW;
        const heightRatio = newH / startH;
        const ratio = handle === 'e' || handle === 'w'
          ? widthRatio
          : handle === 'n' || handle === 's'
            ? heightRatio
            : Math.min(widthRatio, heightRatio);
        const newFontSize = Math.max(6, Math.round(startFontSize * ratio));
        const measuredSize = measureTextLayerSize({ ...layer, fontSize: newFontSize });
        const finalW = Math.max(newW, measuredSize.w);
        const finalH = Math.max(newH, measuredSize.h);
        if (handle.includes('w')) newX = startLX + (startW - finalW);
        if (handle.includes('n')) newY = startLY + (startH - finalH);
        updateLayer(id, { w: finalW, h: finalH, x: newX, y: newY, fontSize: newFontSize });
      } else if (layer.type === 'img') {
        const ratio = layer.aspectRatio || (startW / startH) || 1;
        let finalW = newW;
        let finalH = newH;

        if (handle === 'e' || handle === 'w') {
          finalH = Math.max(minSize, Math.round(finalW / ratio));
        } else if (handle === 'n' || handle === 's') {
          finalW = Math.max(minSize, Math.round(finalH * ratio));
        } else {
          const dominantScale = Math.max(finalW / startW, finalH / startH);
          finalW = Math.max(minSize, Math.round(startW * dominantScale));
          finalH = Math.max(minSize, Math.round(finalW / ratio));
        }

        if (handle.includes('w')) newX = startLX + (startW - finalW);
        if (handle.includes('n')) newY = startLY + (startH - finalH);
        updateLayer(id, { w: finalW, h: finalH, x: newX, y: newY });
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
          <Edit2 className="w-4 h-4 text-indigo-400" /> PDF & Image Editor
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div 
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          >
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <div className="text-sm font-semibold mb-1 truncate px-2">{fileLabel || 'Upload PDF or Image(s)'}</div>
            <div className="text-xs text-slate-500">Click or drag & drop (multiple supported)</div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,image/*"
            multiple
            onChange={(e) => {
              handleFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
        </div>

        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Add Elements</div>
          <div className="flex gap-2">
            <button onClick={addText} disabled={customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><Type className="w-3 h-3" /> Text</button>
            <button onClick={() => addShape('rect')} disabled={customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><Square className="w-3 h-3" /> Shape</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => imgInputRef.current?.click()} disabled={customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><ImageIcon className="w-3 h-3" /> Image</button>
            <button onClick={addBlankPage} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"><FilePlus className="w-3 h-3" /> Blank Page</button>
          </div>
          <div className="flex gap-2">
            <button onClick={copySelectedLayer} disabled={!selectedLayerId} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><Copy className="w-3 h-3" /> Copy</button>
            <button onClick={pasteCopiedLayer} disabled={!copiedLayer || customPages.length === 0} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><ClipboardPaste className="w-3 h-3" /> Paste</button>
          </div>
          <div className="text-[10px] text-slate-500">Shortcut: Ctrl/Cmd + C, V, Z, Delete. Clipboard image paste supported.</div>
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

            {selectedLayer.type === 'img' && (
              <>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 w-12">Width</span>
                  <input
                    type="number"
                    min="20"
                    max="2000"
                    value={Math.round(selectedLayer.w || 150)}
                    onChange={e => updateLayer(selectedLayer.id, { w: Math.max(20, Number(e.target.value) || 150) })}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 w-12">Height</span>
                  <input
                    type="number"
                    min="20"
                    max="2000"
                    value={Math.round(selectedLayer.h || 150)}
                    onChange={e => updateLayer(selectedLayer.id, { h: Math.max(20, Number(e.target.value) || 150) })}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="text-[10px] text-slate-500">Click image to select, then drag or resize from handles.</div>
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
          <div className="mt-2 rounded-lg border border-slate-800 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Compressed PDF</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                onClick={() => exportCompressedPdf('low')}
                disabled={customPages.length === 0 || isProcessing}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-2 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Low compression, better quality"
              >
                Low
              </button>
              <button
                onClick={() => exportCompressedPdf('normal')}
                disabled={customPages.length === 0 || isProcessing}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-2 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Balanced compression"
              >
                Normal
              </button>
              <button
                onClick={() => exportCompressedPdf('high')}
                disabled={customPages.length === 0 || isProcessing}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-2 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="High compression, smaller file"
              >
                High
              </button>
            </div>
          </div>
          <button
            onClick={exportImagesZip}
            disabled={customPages.length === 0 || isProcessing}
            className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download all pages as JPG images in a ZIP"
          >
            <ArrowDownToLine className="w-4 h-4" /> Export Images ZIP
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
            <div className="font-semibold text-lg text-slate-300">Open a PDF, image, or start blank</div>
            <div className="text-sm mt-2">Use the sidebar to upload your file</div>
            <button onClick={addBlankPage} className="mt-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-6 rounded-full transition-colors">Start with Blank Page</button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 shadow-lg z-10 sticky top-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => setPageNum(Math.max(1, pageNum - 1))} disabled={pageNum <= 1} className="text-slate-400 hover:text-slate-200 disabled:opacity-30">◀</button>
              <span className="text-xs font-semibold text-slate-300 w-16 text-center">Page {pageNum} / {customPages.length}</span>
              <button onClick={() => setPageNum(Math.min(customPages.length, pageNum + 1))} disabled={pageNum >= customPages.length} className="text-slate-400 hover:text-slate-200 disabled:opacity-30">▶</button>
              <div className="w-px h-4 bg-slate-700"></div>
              <button onClick={() => rotateCurrentPage('ccw')} disabled={customPages.length === 0} className="text-slate-400 hover:text-slate-200 disabled:opacity-30" title="Rotate Left"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => rotateCurrentPage('cw')} disabled={customPages.length === 0} className="text-slate-400 hover:text-slate-200 disabled:opacity-30" title="Rotate Right"><RotateCw className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-slate-700"></div>
              <button onClick={() => setScale(Math.max(0.5, scale - 0.2))} className="text-slate-400 hover:text-slate-200"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-xs font-semibold text-slate-300 w-12 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(Math.min(3, scale + 0.2))} className="text-slate-400 hover:text-slate-200"><ZoomIn className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-slate-700"></div>
              <button onClick={deleteCurrentPage} disabled={customPages.length === 0} className="text-red-400 hover:text-red-300 disabled:opacity-30" title="Delete Page"><Trash2 className="w-4 h-4" /></button>
            </div>
            
            <div 
              className="relative shadow-2xl bg-white border border-slate-300"
              ref={overlayRef}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={(e) => { e.stopPropagation(); if (e.target === overlayRef.current) { setSelectedLayerId(null); setEditingTextId(null); } }}
              style={customPages[pageNum - 1]?.type === 'blank' ? {
                backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
                backgroundSize: `${24 * scale}px ${24 * scale}px`
              } : undefined}
            >
              <canvas ref={canvasRef} className="block pointer-events-none" />
              
              {layers.filter(l => l.page === pageNum).map(layer => (
                <div
                  key={layer.id}
                  draggable={editingTextId !== layer.id}
                  onDragStart={(e) => handleDragStart(e, layer.id)}
                  onMouseDown={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); }}
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
  backgroundColor: layer.type === 'shape' ? layer.fill : 'white',
  border: layer.type === 'shape' ? `${2 * scale}px solid ${layer.stroke}` : 'none',
  borderRadius: layer.shapeType === 'circle' ? '50%' : '0',
  minWidth: layer.type === 'text' ? '30px' : undefined,
  padding: layer.type === 'text' ? `${2 * scale}px ${4 * scale}px` : undefined,
  boxSizing: 'border-box' as const,
  display: 'flex',
                  }}
                >
                  {layer.type === 'text' && (
  editingTextId === layer.id ? (
    <textarea
  autoFocus
  value={layer.content}
  onChange={(e) => {
    const newContent = e.target.value;
    const el = e.target;
    // Force textarea to shrink by resetting height to minimum, then read actual scrollHeight
    el.style.height = '1px';
    const actualH = Math.ceil(el.scrollHeight / scale);
    el.style.height = '';
    // Width from canvas measurement (unscaled)
    const tempLayer = { ...layer, content: newContent };
    const { w: measuredW } = measureTextLayerSize(tempLayer);
    const newW = Math.max(60, measuredW);
    const newH = Math.max(actualH, Math.ceil((layer.fontSize || 18) * 1.4));
    updateLayer(layer.id, { content: newContent, w: newW, h: newH });
  }}
  onMouseDown={(e) => e.stopPropagation()}
  className="bg-transparent outline-none resize-none w-full h-full block"
  style={{
    lineHeight: "1.2",
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize ? layer.fontSize * scale : undefined,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    color: layer.color,
    textAlign: layer.textAlign as any,
    padding: 0,
    margin: 0,
    border: 'none',
    overflowY: 'hidden',
    boxSizing: 'border-box',
  }}
/>
  ) : (
    <div className="whitespace-pre-wrap w-full h-full" style={{ lineHeight: '1.2', wordBreak: 'break-word' }}>{layer.content}</div>
  )
)}
                  {layer.type === 'img' && (
                    <img
                      src={layer.imgSrc}
                      alt=""
                      draggable={false}
                      onMouseDown={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); }}
                      className="w-full h-full object-fill"
                    />
                  )}
                  
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
