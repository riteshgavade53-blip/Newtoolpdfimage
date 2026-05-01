import React, { useState, useRef } from 'react';
import { jsPDF, loadImgEl } from '../utils/pdfUtils';
import { Plus, X, ArrowDownToLine, Image as ImageIcon } from 'lucide-react';

export default function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [margin, setMargin] = useState(20);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
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
    setIsConverting(true);
    try {
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
    } finally {
      setIsConverting(false);
    }
  };

  const selectStyle = {
    width: '100%',
    background: '#0a0a14',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    color: '#e2e8f0',
    outline: 'none',
    fontFamily: 'inherit',
  } as React.CSSProperties;

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: '#10b981',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 6,
  };

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
          borderRight: '1px solid rgba(16,185,129,0.18)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="p-4 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(16,185,129,0.15)' }}
        >
          <div
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(16,185,129,0.45)',
              flexShrink: 0,
            }}
          >
            <ImageIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Images → PDF</div>
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.08em' }}>CONVERTER</div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="p-4" style={{ borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
          <div
            style={{
              border: isDragging ? '2px solid #10b981' : '2px dashed rgba(16,185,129,0.35)',
              background: isDragging ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.04)',
              boxShadow: isDragging ? '0 0 24px rgba(16,185,129,0.2)' : 'none',
              borderRadius: 14,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          >
            <div
              style={{
                width: 44, height: 44, borderRadius: 14, margin: '0 auto 12px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.1))',
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(16,185,129,0.15)',
              }}
            >
              <Plus className="w-6 h-6" style={{ color: '#34d399' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Add Images</div>
            <div style={{ fontSize: 11, color: '#475569' }}>JPG, PNG, WebP, GIF</div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Settings */}
        <div className="p-4 space-y-4" style={{ borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#10b981', letterSpacing: '0.1em' }}>
            ✦ Settings
          </div>

          <div>
            <label style={labelStyle}>Page Size</label>
            <select style={selectStyle} value={pageSize} onChange={e => setPageSize(e.target.value)}>
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
              <option value="img">Match Image</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Orientation</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['portrait', 'landscape'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setOrientation(opt)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: orientation === opt
                      ? 'linear-gradient(135deg, #059669, #34d399)'
                      : '#0a0a14',
                    border: orientation === opt
                      ? '1px solid #10b981'
                      : '1px solid rgba(16,185,129,0.25)',
                    color: orientation === opt ? '#fff' : '#64748b',
                    boxShadow: orientation === opt ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
                    textTransform: 'capitalize',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Margin — {margin}px</label>
            <input
              type="range"
              min="0"
              max="100"
              value={margin}
              onChange={e => setMargin(Number(e.target.value))}
              className="w-full accent-emerald-500"
              style={{ cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 2 }}>
              <span>0px</span><span>100px</span>
            </div>
          </div>
        </div>

        {/* File count badge */}
        {files.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <span style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 600 }}>
                {files.length} image{files.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setFiles([])}
                style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Export Button */}
        <div className="p-4 mt-auto">
          <button
            onClick={createPdf}
            disabled={files.length === 0 || isConverting}
            style={{
              width: '100%',
              background: files.length > 0 && !isConverting
                ? 'linear-gradient(135deg, #059669 0%, #34d399 100%)'
                : '#0a0a14',
              border: files.length > 0 && !isConverting
                ? '1px solid #10b981'
                : '1px solid rgba(16,185,129,0.2)',
              color: files.length > 0 && !isConverting ? '#fff' : '#334155',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 16px',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: files.length > 0 && !isConverting ? 'pointer' : 'not-allowed',
              boxShadow: files.length > 0 && !isConverting ? '0 4px 24px rgba(16,185,129,0.45)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <ArrowDownToLine className="w-4 h-4" />
            {isConverting ? 'Converting...' : 'Convert to PDF'}
          </button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div
        className="flex-1 overflow-auto p-6"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f0f20 0%, #07070f 60%)' }}
      >
        {files.length === 0 ? (
          <div
            className="h-full flex flex-col items-center justify-center"
            style={{ color: '#334155' }}
          >
            <div
              style={{
                width: 80, height: 80, borderRadius: 24, marginBottom: 20,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(52,211,153,0.08))',
                border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(16,185,129,0.15)',
              }}
            >
              <ImageIcon className="w-9 h-9" style={{ color: '#10b981', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Upload images to get started
            </div>
            <div style={{ fontSize: 14, color: '#475569' }}>
              Click × to remove • drag & drop supported
            </div>
          </div>
        ) : (
          <div>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7' }}>
                {files.length} Image{files.length > 1 ? 's' : ''} — Ready to Convert
              </div>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(16,185,129,0.3), transparent)' }} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {files.map((file, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: 148,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: '#0a0a14',
                    border: '1px solid rgba(16,185,129,0.2)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.5), 0 0 24px rgba(16,185,129,0.15)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.45)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.2)';
                  }}
                >
                  {/* Page number badge */}
                  <div style={{
                    position: 'absolute', top: 8, left: 8, zIndex: 10,
                    width: 22, height: 22, borderRadius: 7,
                    background: 'linear-gradient(135deg, #059669, #34d399)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.5)',
                  }}>
                    {i + 1}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeFile(i)}
                    style={{
                      position: 'absolute', top: 8, right: 8, zIndex: 10,
                      width: 24, height: 24, borderRadius: 7,
                      background: 'rgba(0,0,0,0.7)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#f87171',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = '#ef4444';
                      (e.currentTarget as HTMLElement).style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.7)';
                      (e.currentTarget as HTMLElement).style.color = '#f87171';
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {/* Image preview */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                  />

                  {/* File name */}
                  <div style={{
                    padding: '8px 10px',
                    fontSize: 10,
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    borderTop: '1px solid rgba(16,185,129,0.1)',
                    background: '#0a0a14',
                  }}>
                    {file.name}
                  </div>
                </div>
              ))}

              {/* Add more card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 148, height: 168,
                  borderRadius: 16,
                  border: '2px dashed rgba(16,185,129,0.25)',
                  background: 'rgba(16,185,129,0.03)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.55)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.07)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(16,185,129,0.1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.25)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.03)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Plus className="w-5 h-5" style={{ color: '#34d399' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Add More</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
