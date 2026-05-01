import React, { useState, useRef } from 'react';
import { pdfjsLib, jsPDF } from '../utils/pdfUtils';
import { Trash2, FileText, ArrowDownToLine, CheckSquare, Square } from 'lucide-react';

export default function DeletePages() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<{ num: number; dataUrl: string }[]>([]);
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

  const canDelete = file && selected.size > 0 && selected.size < pages.length && !isProcessing;

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: '#07070f', fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── SIDEBAR ── */}
      <div
        className="w-72 flex flex-col shrink-0 overflow-y-auto z-20"
        style={{
          background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a14 100%)',
          borderRight: '1px solid rgba(239,68,68,0.18)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(239,68,68,0.45)',
          }}>
            <Trash2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Delete Pages</div>
            <div style={{ fontSize: 10, color: '#f87171', fontWeight: 700, letterSpacing: '0.08em' }}>PAGE MANAGER</div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="p-4" style={{ borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
          <div
            style={{
              border: isDragging ? '2px solid #ef4444' : '2px dashed rgba(239,68,68,0.3)',
              background: isDragging ? 'rgba(239,68,68,0.08)' : '#0a0a14',
              boxShadow: isDragging ? '0 0 24px rgba(239,68,68,0.18)' : 'none',
              borderRadius: 14, padding: '22px 16px',
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 12, margin: '0 auto 10px',
              background: file
                ? 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(249,115,22,0.15))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))',
              border: `1px solid ${file ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: file ? '0 4px 14px rgba(239,68,68,0.22)' : 'none',
            }}>
              <FileText className="w-5 h-5" style={{ color: file ? '#f87171' : '#475569' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: file ? '#e2e8f0' : '#94a3b8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
              {file ? file.name : 'Upload PDF'}
            </div>
            <div style={{ fontSize: 11, color: '#475569' }}>
              {file ? 'Click to change file' : 'Then select pages to remove'}
            </div>
            {file && (
              <div style={{
                marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
              }}>
                ✓ File loaded
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf"
            onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>

        {/* Stats & Controls */}
        <div className="p-4 space-y-3" style={{ borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ef4444', letterSpacing: '0.1em' }}>
            ✦ Selection
          </div>

          {/* Stat pills */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{
              background: '#0a0a14', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '10px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>{pages.length}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
            </div>
            <div style={{
              background: selected.size > 0 ? 'rgba(239,68,68,0.08)' : '#0a0a14',
              border: `1px solid ${selected.size > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12, padding: '10px 8px', textAlign: 'center',
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: selected.size > 0 ? '#f87171' : '#475569', lineHeight: 1 }}>{selected.size}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>To Delete</div>
            </div>
          </div>

          {/* Select / Clear buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={selectAll}
              style={{
                padding: '9px 6px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: '#0a0a14', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 14px rgba(239,68,68,0.25)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.6)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              style={{
                padding: '9px 6px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: '#0a0a14', border: '1px solid rgba(255,255,255,0.1)',
                color: '#64748b',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
            >
              Clear
            </button>
          </div>

          {selected.size > 0 && selected.size < pages.length && (
            <div style={{
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 11, color: '#fca5a5', fontWeight: 500,
            }}>
              ⚠ {pages.length - selected.size} page{pages.length - selected.size !== 1 ? 's' : ''} will remain
            </div>
          )}
          {selected.size === pages.length && pages.length > 0 && (
            <div style={{
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              fontSize: 11, color: '#fbbf24', fontWeight: 500,
            }}>
              ⚠ Cannot delete all pages
            </div>
          )}
        </div>

        {/* Export Button */}
        <div className="p-4 mt-auto">
          <button
            onClick={deletePages}
            disabled={!canDelete}
            style={{
              width: '100%',
              background: canDelete
                ? 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)'
                : '#0a0a14',
              border: canDelete ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
              color: canDelete ? '#fff' : '#334155',
              fontWeight: 800, fontSize: 14,
              padding: '13px 16px', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: canDelete ? 'pointer' : 'not-allowed',
              boxShadow: canDelete ? '0 6px 24px rgba(239,68,68,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (canDelete) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(239,68,68,0.5)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = canDelete ? '0 6px 24px rgba(239,68,68,0.4)' : 'none'; }}
          >
            <ArrowDownToLine className="w-4 h-4" />
            {isProcessing ? 'Processing...' : 'Delete & Download'}
          </button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div
        className="flex-1 overflow-auto p-6"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f0f20 0%, #0d0d0d 60%)' }}
      >
        {pages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div style={{
              width: 80, height: 80, borderRadius: 24, marginBottom: 20,
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(249,115,22,0.08))',
              border: '1px solid rgba(239,68,68,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(239,68,68,0.12)',
            }}>
              <Trash2 className="w-9 h-9" style={{ color: '#ef4444', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Upload a PDF to manage pages
            </div>
            <div style={{ fontSize: 14, color: '#475569' }}>
              Select the pages you want to delete
            </div>
          </div>
        ) : (
          <div>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: selected.size > 0 ? '#f87171' : '#6ee7b7' }}>
                {selected.size > 0
                  ? `${selected.size} page${selected.size > 1 ? 's' : ''} marked for deletion`
                  : `${pages.length} pages — click to select`}
              </div>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.3), transparent)' }} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 14,
            }}>
              {pages.map((p) => {
                const isSelected = selected.has(p.num);
                return (
                  <div
                    key={p.num}
                    onClick={() => toggleSelection(p.num)}
                    style={{
                      background: isSelected ? 'rgba(239,68,68,0.08)' : '#0a0a14',
                      border: isSelected ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                      position: 'relative',
                      boxShadow: isSelected
                        ? '0 0 0 1px rgba(239,68,68,0.5), 0 8px 24px rgba(239,68,68,0.2)'
                        : '0 2px 12px rgba(0,0,0,0.3)',
                      transform: isSelected ? 'translateY(-3px)' : 'translateY(0)',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
                      }
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      position: 'absolute', top: 8, right: 8, zIndex: 10,
                      width: 22, height: 22, borderRadius: 7,
                      background: isSelected ? '#ef4444' : 'rgba(0,0,0,0.65)',
                      border: isSelected ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isSelected ? '0 2px 8px rgba(239,68,68,0.5)' : 'none',
                      transition: 'all 0.2s',
                    }}>
                      {isSelected
                        ? <CheckSquare className="w-3.5 h-3.5 text-white" />
                        : <Square className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                      }
                    </div>

                    {/* Page image */}
                    <img
                      src={p.dataUrl}
                      alt={`Page ${p.num}`}
                      style={{
                        width: '100%', display: 'block',
                        opacity: isSelected ? 0.4 : 1,
                        filter: isSelected ? 'grayscale(60%)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    />

                    {/* Page label */}
                    <div style={{
                      padding: '7px 8px', textAlign: 'center',
                      fontSize: 11, fontWeight: 700,
                      color: isSelected ? '#f87171' : '#64748b',
                      background: isSelected ? 'rgba(239,68,68,0.1)' : '#0a0a14',
                      borderTop: `1px solid ${isSelected ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      transition: 'all 0.2s',
                    }}>
                      {isSelected ? '🗑 ' : ''}Page {p.num}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
