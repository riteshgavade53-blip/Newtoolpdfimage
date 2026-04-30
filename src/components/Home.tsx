import React, { useRef, MouseEvent } from 'react';
import {
  Edit2, Image as ImageIcon, Languages, Minimize2,
  Trash2, FileText, FileImage, RotateCw, Sparkles,
} from 'lucide-react';

const tools = [
  {
    id: 'editor',
    icon: Edit2,
    title: 'PDF & Image Editor',
    desc: 'Add text, shapes, images. Drag, resize, recolor. Export finished PDF.',
    badge: 'Most Popular',
    glow: '#635bff',
    iconFrom: '#635bff',
    iconTo: '#a78bfa',
    textColor: '#a5b4fc',
  },
  {
    id: 'img2pdf',
    icon: ImageIcon,
    title: 'Images → PDF',
    desc: 'Upload multiple JPG/PNG/WebP and merge into one PDF instantly.',
    badge: 'Instant',
    glow: '#10b981',
    iconFrom: '#059669',
    iconTo: '#34d399',
    textColor: '#6ee7b7',
  },
  {
    id: 'compress',
    icon: Minimize2,
    title: 'Compress PDF',
    desc: 'Reduce file size without losing quality. Choose compression level.',
    badge: 'Save Space',
    glow: '#ef4444',
    iconFrom: '#dc2626',
    iconTo: '#f87171',
    textColor: '#fca5a5',
  },
  {
    id: 'delete',
    icon: Trash2,
    title: 'Delete Pages',
    desc: 'Select and remove unwanted pages. Preview before deleting.',
    badge: 'Page Manager',
    glow: '#f97316',
    iconFrom: '#ea580c',
    iconTo: '#fb923c',
    textColor: '#fdba74',
  },
  {
    id: 'word',
    icon: FileText,
    title: 'Word Converter',
    desc: 'Convert .docx Word files to PDF with exact layout or to Excel.',
    badge: 'Full Support',
    glow: '#f59e0b',
    iconFrom: '#d97706',
    iconTo: '#fbbf24',
    textColor: '#fde68a',
  },
  {
    id: 'pdf2img',
    icon: FileImage,
    title: 'PDF → Image',
    desc: 'Convert every PDF page to JPG, PNG or WebP. Download all as ZIP.',
    badge: 'New',
    glow: '#ec4899',
    iconFrom: '#db2777',
    iconTo: '#f472b6',
    textColor: '#f9a8d4',
  },
  {
    id: 'rotate',
    icon: RotateCw,
    title: 'Rotate Pages',
    desc: 'Rotate individual or all pages. Preview rotation live. Export fixed PDF.',
    badge: 'New',
    glow: '#38bdf8',
    iconFrom: '#0284c7',
    iconTo: '#7dd3fc',
    textColor: '#bae6fd',
  },
  {
    id: 'cleanexcel',
    icon: Sparkles,
    title: 'Clean Excel',
    desc: 'Removes special characters and Chinese words from your data.',
    badge: 'Data Cleanup',
    glow: '#84cc16',
    iconFrom: '#65a30d',
    iconTo: '#a3e635',
    textColor: '#bef264',
  },
  {
    id: 'multilanguage-file-convert',
    icon: Languages,
    title: 'Multi Language Convert',
    desc: 'Fix CSV encoding issues and export a clean UTF-8 file for Excel.',
    badge: 'CSV Repair',
    glow: '#0ea5e9',
    iconFrom: '#0369a1',
    iconTo: '#38bdf8',
    textColor: '#7dd3fc',
  },
];

