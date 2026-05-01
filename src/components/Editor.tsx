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

  const measureTextLayerSize = (layer: Layer, measureScale = 1) => {
    const fontSize = (layer.fontSize || 18) * measureScale;
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
    const scaledW = Math.max(60 * measureScale, Math.ceil(widestLine + 12 * measureScale));
    const scaledH = Math.max(fontSize * 1.5, Math.ceil(lines.length * fontSize * 1.2 + 8 * measureScale));
    return {
      w: scaledW / measureScale,
      h: scaledH / measureScale,
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
      if (nextLayer.type === 'img') {
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
    <div className="flex h-full overflow-hidden" style={{ background: '#07070f', fontFamily: "'Inter', sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <div
        className="w-72 flex flex-col shrink-0 overflow-y-auto z-20"
        style={{
          background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a14 100%)',
          borderRight: '1px solid rgba(99,91,255,0.18)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="p-4 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(99,91,255,0.15)' }}
        >
          <div
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #635bff 0%, #a78bfa 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99,91,255,0.45)',
            }}
          >
            <Edit2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">PDF & Image Editor</div>
            <div className="text-[10px] text-indigo-400 font-medium tracking-wide">PREMIUM EDITOR</div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="p-4" style={{ borderBottom: '1px solid rgba(99,91,255,0.12)' }}>
          <div
            className="rounded-xl p-5 text-center cursor-pointer transition-all"
            style={{
              border: isDragging ? '2px solid #635bff' : '2px dashed rgba(99,91,255,0.35)',
              background: isDragging ? 'rgba(99,91,255,0.12)' : 'rgba(99,91,255,0.05)',
              boxShadow: isDragging ? '0 0 24px rgba(99,91,255,0.2)' : 'none',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: 12, margin: '0 auto 10px',
                background: 'linear-gradient(135deg, rgba(99,91,255,0.25), rgba(167,139,250,0.15))',
                border: '1px solid rgba(99,91,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FileText className="w-5 h-5" style={{ color: '#a5b4fc' }} />
            </div>
            <div className="text-sm font-semibold mb-1 truncate px-2 text-slate-200">
              {fileLabel || 'Upload PDF or Image(s)'}
            </div>
            <div className="text-[11px]" style={{ color: '#64748b' }}>Click or drag & drop</div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" multiple
            onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        {/* Add Elements */}
        <div className="p-4 space-y-2" style={{ borderBottom: '1px solid rgba(99,91,255,0.12)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: '#635bff', letterSpacing: '0.1em' }}>
            ✦ Add Elements
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Text', icon: <Type className="w-4 h-4" />, onClick: addText, disabled: customPages.length === 0, color: '#635bff', glow: 'rgba(99,91,255,0.35)' },
              { label: 'Shape', icon: <Square className="w-4 h-4" />, onClick: () => addShape('rect'), disabled: customPages.length === 0, color: '#10b981', glow: 'rgba(16,185,129,0.35)' },
              { label: 'Image', icon: <ImageIcon className="w-4 h-4" />, onClick: () => imgInputRef.current?.click(), disabled: customPages.length === 0, color: '#f97316', glow: 'rgba(249,115,22,0.35)' },
              { label: 'Blank Page', icon: <FilePlus className="w-4 h-4" />, onClick: addBlankPage, disabled: false, color: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                disabled={btn.disabled}
                className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40"
                style={{
                  background: `linear-gradient(135deg, #0d0d1a 0%, #0a0a14 60%, ${btn.color}18 100%)`,
                  border: `1px solid ${btn.color}35`,
                  color: btn.color,
                  minHeight: 64,
                }}
                onMouseEnter={e => { if (!btn.disabled) { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 18px ${btn.glow}`; (e.currentTarget as HTMLElement).style.borderColor = `${btn.color}70`; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = `${btn.color}35`; }}
              >
                {btn.icon}
                <span>{btn.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={copySelectedLayer} disabled={!selectedLayerId}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button onClick={pasteCopiedLayer} disabled={!copiedLayer || customPages.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              <ClipboardPaste className="w-3 h-3" /> Paste
            </button>
          </div>
          <div className="text-[10px] pt-1" style={{ color: '#334155' }}>Ctrl/Cmd + C, V, Z, Delete supported</div>
          <input type="file" ref={imgInputRef} className="hidden" accept="image/*" onChange={addImage} />
        </div>

        {/* Properties Panel */}
        {selectedLayer && (
          <div className="p-4 space-y-3" style={{ borderBottom: '1px solid rgba(99,91,255,0.12)', background: 'rgba(99,91,255,0.04)' }}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#635bff' }}>
                ✦ Properties
              </span>
              <button onClick={() => deleteLayer(selectedLayer.id)}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>

            {selectedLayer.type === 'text' && (
              <>
                <div className="flex gap-2">
                  <input type="color" value={selectedLayer.color}
                    onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}
                    className="w-9 h-9 rounded-lg cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }} title="Text Color" />
                  <input type="number" min="6" max="300" value={selectedLayer.fontSize}
                    onChange={e => updateLayer(selectedLayer.id, { fontSize: Math.max(6, Math.min(300, Number(e.target.value) || 18)) })}
                    className="flex-1 px-3 py-2 rounded-lg text-xs outline-none text-slate-200"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,91,255,0.25)' }} title="Font Size" />
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => changeTextSize(selectedLayer.id, -2)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-300"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>A-</button>
                  <input type="range" min="6" max="120" value={selectedLayer.fontSize || 18}
                    onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                    className="flex-1 accent-indigo-500" />
                  <button onClick={() => changeTextSize(selectedLayer.id, 2)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-300"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>A+</button>
                </div>
                <button
                  onClick={() => updateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight === 'bold' ? 'normal' : 'bold' })}
                  className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                  style={selectedLayer.fontWeight === 'bold'
                    ? { background: 'linear-gradient(135deg, #635bff, #a78bfa)', color: '#fff', border: '1px solid #635bff', boxShadow: '0 4px 16px rgba(99,91,255,0.4)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  Bold
                </button>
                <div className="flex gap-2">
                  <button onClick={copySelectedLayer}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button onClick={pasteCopiedLayer} disabled={!copiedLayer}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <ClipboardPaste className="w-3 h-3" /> Paste
                  </button>
                </div>
                <div className="text-[10px] italic" style={{ color: '#334155' }}>Double-click to edit. Drag handles to resize.</div>
              </>
            )}

            {selectedLayer.type === 'shape' && (
              <>
                {[
                  { label: 'Fill', value: selectedLayer.fill, key: 'fill' as const },
                  { label: 'Stroke', value: selectedLayer.stroke, key: 'stroke' as const },
                ].map(({ label, value, key }) => (
                  <div key={key} className="flex gap-3 items-center">
                    <span className="text-xs w-12 font-medium" style={{ color: '#64748b' }}>{label}</span>
                    <input type="color" value={value}
                      onChange={e => updateLayer(selectedLayer.id, { [key]: e.target.value })}
                      className="w-9 h-9 rounded-lg cursor-pointer"
                      style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
                  </div>
                ))}
                <div className="flex gap-3 items-center">
                  <span className="text-xs w-12 font-medium" style={{ color: '#64748b' }}>Opacity</span>
                  <input type="range" min="0" max="1" step="0.05" value={selectedLayer.opacity}
                    onChange={e => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                    className="flex-1 accent-indigo-500" />
                </div>
                <div className="text-[10px]" style={{ color: '#334155' }}>Keep opacity at 1.0 for full cover.</div>
              </>
            )}

            {selectedLayer.type === 'img' && (
              <>
                {[
                  { label: 'Width', value: Math.round(selectedLayer.w || 150), key: 'w' as const },
                  { label: 'Height', value: Math.round(selectedLayer.h || 150), key: 'h' as const },
                ].map(({ label, value, key }) => (
                  <div key={key} className="flex gap-3 items-center">
                    <span className="text-xs w-12 font-medium" style={{ color: '#64748b' }}>{label}</span>
                    <input type="number" min="20" max="2000" value={value}
                      onChange={e => updateLayer(selectedLayer.id, { [key]: Math.max(20, Number(e.target.value) || 150) })}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none text-slate-200"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,91,255,0.25)' }} />
                  </div>
                ))}
                <div className="text-[10px]" style={{ color: '#334155' }}>Click image to select, drag to move.</div>
              </>
            )}
          </div>
        )}

        {/* Export Section */}
        <div className="p-4 mt-auto space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#635bff' }}>✦ Export</div>

          <button
            onClick={exportPdf}
            disabled={customPages.length === 0 || isProcessing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #635bff 0%, #a78bfa 100%)',
              color: '#fff',
              boxShadow: customPages.length > 0 ? '0 4px 24px rgba(99,91,255,0.5)' : 'none',
              border: 'none',
            }}
          >
            <ArrowDownToLine className="w-4 h-4" /> Export PDF
          </button>

          <div className="rounded-xl p-3" style={{ border: '1px solid rgba(99,91,255,0.2)', background: 'rgba(99,91,255,0.05)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#635bff' }}>Compressed PDF</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'normal', 'high'] as const).map((level) => (
                <button key={level}
                  onClick={() => exportCompressedPdf(level)}
                  disabled={customPages.length === 0 || isProcessing}
                  className="py-2 rounded-lg text-xs font-semibold capitalize transition-all disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,91,255,0.2)', color: '#a5b4fc' }}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={exportImagesZip}
            disabled={customPages.length === 0 || isProcessing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}
          >
            <ArrowDownToLine className="w-4 h-4" /> Export Images ZIP
          </button>
        </div>
      </div>

      {/* ── MAIN CANVAS AREA ── */}
      <div
        ref={mainScrollRef}
        className="flex-1 overflow-auto p-6 flex flex-col items-center relative"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f0f20 0%, #07070f 60%)' }}
        onWheel={handleMainWheel}
        onClick={() => { setSelectedLayerId(null); setEditingTextId(null); }}
      >
        {customPages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center" style={{ color: '#334155' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, marginBottom: 20,
              background: 'linear-gradient(135deg, rgba(99,91,255,0.2), rgba(167,139,250,0.1))',
              border: '1px solid rgba(99,91,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(99,91,255,0.2)',
            }}>
              <Edit2 className="w-9 h-9" style={{ color: '#635bff', opacity: 0.8 }} />
            </div>
            <div className="font-bold text-lg mb-2" style={{ color: '#e2e8f0' }}>Open a PDF, image, or start blank</div>
            <div className="text-sm mb-8" style={{ color: '#475569' }}>Use the sidebar to upload your file</div>
            <button onClick={addBlankPage}
              className="px-8 py-3 rounded-2xl font-bold text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #635bff, #a78bfa)',
                color: '#fff', border: 'none',
                boxShadow: '0 4px 24px rgba(99,91,255,0.45)',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              Start with Blank Page
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div
              className="mb-5 flex items-center gap-3 px-5 py-2.5 rounded-2xl sticky top-0 z-10"
              style={{
                background: 'rgba(10,10,20,0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(99,91,255,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,91,255,0.1)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setPageNum(Math.max(1, pageNum - 1))} disabled={pageNum <= 1}
                className="transition-all disabled:opacity-30 hover:scale-110"
                style={{ color: '#a5b4fc', fontSize: 14 }}>◀</button>
              <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ color: '#e2e8f0', background: 'rgba(99,91,255,0.15)', minWidth: 80, textAlign: 'center' }}>
                Page {pageNum} / {customPages.length}
              </span>
              <button onClick={() => setPageNum(Math.min(customPages.length, pageNum + 1))} disabled={pageNum >= customPages.length}
                className="transition-all disabled:opacity-30 hover:scale-110"
                style={{ color: '#a5b4fc', fontSize: 14 }}>▶</button>

              <div style={{ width: 1, height: 20, background: 'rgba(99,91,255,0.25)' }} />

              <button onClick={() => rotateCurrentPage('ccw')} disabled={customPages.length === 0}
                className="p-1.5 rounded-lg transition-all disabled:opacity-30 hover:scale-110"
                style={{ color: '#94a3b8' }} title="Rotate Left">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => rotateCurrentPage('cw')} disabled={customPages.length === 0}
                className="p-1.5 rounded-lg transition-all disabled:opacity-30 hover:scale-110"
                style={{ color: '#94a3b8' }} title="Rotate Right">
                <RotateCw className="w-4 h-4" />
              </button>

              <div style={{ width: 1, height: 20, background: 'rgba(99,91,255,0.25)' }} />

              <button onClick={() => setScale(Math.max(0.5, scale - 0.2))}
                className="p-1.5 rounded-lg transition-all hover:scale-110" style={{ color: '#94a3b8' }}>
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ color: '#a5b4fc', background: 'rgba(99,91,255,0.1)', minWidth: 52, textAlign: 'center' }}>
                {Math.round(scale * 100)}%
              </span>
              <button onClick={() => setScale(Math.min(3, scale + 0.2))}
                className="p-1.5 rounded-lg transition-all hover:scale-110" style={{ color: '#94a3b8' }}>
                <ZoomIn className="w-4 h-4" />
              </button>

              <div style={{ width: 1, height: 20, background: 'rgba(99,91,255,0.25)' }} />

              <button onClick={deleteCurrentPage} disabled={customPages.length === 0}
                className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                style={{ color: '#ef4444' }} title="Delete Page"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div
              className="relative bg-white"
              style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,91,255,0.15), 0 0 60px rgba(99,91,255,0.08)' }}
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
                  className={`absolute ${editingTextId !== layer.id ? 'cursor-move' : 'cursor-text'} ${selectedLayerId === layer.id ? 'ring-2 ring-violet-500 ring-offset-1' : ''}`}
                  style={{
                      left: layer.x * scale,
  top: layer.y * scale,
  width: layer.type === 'text' ? 'max-content' : (layer.w ? layer.w * scale : '100px'),
  height: layer.type === 'text' ? 'auto' : (layer.h ? layer.h * scale : '100px'),
  minHeight: layer.type === 'text' ? `${(layer.fontSize || 18) * scale * 1.4}px` : undefined,
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
    const tempLayer = { ...layer, content: newContent };
    const { w: measuredW } = measureTextLayerSize(tempLayer, scale);
    updateLayer(layer.id, { content: newContent, w: measuredW });
  }}
  onMouseDown={(e) => e.stopPropagation()}
  className="bg-transparent outline-none resize-none w-full block"
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
    overflow: 'hidden',
    boxSizing: 'border-box' as const,
    display: 'block',
    width: '100%',
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
                          className="absolute w-3 h-3 rounded-full shadow-lg"
                          style={{
                            background: 'linear-gradient(135deg, #635bff, #a78bfa)',
                            border: '2px solid #fff',
                            boxShadow: '0 0 8px rgba(99,91,255,0.7)',
                            left: h.left, top: h.top, cursor: h.cursor,
                            transform: 'translate(-50%, -50%)',
                          }}
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
