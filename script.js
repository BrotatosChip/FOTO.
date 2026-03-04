let photos = [];
let config = { 
    layout: 'A', 
    filter: 'none', 
    lang: localStorage.getItem('foto_lang') || 'en', 
    maxPhotos: 3, 
    orientation: 'v' 
};

// --- DUO STATE ---
let peer;
let conn;
let isDuoMode = false;

const i18n = {
    en: { 
        start: "START SESSION", layout: "Select Style", step1: "Layout", step2: "Snap", 
        step3: "Design", frame: "Frame Design", save: "Save & Finish", discard: "Discard",
        spotlight: "Your Spotlight", back: "← Back", empty: "No memories captured yet!" 
    },
    kh: { 
        start: "ចាប់ផ្តើម", layout: "ជ្រើសរើសម៉ូត", step1: "ម៉ូត", step2: "ថតរូប", 
        step3: "រចនា", frame: "ពណ៌ស៊ុម", save: "រក្សាទុក", discard: "បោះបង់",
        spotlight: "ការចងចាំរបស់អ្នក", back: "← ត្រឡប់ក្រោយ", empty: "មិនទាន់មានរូបភាពនៅឡើយទេ!"
    }
};

const LAYOUT_DEFS = {
    A: { max: 3, type: 'v' }, B: { max: 4, type: 'v' }, C: { max: 4, type: 'v' },
    D: { max: 2, type: 'v' }, E: { max: 3, type: 'v' }, F: { max: 4, type: 'v' },
    G: { max: 3, type: 'v' }, H: { max: 2, type: 'v' }, I: { max: 1, type: 'h' },
    J: { max: 4, type: 'h' }, K: { max: 4, type: 'h' }, L: { max: 4, type: 'h' },
    M: { max: 2, type: 'h' }, N: { max: 4, type: 'h' }, O: { max: 2, type: 'h' }
};

// --- THEME & LANG MEMORY ---
(function initApp() {
    const savedTheme = localStorage.getItem('foto_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    window.addEventListener('DOMContentLoaded', () => {
        if (savedTheme === 'dark') {
            document.querySelector('.sun-path')?.classList.add('hidden');
            document.querySelector('.moon-path')?.classList.remove('hidden');
        }
        setLang(config.lang);
    });
})();

// --- DUO CONNECTION LOGIC ---
function initDuo(isHost) {
    peer = new Peer();
    
    peer.on('open', (id) => {
        if (isHost) {
            const shortCode = id.slice(0, 4).toUpperCase();
            alert("Share this Room ID: " + shortCode);
            isDuoMode = true;
        } else {
            const connectTo = prompt("Enter partner's 4-digit code:").toLowerCase();
            conn = peer.connect(connectTo);
            setupConn();
        }
    });

    peer.on('connection', (connection) => {
        conn = connection;
        isDuoMode = true;
        setupConn();
    });
}

function setupConn() {
    conn.on('data', (data) => {
        if (data.type === 'SNAP_SIGNAL') {
            runCapture(); 
        }
        if (data.type === 'PHOTO_DATA') {
            photos.push(data.img);
            document.getElementById('count-num').innerText = photos.length;
            if (photos.length >= config.maxPhotos) renderEditor();
        }
    });

    // --- NEW: Connection Health Handlers ---
    conn.on('close', () => {
        alert("Partner disconnected. Returning to home.");
        location.reload();
    });

    conn.on('error', (err) => {
        console.error("Duo Error:", err);
        alert("Connection lost.");
        location.reload();
    });

    // --- Added logic for Duo UI and Alert ---
    const badge = document.getElementById('duo-status');
    if (badge) badge.classList.remove('hidden');
    
    alert("Duo Connected!");
    startApp();
}

function syncShutter() {
    if (isDuoMode && conn && conn.open) {
        conn.send({ type: 'SNAP_SIGNAL' });
    }
    runCapture();
}