function ToolCard({
  tool,
  onNavigate,
}: {
  tool: (typeof tools)[0];
  onNavigate: (id: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(800px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) translateY(-6px) scale(1.02)`;
    card.style.boxShadow = `0 24px 60px rgba(0,0,0,0.5), 0 0 40px ${tool.glow}40`;
    card.style.borderColor = `${tool.glow}66`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)';
    card.style.boxShadow = '0 2px 16px rgba(0,0,0,0.3)';
    card.style.borderColor = `${tool.glow}50`;
  };

  const Icon = tool.icon;

  return (
    <div
      ref={cardRef}
      onClick={() => onNavigate(tool.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        background: `linear-gradient(135deg, ${tool.glow}30 0%, ${tool.glow}15 100%)`,
        border: `1px solid ${tool.glow}50`,
        borderRadius: '20px',
        padding: '22px 20px 18px',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        transformStyle: 'preserve-3d',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Subtle top-left radial glow on the card */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '120px',
          height: '120px',
          background: `radial-gradient(circle, ${tool.glow}20 0%, transparent 70%)`,
          pointerEvents: 'none',
          borderRadius: '20px',
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
          background: `linear-gradient(135deg, ${tool.iconFrom}30, ${tool.iconTo}20)`,
          border: `1px solid ${tool.glow}50`,
          boxShadow: `0 4px 16px ${tool.glow}30`,
          position: 'relative',
          zIndex: 1,
          transition: 'transform 0.2s ease',
        }}
      >
        <Icon style={{ width: 22, height: 22, color: tool.textColor }} />
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, position: 'relative', zIndex: 1 }}>
        {tool.title}
      </p>
      <p
        style={{
          fontSize: 11.5,
          color: '#64748b',
          lineHeight: 1.55,
          marginBottom: 14,
          position: 'relative',
          zIndex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {tool.desc}
      </p>

      <span
        style={{
          display: 'inline-block',
          fontSize: 10,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 999,
          background: `${tool.glow}22`,
          border: `1px solid ${tool.glow}44`,
          color: tool.textColor,
          letterSpacing: '0.04em',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {tool.badge}
      </span>
    </div>
  );
}

export default function Home({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div
      style={{
        minHeight: '100%',
        overflowY: 'auto',
        background: '#080810',
        paddingTop: 64,
        paddingBottom: 80,
        paddingLeft: 32,
        paddingRight: 32,
        textAlign: 'center',
        position: 'relative',
        fontFamily: "'DM Sans', 'Sora', sans-serif",
      }}
    >
      {/* Background Orbs */}
      <div
        style={{
          position: 'absolute', top: -120, left: -100, width: 500, height: 500,
          borderRadius: '50%', background: 'rgba(99,91,255,0.15)',
          filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: 80, right: -80, width: 400, height: 400,
          borderRadius: '50%', background: 'rgba(236,72,153,0.1)',
          filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 350, height: 350, borderRadius: '50%',
          background: 'rgba(16,185,129,0.07)', filter: 'blur(70px)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            padding: '6px 18px', borderRadius: 999,
            border: '1px solid rgba(99,91,255,0.4)',
            background: 'rgba(99,91,255,0.1)',
            color: '#a5b4fc', marginBottom: 28,
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#34d399',
              boxShadow: '0 0 8px rgba(52,211,153,0.8)',
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }}
          />
          All tools run in your browser — No uploads
        </div>

        {/* Hero */}
        <p
          style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
            color: '#f97316', textTransform: 'uppercase', marginBottom: 10,
          }}
        >
          👉 Click Here
        </p>

        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 58px)',
            fontWeight: 900,
            lineHeight: 1.05,
            marginBottom: 12,
            background: 'linear-gradient(135deg, #ffffff 20%, #a5b4fc 60%, #f472b6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          PDF &amp; File Tools
        </h1>

        <a
          href="/New Orange item Convert.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            fontSize: 'clamp(18px, 3vw, 32px)',
            fontWeight: 800,
            background: 'linear-gradient(90deg, #ef4444, #f97316, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textDecoration: 'none',
            marginBottom: 20,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Orange File Convert
        </a>

        <p
          style={{
            color: '#94a3b8', fontSize: 15, lineHeight: 1.7,
            maxWidth: 480, margin: '0 auto 44px',
          }}
        >
          Edit, convert, compress, rotate, OCR and translate PDFs — 100% private, no server uploads.
        </p>

        {/* Stats */}
        <div
          style={{
            display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 52,
          }}
        >
          {[
            { num: tools.length.toString(), label: 'Tools' },
            { num: '∞', label: 'Files Processed' },
            { num: '0', label: 'Server Uploads' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#818cf8', lineHeight: 1 }}>
                {s.num}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 60, height: 3,
            background: 'linear-gradient(90deg, #6366f1, #a78bfa, #ec4899)',
            borderRadius: 99, margin: '0 auto 52px',
          }}
        />

        {/* Tool Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 20,
            maxWidth: 1000,
            margin: '0 auto',
            textAlign: 'left',
          }}
        >
          {tools.map(tool => (
            <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Keyframe for pulse dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
