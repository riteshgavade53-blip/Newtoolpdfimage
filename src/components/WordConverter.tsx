import { useState, useCallback, useRef, useEffect } from "react";
import mammoth from "mammoth";
import * as THREE from "three";

interface State {
  status: "idle" | "converting" | "done" | "error";
  fileName: string;
  errorMsg: string;
  progress: number;
}

// ── 3D Background Canvas ────────────────────────────────────────────────────
function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth, H = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
    camera.position.set(0, 0, 30);

    // Floating document pages
    const pageGroup = new THREE.Group();
    scene.add(pageGroup);
    const pageMat = new THREE.MeshPhongMaterial({
      color: 0xffffff, transparent: true, opacity: 0.08,
      side: THREE.DoubleSide, shininess: 80,
    });
    const pages: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; rx: number; ry: number } [] = [];
    for (let i = 0; i < 18; i++) {
      const geo = new THREE.PlaneGeometry(
        2.2 + Math.random() * 1.6,
        3.0 + Math.random() * 2.0
      );
      const mesh = new THREE.Mesh(geo, pageMat.clone());
      mesh.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 30
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      pageGroup.add(mesh);
      pages.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.005,
        vy: (Math.random() - 0.5) * 0.004,
        vz: (Math.random() - 0.5) * 0.003,
        rx: (Math.random() - 0.5) * 0.003,
        ry: (Math.random() - 0.5) * 0.003,
      });
    }

    // Particle field
    const particleCount = 800;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x7c3aed, size: 0.18, transparent: true, opacity: 0.55 });
    scene.add(new THREE.Points(pGeo, pMat));

    // Torus rings
    const rings: THREE.Mesh[] = [];
    const ringColors = [0x7c3aed, 0x6366f1, 0xa78bfa, 0x4f46e5];
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.TorusGeometry(6 + i * 4, 0.06, 8, 80);
      const mat = new THREE.MeshBasicMaterial({ color: ringColors[i % 4], transparent: true, opacity: 0.15 + i * 0.04 });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(ring);
      rings.push(ring);
    }

    // Lights
    scene.add(new THREE.AmbientLight(0x6366f1, 0.6));
    const dLight = new THREE.DirectionalLight(0xa78bfa, 1.2);
    dLight.position.set(10, 10, 10);
    scene.add(dLight);
    const pLight = new THREE.PointLight(0x7c3aed, 1.5, 60);
    pLight.position.set(-10, 5, 15);
    scene.add(pLight);

    // Mouse parallax
    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse);

    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      camera.position.x += (mx * 4 - camera.position.x) * 0.03;
      camera.position.y += (my * 2 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      pages.forEach(p => {
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.mesh.rotation.x += p.rx;
        p.mesh.rotation.y += p.ry;
        if (Math.abs(p.mesh.position.x) > 35) p.vx *= -1;
        if (Math.abs(p.mesh.position.y) > 25) p.vy *= -1;
        if (Math.abs(p.mesh.position.z) > 20) p.vz *= -1;
      });

      rings.forEach((r, i) => {
        r.rotation.x += 0.001 + i * 0.0005;
        r.rotation.y += 0.0015 + i * 0.0003;
      });

      pLight.position.x = Math.sin(t * 0.5) * 15;
      pLight.position.y = Math.cos(t * 0.4) * 10;

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const W2 = window.innerWidth, H2 = window.innerHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ── Progress Ring ───────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 44, circ = 2 * Math.PI * r;
  return (
    <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
      <circle cx="55" cy="55" r={r} fill="none"
        stroke="url(#pg)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <defs>
        <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function WordToPdfConverter3D() {
  const [state, setState] = useState<State>({ status: "idle", fileName: "", errorMsg: "", progress: 0 });
  const [htmlPreview, setHtmlPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [hoverBtn, setHoverBtn] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildPdfHtml(body: string, name: string) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e8e8e8;font-family:"Times New Roman",Georgia,serif;font-size:12pt;color:#000;padding:40px 0 60px}
.page{width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:96px 96px 96px 110px;box-shadow:0 4px 32px rgba(0,0,0,0.25);line-height:1.65}
h1{font-size:22pt;font-weight:bold;margin:18pt 0 10pt}
h2{font-size:16pt;font-weight:bold;margin:14pt 0 8pt}
h3{font-size:13pt;font-weight:bold;margin:12pt 0 6pt}
h4{font-size:12pt;font-weight:bold;margin:10pt 0 4pt}
p{margin-bottom:8pt;text-align:justify}
strong,b{font-weight:bold}em,i{font-style:italic}u{text-decoration:underline}s{text-decoration:line-through}
ul{margin:6pt 0 8pt 28pt;list-style:disc}ol{margin:6pt 0 8pt 28pt;list-style:decimal}li{margin-bottom:4pt}
table{width:100%;border-collapse:collapse;margin:10pt 0 12pt;font-size:11pt}
th,td{border:1px solid #999;padding:6pt 8pt;vertical-align:top;text-align:left}
th{background:#f0f0f0;font-weight:bold}
img{max-width:100%;height:auto;margin:8pt 0}
blockquote{border-left:3px solid #999;margin:10pt 0 10pt 20pt;padding-left:12pt;color:#555;font-style:italic}
hr{border:none;border-top:1px solid #ccc;margin:14pt 0}
@media print{body{background:white;padding:0}.page{width:100%;min-height:unset;padding:1.5cm 2cm 2cm 2.5cm;box-shadow:none;margin:0}}
</style></head><body><div class="page">${body}</div></body></html>`;
  }

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(docx|doc)$/i)) {
      setState(s => ({ ...s, status: "error", errorMsg: "Sirf .docx ya .doc files allowed hain!" }));
      return;
    }
    setState({ status: "converting", fileName: file.name, errorMsg: "", progress: 20 });
    try {
      const buf = await file.arrayBuffer();
      setState(s => ({ ...s, progress: 55 }));
      const result = await mammoth.convertToHtml({ arrayBuffer: buf }, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1.title:fresh",
          "b => strong", "i => em", "u => u", "strike => s",
        ],
      });
      if (!result.value?.trim()) throw new Error("Document empty hai ya read nahi ho saka.");
      setState(s => ({ ...s, progress: 90 }));
      setHtmlPreview(buildPdfHtml(result.value, file.name.replace(/\.(docx|doc)$/i, "")));
      setState(s => ({ ...s, status: "done", progress: 100 }));
    } catch (e: unknown) {
      setState(s => ({ ...s, status: "error", errorMsg: e instanceof Error ? e.message : "Failed" }));
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  }, [processFile]);

  const handlePrint = () => {
    if (!htmlPreview) return;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(htmlPreview); w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const handleDownload = () => {
    const blob = new Blob([htmlPreview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.fileName.replace(/\.(docx|doc)$/i, "") + ".html";
    a.click(); URL.revokeObjectURL(url);
  };

  const reset = () => {
    setState({ status: "idle", fileName: "", errorMsg: "", progress: 0 });
    setHtmlPreview("");
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    position: "relative", zIndex: 1,
    background: "rgba(10,8,30,0.72)",
    backdropFilter: "blur(28px)",
    border: "1px solid rgba(139,92,246,0.35)",
    borderRadius: "28px",
    padding: "40px 36px",
    width: "100%", maxWidth: "500px",
    boxShadow: "0 0 60px rgba(99,102,241,0.2), 0 0 120px rgba(124,58,237,0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
  };

  return (
    <div style={{
      minHeight: "100vh",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "50px 20px 70px",
      position: "relative", overflow: "hidden",
      background: "linear-gradient(160deg, #05030f 0%, #0d0820 50%, #060315 100%)",
    }}>
      <ThreeBackground />

      {/* Ambient glow blobs */}
      <div style={{ position: "fixed", top: "10%", left: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "15%", right: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "44px", position: "relative", zIndex: 1 }}>
        {/* 3D floating icon */}
        <div style={{
          width: 90, height: 90, margin: "0 auto 20px",
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          borderRadius: "24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "40px",
          boxShadow: "0 20px 60px rgba(99,102,241,0.5), 0 0 0 1px rgba(139,92,246,0.3)",
          transform: "perspective(400px) rotateX(8deg) rotateY(-5deg)",
          animation: "float 4s ease-in-out infinite",
        }}>📄</div>

        <h1 style={{
          fontSize: "38px", fontWeight: 900, margin: 0,
          background: "linear-gradient(135deg, #e0e7ff 0%, #a78bfa 50%, #7c3aed 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: "-1px",
          textShadow: "none",
          filter: "drop-shadow(0 0 30px rgba(167,139,250,0.4))",
        }}>
          Word → PDF
        </h1>
        <p style={{
          color: "rgba(167,139,250,0.6)", fontSize: "14px", marginTop: "10px",
          letterSpacing: "3px", textTransform: "uppercase", fontWeight: 500,
        }}>
          No AI &nbsp;·&nbsp; No Server &nbsp;·&nbsp; Pure Browser
        </p>
      </div>

      {/* Main Card */}
      <div style={cardStyle}>

        {/* IDLE — Drop Zone */}
        {state.status === "idle" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "#818cf8" : "rgba(139,92,246,0.35)"}`,
              borderRadius: "18px", padding: "60px 24px", textAlign: "center",
              cursor: "pointer",
              background: dragging
                ? "rgba(99,102,241,0.1)"
                : "rgba(99,102,241,0.03)",
              transition: "all 0.25s",
              transform: dragging ? "scale(1.02)" : "scale(1)",
            }}
          >
            <div style={{
              width: 70, height: 70, margin: "0 auto 18px",
              background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(124,58,237,0.2))",
              borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "32px", border: "1px solid rgba(139,92,246,0.3)",
              boxShadow: "0 8px 32px rgba(99,102,241,0.2)",
            }}>☁️</div>

            <p style={{ color: "#e0e7ff", fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>
              File yahan drop karo
            </p>
            <p style={{ color: "rgba(139,92,246,0.6)", fontSize: "13px", margin: "0 0 22px" }}>
              ya click karke browse karo
            </p>
            <span style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(124,58,237,0.25))",
              border: "1px solid rgba(139,92,246,0.4)",
              borderRadius: "8px", padding: "5px 16px",
              color: "#a78bfa", fontSize: "12px", fontWeight: 600,
              letterSpacing: "1px",
            }}>
              .DOCX &nbsp;&nbsp;/&nbsp;&nbsp; .DOC
            </span>
            <input ref={fileInputRef} type="file" accept=".docx,.doc"
              style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
          </div>
        )}

        {/* CONVERTING */}
        {state.status === "converting" && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ position: "relative", display: "inline-block", marginBottom: "20px" }}>
              <ProgressRing pct={state.progress} />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "28px", animation: "spin 2s linear infinite",
              }}>⚙️</div>
            </div>
            <p style={{ color: "#e0e7ff", fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>
              Convert ho raha hai...
            </p>
            <p style={{ color: "rgba(139,92,246,0.6)", fontSize: "12px" }}>{state.fileName}</p>
          </div>
        )}

        {/* ERROR */}
        {state.status === "error" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "50px", marginBottom: "16px", filter: "drop-shadow(0 0 20px rgba(248,113,113,0.5))" }}>❌</div>
            <p style={{ color: "#f87171", fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>Error!</p>
            <p style={{ color: "rgba(148,163,184,0.7)", fontSize: "13px", marginBottom: "24px" }}>{state.errorMsg}</p>
            <button onClick={reset}
              onMouseEnter={() => setHoverBtn("retry")}
              onMouseLeave={() => setHoverBtn(null)}
              style={glowBtn("#6366f1", hoverBtn === "retry")}>🔄 Dobara Try</button>
          </div>
        )}

        {/* DONE */}
        {state.status === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: "56px", marginBottom: "14px",
              filter: "drop-shadow(0 0 30px rgba(74,222,128,0.6))",
              animation: "pop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            }}>✅</div>
            <p style={{ color: "#4ade80", fontSize: "20px", fontWeight: 900, marginBottom: "4px" }}>
              Conversion Complete!
            </p>
            <p style={{ color: "rgba(139,92,246,0.6)", fontSize: "13px", marginBottom: "28px" }}>
              {state.fileName}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <button onClick={handlePrint}
                onMouseEnter={() => setHoverBtn("print")}
                onMouseLeave={() => setHoverBtn(null)}
                style={glowBtn("#10b981", hoverBtn === "print")}>
                🖨️ &nbsp; PDF ke roop mein Save karo
              </button>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleDownload}
                  onMouseEnter={() => setHoverBtn("dl")}
                  onMouseLeave={() => setHoverBtn(null)}
                  style={{ ...glowBtn("#6366f1", hoverBtn === "dl"), flex: 1 }}>
                  ⬇️ HTML Download
                </button>
                <button onClick={reset}
                  onMouseEnter={() => setHoverBtn("new")}
                  onMouseLeave={() => setHoverBtn(null)}
                  style={{ ...glowBtn("#3f3f46", hoverBtn === "new"), flex: 1 }}>
                  🔄 Naya File
                </button>
              </div>
            </div>

            <div style={{
              background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: "12px", padding: "14px 16px",
              color: "rgba(110,231,183,0.8)", fontSize: "12px", lineHeight: 1.8, textAlign: "left",
            }}>
              <strong style={{ color: "#6ee7b7" }}>💡 PDF save karne ka tarika:</strong><br />
              Print button → <strong>Destination: "Save as PDF"</strong> → Save ✅
            </div>
          </div>
        )}
      </div>

      {/* Feature pills */}
      {state.status === "idle" && (
        <div style={{ display: "flex", gap: "10px", marginTop: "24px", flexWrap: "wrap", justifyContent: "center", position: "relative", zIndex: 1 }}>
          {["⚡ Instant", "🔒 100% Private", "📊 Tables Support", "🖋️ Formatting Preserved"].map(f => (
            <span key={f} style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: "999px", padding: "7px 16px",
              color: "rgba(167,139,250,0.7)", fontSize: "12px", fontWeight: 500,
            }}>{f}</span>
          ))}
        </div>
      )}

      {/* Preview */}
      {state.status === "done" && htmlPreview && (
        <div style={{
          marginTop: "32px", width: "100%", maxWidth: "880px",
          position: "relative", zIndex: 1,
          border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: "20px", overflow: "hidden",
          boxShadow: "0 0 60px rgba(99,102,241,0.15)",
          background: "rgba(10,8,30,0.5)",
        }}>
          <div style={{
            padding: "14px 22px",
            borderBottom: "1px solid rgba(139,92,246,0.15)",
            color: "rgba(167,139,250,0.7)", fontSize: "13px", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(99,102,241,0.05)",
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span style={{ marginLeft: 8 }}>👁️ Document Preview</span>
          </div>
          <iframe srcDoc={htmlPreview}
            style={{ width: "100%", height: "720px", border: "none", display: "block" }}
            title="Preview" />
        </div>
      )}

      <style>{`
        @keyframes float {
          0%,100% { transform: perspective(400px) rotateX(8deg) rotateY(-5deg) translateY(0px); }
          50% { transform: perspective(400px) rotateX(8deg) rotateY(-5deg) translateY(-10px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function glowBtn(color: string, hovered: boolean): React.CSSProperties {
  return {
    background: hovered
      ? color
      : `${color}22`,
    border: `1px solid ${color}66`,
    color: hovered ? "#fff" : "#e0e7ff",
    borderRadius: "12px", padding: "12px 22px",
    fontSize: "14px", fontWeight: 700, cursor: "pointer",
    width: "100%",
    transition: "all 0.2s",
    boxShadow: hovered ? `0 0 24px ${color}55` : "none",
    letterSpacing: "0.3px",
  };
}