// --- NAVIGATION ---
function setLang(l) {
    config.lang = l;
    localStorage.setItem('foto_lang', l);
    document.querySelectorAll('.lang-toggle button').forEach(b => b.classList.toggle('active', b.id === `btn-${l}`));
    document.getElementById('btn-start').innerText = i18n[l].start;
    document.getElementById('title-layout').innerText = i18n[l].layout;
    document.getElementById('lbl-step1').innerText = i18n[l].step1;
    document.getElementById('lbl-step2').innerText = i18n[l].step2;
    document.getElementById('lbl-step3').innerText = i18n[l].step3;
    document.getElementById('title-frame').innerText = i18n[l].frame;
    document.getElementById('btn-save').innerText = i18n[l].save;
    document.getElementById('btn-discard').innerText = i18n[l].discard;
    const spotlightLbl = document.getElementById('lbl-spotlight');
    if (spotlightLbl) spotlightLbl.innerText = l === 'kh' ? "ការចងចាំ" : "Memories";
}

document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('foto_theme', isDark ? 'dark' : 'light');
    document.querySelector('.sun-path').classList.toggle('hidden', isDark);
    document.querySelector('.moon-path').classList.toggle('hidden', !isDark);
};

function updateSteps(n) {
    document.getElementById('progress-bar').classList.toggle('hidden', n === 0);
    const spotlight = document.getElementById('spotlight-btn');
    if (spotlight) spotlight.classList.toggle('hidden', n !== 0);
    document.querySelectorAll('.step-box').forEach((box, i) => {
        box.classList.toggle('active', i + 1 <= n);
    });
}

function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function startApp() {
    photos = [];
    updateSteps(1);
    showView('view-layout');
}

function scrollLayouts(direction) {
    const viewport = document.getElementById('layout-viewport');
    viewport.scrollBy({ left: direction * 220, behavior: 'smooth' });
}

// --- CAMERA & CAPTURE ---
async function selectLayout(id) {
    const def = LAYOUT_DEFS[id];
    config.layout = id;
    config.maxPhotos = def.max;
    config.orientation = def.type;
    document.getElementById('max-num').innerText = config.maxPhotos;
    document.getElementById('count-num').innerText = "0";
    updateSteps(2);
    showView('view-camera');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById('video').srcObject = stream;
}

function setFilter(f) {
    config.filter = f;
    document.getElementById('video').style.filter = f;
    document.querySelectorAll('.f-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(f));
    });
}

function runCapture() {
    photos = [];
    document.getElementById('shutter').classList.add('hidden');
    autoSnap();
}

function autoSnap() {
    if (photos.length >= config.maxPhotos) {
        const stream = document.getElementById('video').srcObject;
        if (stream) stream.getTracks().forEach(track => track.stop());
        renderEditor();
        return;
    }
    let timer = 3;
    const cd = document.getElementById('countdown');
    cd.innerText = timer;
    cd.classList.remove('hidden');
    const interval = setInterval(() => {
        timer--;
        cd.innerText = timer;
        if (timer === 0) {
            clearInterval(interval);
            cd.classList.add('hidden');
            flash();
            takePhoto();
            document.getElementById('count-num').innerText = photos.length;
            setTimeout(autoSnap, 1000);
        }
    }, 1000);
}

function flash() {
    const f = document.getElementById('flash');
    f.style.opacity = 1;
    setTimeout(() => f.style.opacity = 0, 100);
}

function takePhoto() {
    const v = document.getElementById('video');
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.filter = config.filter;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    
    const localImg = c.toDataURL();
    photos.push(localImg);

    if (isDuoMode && conn && conn.open) {
        conn.send({ type: 'PHOTO_DATA', img: localImg });
    }
}

// --- EDITOR & DESIGN ---
function renderEditor() {
    updateSteps(3);
    showView('view-editor');
    const inner = document.getElementById('strip-inner');
    inner.innerHTML = '';
    inner.className = config.orientation === 'v' ? "v-mode" : "h-mode"; 
    inner.classList.add(`mode-${config.layout}`);
    photos.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        inner.appendChild(img);
    });
}

