const video = document.getElementById('webcam-feed');
let stream = null;

export async function startWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
            audio: false
        });
        video.srcObject = stream;
        await video.play();
        return true;
    } catch (err) {
        console.warn('Webcam error:', err.message);
        return false;
    }
}

export function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
    }
}

// ====== Определение лица через canvas ======
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

export function detectFace() {
    if (!video.videoWidth || !video.readyState) return null;
    
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    // Улучшенный детектор кожи
    let totalPixels = 0;
    let sumX = 0, sumY = 0;
    
    for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Нормализованный RGB детектор кожи
            const sum = r + g + b;
            if (sum === 0) continue;
            
            const nr = r / sum;
            const ng = g / sum;
            
            // Правила для кожи
            if (r > g && r > b &&
                r > 60 && g > 30 && b > 10 &&
                nr > 0.32 && nr < 0.60 &&
                ng > 0.20 && ng < 0.40 &&
                r - g > 10) {
                sumX += x;
                sumY += y;
                totalPixels++;
            }
        }
    }
    
    if (totalPixels > 30) {
        const centerX = (sumX / totalPixels / w) * 2 - 1;
        const centerY = (sumY / totalPixels / h) * 2 - 1;
        return { x: Math.max(-1, Math.min(1, centerX)), y: Math.max(-1, Math.min(1, centerY)) };
    }
    
    return null;
}
