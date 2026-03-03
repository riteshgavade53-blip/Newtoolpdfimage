import React, { useState, useRef } from 'react';
import { pdfjsLib, XLSX } from '../utils/pdfUtils';
import { Utensils, FileText, ArrowDownToLine, Copy, Settings, Bot } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

export default function MenuProcessing() {
  const [file, setFile] = useState<File | null>(null);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [base64Img, setBase64Img] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [lang, setLang] = useState('auto');
  const [extractMode, setExtractMode] = useState('structured');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (newFile: File | null) => {
    if (!newFile) return;
    setFile(newFile);
    setResults(null);
    
    if (newFile.name.toLowerCase().endsWith('.pdf')) {
      setStatus('Rendering PDF page...');
      setIsProcessing(true);
      try {
        const buf = await newFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 2.5 });
        const cv = document.createElement('canvas');
        cv.width = vp.width;
        cv.height = vp.height;
        // @ts-ignore
        await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
        const dataUrl = cv.toDataURL('image/png');
        setImgSrc(dataUrl);
        setBase64Img(dataUrl.split(',')[1]);
        setMimeType('image/png');
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImgSrc(dataUrl);
        setBase64Img(dataUrl.split(',')[1]);
        setMimeType(newFile.type || 'image/jpeg');
      };
      reader.readAsDataURL(newFile);
    }
  };

  const processMenu = async () => {
    if (!base64Img) return;
    setIsProcessing(true);
    setStatus('Analyzing menu with AI...');
    
    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setStatus('AI key missing. Set VITE_GEMINI_API_KEY in your environment.');
        setIsProcessing(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        You are an expert menu digitizer. Extract the menu items from this image.
        The menu might be in ${lang === 'auto' ? 'any Indian language (Hindi, Gujarati, Marathi, etc.) or English' : lang}.
        
        For each item, provide:
        1. The original name exactly as written.
        2. The price (if present).
        3. A short description (if present).
        
        Group the items into their logical categories (e.g., Starters, Main Course, Beverages).
        If no categories are explicitly written, infer them or group them under "Menu".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Img, mimeType } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detected_language: { type: Type.STRING, description: 'The primary language detected in the menu' },
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category_name: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          price: { type: Type.STRING },
                          description: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const jsonStr = response.text?.trim() || '{}';
      const data = JSON.parse(jsonStr);
      setResults(data);
      
    } catch (err) {
      console.error(err);
      setStatus('Failed to process menu. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportExcel = () => {
    if (!results || !results.categories) return;
    
    const rows = [['Category', 'Item Name', 'Price', 'Description']];
    
    results.categories.forEach((cat: any) => {
      (cat.items || []).forEach((item: any) => {
        rows.push([
          cat.category_name || '',
          item.name || '',
          item.price || '',
          item.description || ''
        ]);
      });
    });
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [25, 30, 15, 40].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Menu');
    XLSX.writeFile(wb, 'menu-extracted.xlsx');
  };

  const copyColumn = () => {
    if (!results || !results.categories) return;
    
    let text = '';
    results.categories.forEach((cat: any) => {
      text += `--- ${cat.category_name} ---\n`;
      (cat.items || []).forEach((item: any) => {
        const name = item.name;
        const price = item.price ? ` - ${item.price}` : '';
        text += `${name}${price}\n`;
      });
      text += '\n';
    });
    
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-800 font-bold text-sm flex items-center gap-2">
          <Utensils className="w-4 h-4 text-amber-400" /> Menu Processing
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
            <div className="text-sm font-semibold mb-1 truncate px-2">{file ? file.name : 'Upload Menu Image / PDF'}</div>
            <div className="text-xs text-slate-500">JPG, PNG, WebP, PDF</div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>

        <div className="p-4 border-b border-slate-800 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Menu Language</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={lang} onChange={e => setLang(e.target.value)}>
              <option value="auto">Auto Detect</option>
              <option value="hindi">Hindi (हिंदी)</option>
              <option value="gujarati">Gujarati (ગુજરાતી)</option>
              <option value="marathi">Marathi (मराठी)</option>
              <option value="punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
              <option value="tamil">Tamil (தமிழ்)</option>
              <option value="telugu">Telugu (తెలుగు)</option>
              <option value="mixed">Mixed Languages</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Extract As</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-colors" value={extractMode} onChange={e => setExtractMode(e.target.value)}>
              <option value="structured">Structured (Category + Items + Price)</option>
            </select>
          </div>
        </div>

        <div className="p-4 mt-auto space-y-2">
          <button 
            onClick={processMenu}
            disabled={!base64Img || isProcessing}
            className="w-full bg-gradient-to-br from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Bot className="w-4 h-4" /> Process Menu with AI
          </button>
          <button 
            onClick={exportExcel}
            disabled={!results || isProcessing}
            className="w-full bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowDownToLine className="w-4 h-4" /> Export to Excel
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {isProcessing && (
          <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center gap-3 text-sm text-slate-300">
            <div className="animate-spin w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            {status}
          </div>
        )}
        
        <div className="flex-1 flex overflow-hidden">
          {/* Original Image */}
          <div className="flex-1 border-r border-slate-800 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-800 font-bold text-xs text-slate-400 bg-slate-900">📷 Original Menu</div>
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-950">
              {!imgSrc ? (
                <div className="text-center text-slate-500 mt-20">
                  <Utensils className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <div className="font-bold text-sm text-slate-300">Upload a menu to get started</div>
                  <div className="text-xs mt-1">Hindi • Gujarati • Marathi • Any Indian language</div>
                </div>
              ) : (
                <img src={imgSrc} alt="Menu" className="max-w-full rounded-lg shadow-2xl border border-slate-800" />
              )}
            </div>
          </div>

          {/* Extracted Output */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-800 font-bold text-xs bg-amber-500/10 flex items-center justify-between">
              <span className="text-amber-400">📝 Extracted Text</span>
              <button onClick={() => copyColumn()} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-950">
              {!results ? (
                <div className="text-center text-slate-500 mt-20">
                  <div className="text-3xl opacity-30 mb-2">📝</div>
                  <div className="text-xs">Extracted text will appear here</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {results.categories?.map((cat: any, i: number) => (
                    <div key={i}>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Category</div>
                        <div className="text-sm font-bold text-amber-400">{cat.category_name}</div>
                      </div>
                      <div className="space-y-2">
                        {cat.items?.map((item: any, j: number) => (
                          <div key={j} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
                            <div>
                              <div className="text-sm font-semibold text-emerald-400">{item.name}</div>
                              {item.description && <div className="text-[10px] text-slate-400 mt-1">{item.description}</div>}
                            </div>
                            {item.price && <div className="text-sm font-bold text-emerald-500">{item.price}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