function changeDesign(type) {
    const strip = document.getElementById('final-strip');
    const footer = document.getElementById('strip-footer-text');
    
    strip.classList.remove('film-mode', 'frame-90s', 'frame-polaroid');
    strip.style.backgroundColor = "";

    if (type === 'film') {
        strip.classList.add('film-mode');
        strip.style.backgroundColor = '#111111';
        footer.style.color = '#555';
    } else if (type === '90s') {
        strip.classList.add('frame-90s');
        footer.style.color = '#111';
    } else if (type === 'polaroid') {
        strip.classList.add('frame-polaroid');
        strip.style.backgroundColor = '#ffffff';
        footer.style.color = '#111';
    } else {
        const colorMap = { 'white': '#ffffff', 'pink': '#fce4ec' };
        strip.style.backgroundColor = colorMap[type] || type;
        footer.style.color = '#111';
    }
}

// --- EXPORT ENGINE ---
function generateDownload() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const isV = config.orientation === 'v';
    const strip = document.getElementById('final-strip');
    
    canvas.width = isV ? 600 : 1800;
    canvas.height = isV ? 1800 : 1200;

    let bgColor = window.getComputedStyle(strip).backgroundColor;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (strip.classList.contains('frame-90s')) {
        ctx.fillStyle = "rgba(0,0,0,0.02)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const pad = 50;
    const gap = 25;
    const bottomSpace = strip.classList.contains('frame-polaroid') ? 220 : 120;
    const usableW = canvas.width - (pad * 2);
    const usableH = canvas.height - (pad * 2) - bottomSpace;

    photos.forEach((src, i) => {
        const img = new Image();
        img.src = src;
        let x, y, w, h;

        if (isV) {
            let rows = (config.layout === 'F') ? 2 : config.maxPhotos;
            let cols = (config.layout === 'F') ? 2 : 1;
            w = (usableW / cols) - (cols > 1 ? gap/2 : 0);
            h = (usableH / rows) - gap;
            x = pad + (i % cols) * (w + gap);
            y = pad + Math.floor(i / cols) * (h + gap);
        } else {
            if (config.layout === 'J') {
                if (i === 0) { w = usableW; h = usableH * 0.65; x = pad; y = pad; }
                else { w = (usableW/3) - gap; h = usableH * 0.3; x = pad + (i-1)*(w+gap); y = pad + (usableH*0.65) + gap; }
            } else if (config.layout === 'I') {
                w = usableW; h = usableH; x = pad; y = pad;
            } else {
                let cols = 2;
                w = (usableW / cols) - gap/2;
                h = (config.maxPhotos > 2) ? (usableH / 2 - gap/2) : usableH;
                x = pad + (i % cols) * (w + gap);
                y = pad + Math.floor(i / cols) * (h + gap);
            }
        }
        ctx.drawImage(img, x, y, w, h);
    });

    const isDarkFrame = (bgColor === "rgb(17, 17, 17)");
    const textColor = isDarkFrame ? "#ffffff" : "#111111";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.font = "900 40px Inter";
    ctx.fillText("FOTO.", canvas.width / 2, canvas.height - (bottomSpace/2 + 10));
    
    const now = new Date();
    const timeStr = now.toLocaleDateString() + " " + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    ctx.font = "600 18px Inter";
    ctx.globalAlpha = isDarkFrame ? 0.3 : 0.4;
    ctx.fillText(timeStr, canvas.width / 2, canvas.height - (bottomSpace/2 - 25));
    ctx.globalAlpha = 1.0;
    
    return canvas.toDataURL('image/png', 1.0);
}

function finishSession() {
    const btn = document.getElementById('btn-save');
    btn.innerText = "Generating...";
    btn.disabled = true;
    setTimeout(() => {
        const finalImage = generateDownload();
        const gallery = JSON.parse(localStorage.getItem('foto_gallery') || '[]');
        gallery.unshift(finalImage);
        localStorage.setItem('foto_gallery', JSON.stringify(gallery.slice(0, 15)));
        const link = document.createElement('a');
        link.download = `FOTO_${Date.now()}.png`;
        link.href = finalImage;
        link.click();
        btn.innerText = "Saved!";
        setTimeout(() => location.reload(), 1500);
    }, 500);
}
