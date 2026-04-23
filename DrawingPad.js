
// ── Setup ──────────────────────────────────────────
const canvas = document.getElementById('logo-canvas');
const ctx    = canvas.getContext('2d');
const scroll = document.getElementById('canvasScroll');
 
let tool         = 'pen';
let currentColor = '#000000';
let brushSize    = 5;
let brushOpacity = 1;
 
let isDrawing = false;
let startX = 0, startY = 0;
let snapshot  = null;
 
let strokeHistory = [];   
let savedLogos    = [];  
let logoIndex     = -1;
 
// ── Colour palette ─────────────────────────────────
const PALETTE = [
    '#000000','#ffffff','#ef4444','#f97316',
    '#eab308','#22c55e','#06b6d4','#3b82f6',
    '#8b5cf6','#ec4899','#94a3b8','#1e293b',
    '#7c3aed','#0f766e','#b45309','#be123c',
];
const swatchGrid = document.getElementById('swatchGrid');
PALETTE.forEach(hex => {
    const d = document.createElement('div');
    d.className = 'color-swatch' + (hex === '#000000' ? ' selected' : '');
    d.style.background = hex;
    d.title = hex;
    d.addEventListener('click', () => setColor(hex, d));
    swatchGrid.appendChild(d);
});
 
function setColor(hex, el) {
    currentColor = hex;
    document.getElementById('currentColorDisplay').style.background = hex;
    try { document.getElementById('customColorPicker').value = hex; } catch(e) {}
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    if (el) el.classList.add('selected');
}
 
document.getElementById('customColorPicker').addEventListener('input', e => {
    setColor(e.target.value, null);
});
 
// ── Sliders ────────────────────────────────────────
document.getElementById('brushSize').addEventListener('input', e => {
    brushSize = +e.target.value;
    document.getElementById('brushSizeVal').textContent = brushSize;
});
document.getElementById('brushOpacity').addEventListener('input', e => {
    brushOpacity = +e.target.value;
    document.getElementById('brushOpacityVal').textContent = Math.round(brushOpacity * 100) + '%';
});
 
// ── Tool selection ─────────────────────────────────
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
});
 
function selectTool(t) {
    tool = t;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === t);
    });
    document.getElementById('activeTool').textContent = t;
}
 
// Keyboard shortcuts
window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const map = { p:'pen', e:'eraser', f:'fill', i:'eyedrop', l:'line', r:'rect', c:'circle' };
    if (map[e.key]) { selectTool(map[e.key]); return; }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDrawing(); }
    if (e.key === 'ArrowLeft')  prevLogo();
    if (e.key === 'ArrowRight') nextLogo();
});
 
// ── Coordinate helper ──────────────────────────────
function getXY(e) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const src    = e.touches ? e.touches[0] : e;
    return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
    };
}
 
// ── Undo ───────────────────────────────────────────
function pushHistory() {
    strokeHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (strokeHistory.length > 60) strokeHistory.shift();
}
function undo() {
    if (!strokeHistory.length) return;
    ctx.putImageData(strokeHistory.pop(), 0, 0);
}
 
// ── Pen / Eraser ───────────────────────────────────
function startPen(x, y) {
    pushHistory();
    ctx.beginPath();
    ctx.moveTo(x, y);
}
function movePen(x, y) {
    ctx.globalAlpha = brushOpacity;
    ctx.lineWidth   = brushSize;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}
function endPen() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
}
 
