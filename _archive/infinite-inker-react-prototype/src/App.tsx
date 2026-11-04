import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- TYPES ---
interface Point { x: number; y: number; }
interface Camera { x: number; y: number; scale: number; }
interface Stroke { 
  points: Point[]; 
  color: string; 
  size: number; 
  opacity: number;
  type: 'ink' | 'glow' | 'pixel' | 'eraser';
}
interface World { name: string; strokes: Stroke[]; bgColor: string; camera: Camera; }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // --- PERSISTENT STATE ---
  const [worlds, setWorlds] = useState<Record<string, World>>(() => 
    JSON.parse(localStorage.getItem('Inker_V16_Worlds') || '{"Default": {"name":"Default", "strokes":[], "bgColor":"#111111", "camera":{"x":0,"y":0,"scale":1}}}')
  );
  const [activeWorld, setActiveWorld] = useState(localStorage.getItem('Inker_Active_V16') || 'Default');

  // World Context
  const currentWorld = worlds[activeWorld];
  const [camera, setCamera] = useState<Camera>(currentWorld.camera);
  const [strokes, setStrokes] = useState<Stroke[]>(currentWorld.strokes);
  const [bgColor, setBgColor] = useState(currentWorld.bgColor);
  
  // UI State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [tool, setTool] = useState<Stroke['type']>('ink');
  const [color, setColor] = useState('#00d4ff');
  const [brushSize, setBrushSize] = useState(20);
  const [opacity, setOpacity] = useState(100);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // --- SAVE LOGIC ---
  useEffect(() => {
    const updated = { ...worlds, [activeWorld]: { name: activeWorld, strokes, bgColor, camera } };
    localStorage.setItem('Inker_V16_Worlds', JSON.stringify(updated));
    localStorage.setItem('Inker_Active_V16', activeWorld);
  }, [strokes, camera, bgColor, activeWorld, worlds]);

  // --- MATH HELPERS ---
  const getWorldPos = (cx: number, cy: number) => ({
    x: (cx - window.innerWidth / 2) / camera.scale + camera.x,
    y: (cy - window.innerHeight / 2) / camera.scale + camera.y
  });

  const toScreen = useCallback((p: Point) => ({
    x: (p.x - camera.x) * camera.scale + window.innerWidth / 2,
    y: (p.y - camera.y) * camera.scale + window.innerHeight / 2
  }), [camera]);

  // --- RENDER ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(s => {
      ctx.save();
      const sWidth = s.size * camera.scale;

      if (s.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(255,255,255,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = s.opacity / 100;
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
      }

      if (s.type === 'glow' && s.type !== 'eraser') {
        ctx.shadowBlur = sWidth;
        ctx.shadowColor = s.color;
        ctx.strokeStyle = 'rgba(0,0,0,0)'; // Invisible spine for pure light
        ctx.lineWidth = 1;
      } else {
        ctx.lineWidth = sWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      if (s.type === 'pixel') {
        s.points.forEach(p => {
          const sc = toScreen(p);
          ctx.fillRect(sc.x - sWidth/2, sc.y - sWidth/2, sWidth, sWidth);
        });
      } else if (s.points.length > 0) {
        ctx.beginPath();
        const start = toScreen(s.points[0]);
        ctx.moveTo(start.x, start.y);
        if (s.points.length === 1) ctx.lineTo(start.x + 0.1, start.y);
        else s.points.forEach(p => { const sc = toScreen(p); ctx.lineTo(sc.x, sc.y); });
        ctx.stroke();
      }
      ctx.restore();
    });
  }, [camera, strokes, bgColor, toScreen]);

  // --- INTERACTIONS ---
  const handleDown = (e: React.MouseEvent) => {
    if (e.button === 2) { setIsPanning(true); return; }
    
    // Color Picker Logic
    if ((tool as any) === 'picker') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const data = ctx.getImageData(e.clientX, e.clientY, 1, 1).data;
        const hex = "#" + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1);
        setColor(hex);
        setTool('ink');
      }
      return;
    }

    setIsDrawing(true);
    const pt = getWorldPos(e.clientX, e.clientY);
    setStrokes(prev => [...prev, { 
        points: [pt], color, size: brushSize / camera.scale, 
        opacity, type: tool 
    }]);
  };

  const handleMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isDrawing) {
      const pt = getWorldPos(e.clientX, e.clientY);
      setStrokes(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [...prev.slice(0, -1), { ...last, points: [...last.points, pt] }];
      });
    } else if (isPanning) {
      setCamera(prev => ({ ...prev, x: prev.x - e.movementX / prev.scale, y: prev.y - e.movementY / prev.scale }));
    }
  };

  const createWorld = () => {
    const name = prompt("Universe Name?");
    if (name) {
      setWorlds(prev => ({ ...prev, [name]: { name, strokes: [], bgColor: "#111111", camera: { x: 0, y: 0, scale: 1 } } }));
      setActiveWorld(name);
      setStrokes([]); setCamera({ x: 0, y: 0, scale: 1 }); setBgColor("#111111");
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      {/* GHOST CURSOR */}
      <div style={{ 
        position: 'fixed', left: mousePos.x, top: mousePos.y, 
        width: brushSize, height: brushSize, 
        border: '1px solid rgba(255,255,255,0.4)', 
        borderRadius: tool === 'pixel' ? 0 : '50%', 
        pointerEvents: 'none', transform: 'translate(-50%, -50%)', zIndex: 999 
      }} />

      {/* UI SIDEBAR */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, background: '#111', padding: '15px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '8px', width: '190px' }}>
        <select value={activeWorld} onChange={e => setActiveWorld(e.target.value)} style={{ background: '#222', color: '#fff', padding: '5px' }}>
          {Object.keys(worlds).map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <button onClick={createWorld}>+ CREATE NEW WORLD</button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '10px' }}>
            <button onClick={() => setTool('ink')} style={{ background: tool === 'ink' ? '#00d4ff' : '#333' }}>INK</button>
            <button onClick={() => setTool('glow')} style={{ background: tool === 'glow' ? '#00d4ff' : '#333' }}>GLOW</button>
            <button onClick={() => setTool('pixel')} style={{ background: tool === 'pixel' ? '#00d4ff' : '#333' }}>PIXEL</button>
            <button onClick={() => setTool('eraser')} style={{ background: tool === 'eraser' ? '#ff4400' : '#333' }}>ERASER</button>
            <button onClick={() => setTool('picker' as any)}>PICKER</button>
        </div>

        <span style={{ fontSize: '9px', color: '#666' }}>SIZE: {brushSize}px</span>
        <input type="range" min="1" max="200" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} />
        
        <span style={{ fontSize: '9px', color: '#666' }}>OPACITY: {opacity}%</span>
        <input type="range" min="1" max="100" value={opacity} onChange={e => setOpacity(Number(e.target.value))} />

        <span style={{ fontSize: '9px', color: '#666' }}>INK / PAPER COLOR</span>
        <div style={{ display: 'flex', gap: '5px' }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ flex: 1 }} title="Brush Color" />
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ flex: 1 }} title="Background Color" />
        </div>

        <button onClick={() => setStrokes(p => p.slice(0, -1))} style={{ marginTop: '10px' }}>UNDO (Ctrl+Z)</button>
      </div>

      <canvas 
        ref={canvasRef} 
        onWheel={(e) => {
            const zoom = e.deltaY > 0 ? 0.9 : 1.1;
            const worldBefore = getWorldPos(e.clientX, e.clientY);
            const nextScale = camera.scale * zoom;
            setCamera({ scale: nextScale, x: worldBefore.x - (e.clientX - window.innerWidth / 2) / nextScale, y: worldBefore.y - (e.innerHeight / 2) / nextScale });
        }} 
        onMouseDown={handleDown} 
        onMouseMove={handleMove} 
        onMouseUp={() => setIsDrawing(false)} 
        onContextMenu={e => e.preventDefault()} 
        style={{ display: 'block', cursor: 'none' }} 
      />
    </div>
  );
}
