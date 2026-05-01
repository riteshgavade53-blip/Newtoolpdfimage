import React, { useState, useRef } from 'react';
import { pdfjsLib, jsPDF, formatBytes } from '../utils/pdfUtils';
import { Minimize2, FileText, ArrowDownToLine, Zap } from 'lucide-react';

export default function CompressPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.6);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState<{ orig: number; new: number } | null>(null);
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
        setProgress(10 + (i / pdf.numPages) * 80);
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

  const qualityOptions = [
    { q: 0.9, label: 'High', desc: 'Best quality', icon: '🟢', color: '#10b981', glow: 'rgba(16,185,129,0.35)' },
    { q: 0.6, label: 'Medium', desc: 'Balanced', icon: '🟡', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
    { q: 0.3, label: 'Low', desc: 'Max savings', icon: '🔴', color: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
  ];

  const savedPct = stats ? Math.round((1 - stats.new / stats.orig) * 100) : 0;

  return (
    <div
      className="flex h-full items-center justify-center p-6"
      style={{
        background: 'radial-gradient(ellipse at 50% 20%, #1a1a1a 0%, #111111 50%, #0d0d0d 100%)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Bg orbs */}
      <div style={{ position: 'fixed', top: -120, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: 0, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(245,158,11,0.13)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'linear-gradient(135deg, #0f0f1a 0%, #0a0a14 100%)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 24,
          padding: 36,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.08), 0 0 60px rgba(239,68,68,0.05)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top-left glow inside card */}
        <div style={{ position: 'absolute', top: -40, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(239,68,68,0.07)', filter: 'blur(40px)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6, position: 'relative' }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
          }}>
            <Minimize2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1, margin: 0 }}>PDF Compressor</h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0, marginTop: 3 }}>Reduce file size while keeping quality</p>
          </div>
          <div style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171', letterSpacing: '0.06em',
          }}>
            SAVE SPACE
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.3), rgba(245,158,11,0.2), transparent)', margin: '20px 0' }} />

        {/* Upload Zone */}
        <div
          style={{
            border: isDragging ? '2px solid #ef4444' : '2px dashed rgba(239,68,68,0.3)',
            background: isDragging ? 'rgba(239,68,68,0.08)' : '#0a0a14',
            boxShadow: isDragging ? '0 0 28px rgba(239,68,68,0.18)' : 'none',
            borderRadius: 16, padding: '28px 20px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.2s', marginBottom: 24,
            position: 'relative', overflow: 'hidden',
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px',
            background: file
              ? 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(245,158,11,0.15))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
            border: `1px solid ${file ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: file ? '0 4px 16px rgba(239,68,68,0.25)' : 'none',
            transition: 'all 0.2s',
          }}>
            <FileText className="w-6 h-6" style={{ color: file ? '#f87171' : '#475569' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: file ? '#e2e8f0' : '#94a3b8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 20px' }}>
            {file ? file.name : 'Upload PDF File'}
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {file ? formatBytes(file.size) : 'Click or drag & drop your PDF here'}
          </div>
          {file && (
            <div style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
            }}>
              ✓ File ready
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf"
          onChange={(e) => handleFile(e.target.files?.[0] || null)} />

        {/* Quality Selector */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            ✦ Compression Quality
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {qualityOptions.map((opt) => (
              <button
                key={opt.q}
                onClick={() => setQuality(opt.q)}
                style={{
                  padding: '14px 8px',
                  borderRadius: 14,
                  border: quality === opt.q ? `1px solid ${opt.color}` : '1px solid rgba(255,255,255,0.08)',
                  background: quality === opt.q
                    ? `linear-gradient(135deg, ${opt.color}22, ${opt.color}0f)`
                    : '#0a0a14',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  boxShadow: quality === opt.q ? `0 4px 20px ${opt.glow}` : 'none',
                  transform: quality === opt.q ? 'translateY(-2px)' : 'translateY(0)',
                }}
                onMouseEnter={e => { if (quality !== opt.q) (e.currentTarget as HTMLElement).style.borderColor = `${opt.color}55`; }}
                onMouseLeave={e => { if (quality !== opt.q) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <div style={{ fontSize: 18, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: quality === opt.q ? opt.color : '#94a3b8', marginBottom: 3 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              ✦ Compression Result
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Original', value: formatBytes(stats.orig), color: '#94a3b8' },
                { label: 'Compressed', value: formatBytes(stats.new), color: '#34d399' },
                { label: 'Saved', value: `${savedPct}%`, color: '#818cf8' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#0a0a14',
                  border: `1px solid ${s.color}30`,
                  borderRadius: 14, padding: '14px 10px', textAlign: 'center',
                  boxShadow: `0 4px 16px ${s.color}15`,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Savings bar */}
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${savedPct}%`,
                  background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
                  borderRadius: 999, transition: 'width 0.6s ease',
                  boxShadow: '0 0 8px rgba(239,68,68,0.4)',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 5 }}>
                {savedPct}% file size reduced
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isCompressing && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap className="w-3 h-3" style={{ color: '#f97316' }} />
                {status}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg, #dc2626, #f97316)',
                borderRadius: 999, transition: 'width 0.3s ease',
                boxShadow: '0 0 10px rgba(239,68,68,0.5)',
              }} />
            </div>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={compressPdf}
          disabled={!file || isCompressing}
          style={{
            width: '100%',
            background: file && !isCompressing
              ? 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)'
              : '#0a0a14',
            border: file && !isCompressing
              ? '1px solid #ef4444'
              : '1px solid rgba(255,255,255,0.08)',
            color: file && !isCompressing ? '#fff' : '#334155',
            fontWeight: 800, fontSize: 15,
            padding: '14px 20px', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: file && !isCompressing ? 'pointer' : 'not-allowed',
            boxShadow: file && !isCompressing ? '0 8px 28px rgba(239,68,68,0.4)' : 'none',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => { if (file && !isCompressing) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 36px rgba(239,68,68,0.5)'; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = file && !isCompressing ? '0 8px 28px rgba(239,68,68,0.4)' : 'none'; }}
        >
          <ArrowDownToLine className="w-5 h-5" />
          {isCompressing ? status : 'Compress & Download'}
        </button>

        {/* Footer hint */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#1e293b', marginTop: 16 }}>
          🔒 100% private — processed in your browser
        </p>
      </div>
    </div>
  );
}