// ── Shapes ─────────────────────────────────────────
function drawShape(x, y) {
    ctx.putImageData(snapshot, 0, 0);
    ctx.globalAlpha              = brushOpacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
    ctx.fillStyle   = currentColor;
    ctx.lineWidth   = brushSize;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    if (tool === 'line') {
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();
    } else if (tool === 'rect') {
    ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (tool === 'circle') {
    const rx = Math.abs(x - startX) / 2;
    const ry = Math.abs(y - startY) / 2;
    const cx = startX + (x - startX) / 2;
    const cy = startY + (y - startY) / 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    }
    ctx.globalAlpha = 1;
}
 
// ── Flood fill (bucket) ────────────────────────────
function hexToRGBA(hex) {
    return [
    parseInt(hex.slice(1,3), 16),
    parseInt(hex.slice(3,5), 16),
    parseInt(hex.slice(5,7), 16),
    255,
    ];
}
function colorsMatch(data, idx, target, tol = 32) {
    return Math.abs(data[idx]   - target[0]) <= tol &&
            Math.abs(data[idx+1] - target[1]) <= tol &&
            Math.abs(data[idx+2] - target[2]) <= tol &&
            Math.abs(data[idx+3] - target[3]) <= tol;
}
function floodFill(fx, fy, fillHex) {
    pushHistory();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data    = imgData.data;
    const W = canvas.width, H = canvas.height;
    const ix  = Math.floor(fx), iy = Math.floor(fy);
    const i0  = (iy * W + ix) * 4;
    const tgt = [data[i0], data[i0+1], data[i0+2], data[i0+3]];
    const fill = hexToRGBA(fillHex);
    if (colorsMatch(data, i0, fill, 5)) return;
 
    const stack = [ix, iy];
    while (stack.length) {
    const py = stack.pop(), px = stack.pop();
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const i = (py * W + px) * 4;
    if (!colorsMatch(data, i, tgt)) continue;
    data[i] = fill[0]; data[i+1] = fill[1];
    data[i+2] = fill[2]; data[i+3] = fill[3];
    stack.push(px+1, py, px-1, py, px, py+1, px, py-1);
    }
    ctx.putImageData(imgData, 0, 0);
}
 
// ── Eyedropper ─────────────────────────────────────
function pickColor(x, y) {
    const p   = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const hex = '#' + [p[0],p[1],p[2]].map(v => v.toString(16).padStart(2,'0')).join('');
    setColor(hex, null);
    canvas.classList.add('eyedrop-flash');
    setTimeout(() => canvas.classList.remove('eyedrop-flash'), 400);
    selectTool('pen');
}
 
// ── Event routing ──────────────────────────────────
function onDown(e) {
    e.preventDefault();
    const {x, y} = getXY(e);
    if (tool === 'fill')    { floodFill(x, y, currentColor); return; }
    if (tool === 'eyedrop') { pickColor(x, y); return; }
    isDrawing = true;
    startX = x; startY = y;
    if (tool === 'pen' || tool === 'eraser') {
    startPen(x, y);
    } else {
    pushHistory();
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}
function onMove(e) {
    e.preventDefault();
    const {x, y} = getXY(e);
    document.getElementById('cursorPos').textContent = Math.round(x) + ', ' + Math.round(y);
    if (!isDrawing) return;
    if (tool === 'pen' || tool === 'eraser') movePen(x, y);
    else drawShape(x, y);
}
function onUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    endPen();
    snapshot = null;
}
 
canvas.addEventListener('mousedown',  onDown);
canvas.addEventListener('mousemove',  onMove);
canvas.addEventListener('mouseup',    onUp);
canvas.addEventListener('mouseleave', onUp);
canvas.addEventListener('touchstart', onDown, { passive: false });
canvas.addEventListener('touchmove',  onMove, { passive: false });
canvas.addEventListener('touchend',   onUp);
 
// ── Save / navigate / clear ────────────────────────
function saveDrawing() {
    const dataURL = canvas.toDataURL();
    savedLogos.push(dataURL);
    logoIndex = savedLogos.length - 1;
    addThumb(dataURL, logoIndex);
    updateUI();
}
 
function addThumb(dataURL, index) {
    const strip = document.getElementById('thumbStrip');
    const ph = strip.querySelector('span');
    if (ph) ph.remove();
 
    const wrap = document.createElement('div');
    wrap.className   = 'thumb-item';
    wrap.dataset.index = index;
 
    const tc   = document.createElement('canvas');
    tc.width   = 144; tc.height = 72;
    const tctx = tc.getContext('2d');
    const img  = new Image();
    img.onload = () => tctx.drawImage(img, 0, 0, 144, 72);
    img.src    = dataURL;
 
    const del  = document.createElement('button');
    del.className   = 'thumb-del';
    del.textContent = '✕';
    del.title = 'Delete save';
    del.addEventListener('click', e => { e.stopPropagation(); deleteSave(index); });
 
    wrap.appendChild(tc);
    wrap.appendChild(del);
    wrap.addEventListener('click', () => jumpTo(+wrap.dataset.index));
    strip.appendChild(wrap);
    highlightThumb(index);
}
 
function highlightThumb(idx) {
    document.querySelectorAll('.thumb-item').forEach(t => {
    t.classList.toggle('active', +t.dataset.index === idx);
    });
}
 
function jumpTo(idx) {
    if (idx < 0 || idx >= savedLogos.length) return;
    logoIndex = idx;
    const img = new Image();
    img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    };
    img.src = savedLogos[idx];
    highlightThumb(idx);
    updateUI();
}
 
function prevLogo() {
    if (logoIndex > 0) jumpTo(logoIndex - 1);
    else if (logoIndex === 0) {
    logoIndex = -1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    highlightThumb(-1);
    updateUI();
    } else {
    alert('No previous saved logos!');
    }
}
 
function nextLogo() {
    if (logoIndex < savedLogos.length - 1) jumpTo(logoIndex + 1);
}
 
function deleteSave(idx) {
    savedLogos.splice(idx, 1);
    const strip = document.getElementById('thumbStrip');
    strip.innerHTML = '';
    if (!savedLogos.length) {
    strip.innerHTML = '<span style="font-size:0.72rem;color:var(--text-dim);align-self:center;">No saves yet</span>';
    logoIndex = -1;
    } else {
    savedLogos.forEach((d, i) => addThumb(d, i));
    if (logoIndex >= savedLogos.length) logoIndex = savedLogos.length - 1;
    }
    updateUI();
}
 
function clearCanvas() {
    if (!confirm('Clear the canvas? This cannot be undone.')) return;
    pushHistory();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokeHistory = [];
}
 
function exportPNG() {
    const a = document.createElement('a');
    a.download = 'drawing.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
}
 
function updateUI() {
    document.getElementById('count').textContent = savedLogos.length;
    document.getElementById('historyIndexDisplay').textContent =
    logoIndex === -1 ? '—' : (logoIndex + 1);
    highlightThumb(logoIndex);
}
 
// ── Init ───────────────────────────────────────────
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
selectTool('pen');
