import React from 'react';
import { Edit2, Image as ImageIcon, Minimize2, Trash2, FileText, FileImage, RotateCw, Sparkles } from 'lucide-react';

const tools = [
  { id: 'editor', icon: Edit2, title: 'PDF & Image Editor', desc: 'Add text, shapes, images. Drag, resize, recolor. Export finished PDF.', badge: 'Most Popular', color: 'from-indigo-500/30 to-purple-400/10 border-indigo-500/20 text-indigo-400' },
  { id: 'img2pdf', icon: ImageIcon, title: 'Images -> PDF', desc: 'Upload multiple JPG/PNG/WebP and merge into one PDF instantly.', badge: 'Instant', color: 'from-emerald-500/30 to-cyan-400/10 border-emerald-500/20 text-emerald-400' },
  { id: 'compress', icon: Minimize2, title: 'Compress PDF', desc: 'Reduce file size without losing quality. Choose compression level.', badge: 'Save Space', color: 'from-red-500/30 to-amber-400/10 border-red-500/20 text-red-400' },
  { id: 'delete', icon: Trash2, title: 'Delete Pages', desc: 'Select and remove unwanted pages. Preview before deleting.', badge: 'Page Manager', color: 'from-red-500/30 to-amber-400/10 border-red-500/20 text-red-400' },
  { id: 'word', icon: FileText, title: 'Word Converter', desc: 'Convert .docx Word files to PDF with exact layout or to Excel.', badge: 'Full Support', color: 'from-amber-500/30 to-pink-400/10 border-amber-500/20 text-amber-400' },
  { id: 'pdf2img', icon: FileImage, title: 'PDF -> Image', desc: 'Convert every PDF page to JPG, PNG or WebP. Download all as ZIP.', badge: 'New', color: 'from-pink-500/30 to-cyan-400/10 border-pink-500/20 text-pink-400' },
  { id: 'rotate', icon: RotateCw, title: 'Rotate Pages', desc: 'Rotate individual or all pages. Preview rotation live. Export fixed PDF.', badge: 'New', color: 'from-amber-500/30 to-emerald-400/10 border-amber-500/20 text-amber-400' },
  { id: 'cleanexcel', icon: Sparkles, title: 'Clean Excel', desc: 'tool removes only special characters and Chinese words.', badge: 'Data Cleanup', color: 'from-emerald-500/30 to-lime-400/10 border-emerald-500/20 text-emerald-400' },
];

export default function Home({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto pt-16 pb-12 px-8 text-center relative">
      <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 mb-6 tracking-wide">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
        All tools run in your browser - No uploads
      </div>

      <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4 tracking-tight">
        Your Complete<br />
        <span className="bg-gradient-to-br from-indigo-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
          PDF Toolkit
        </span>
      </h1>

      <p className="text-slate-400 max-w-lg mx-auto mb-10 leading-relaxed">
        Edit, convert, compress, rotate, OCR and translate PDFs - 100% private, no server uploads.
      </p>

      <div className="flex justify-center gap-8 mb-12">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-indigo-400">{tools.length}</div>
          <div className="text-xs text-slate-500 mt-1">Tools</div>
        </div>
        {/* <div className="text-center">
          <div className="text-2xl font-extrabold text-indigo-400">0</div>
          <div className="text-xs text-slate-500 mt-1">Server Uploads</div>
        </div> */}
        <div className="text-center">
          <div className="text-2xl font-extrabold text-indigo-400">infinite</div>
          <div className="text-xs text-slate-500 mt-1">Files Processed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl mx-auto pb-16 text-left">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => onNavigate(tool.id)}
              className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-[0_16px_48px_rgba(0,0,0,0.4),0_0_40px_rgba(124,110,245,0.15)] relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_top_left,rgba(124,110,245,0.08),transparent_60%)] pointer-events-none"></div>

              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br border ${tool.color}`}>
                <Icon className="w-6 h-6" />
              </div>

              <h3 className="font-bold text-sm mb-1.5">{tool.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-3.5 line-clamp-2">{tool.desc}</p>

              <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tool.color.replace('from-', 'bg-').split(' ')[0].replace('/30', '/15')} ${tool.color.split(' ').find(c => c.startsWith('text-'))}`}>
                {tool.badge}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
