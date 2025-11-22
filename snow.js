// Hóhullás animáció kezelése
class SnowAnimation {
    constructor() {
        this.canvas = document.getElementById('snow-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.flakes = [];
        this.isActive = false;
        this.animationFrame = null;
        this.lastTime = performance.now();
        this.windGlobal = 0;
        
        // Beállítások
        this.settings = {
            count: 200,
            sizeScale: 2.5,
            speedFactor: 1.0
        };
        
        this.init();
    }
    
    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Enyhe szélhatás egér mozgatáskor
        window.addEventListener('mousemove', (e) => {
            const centerX = this.canvas.width / 2;
            this.windGlobal = (e.clientX - centerX) / centerX * 0.4;
        });
        
        // Szél lassan visszaáll
        setInterval(() => { this.windGlobal *= 0.97; }, 100);
    }
    
    resize() {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        this.width = width;
        this.height = height;
    }
    
    createFlakes() {
        this.flakes = [];
        for (let i = 0; i < this.settings.count; i++) {
            this.flakes.push(new Flake(
                this.width,
                this.height,
                this.settings.sizeScale,
                this.settings.speedFactor
            ));
        }
    }
    
    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.canvas.style.display = 'block';
        this.createFlakes();
        this.lastTime = performance.now();
        this.loop();
    }
    
    stop() {
        this.isActive = false;
        this.canvas.style.display = 'none';
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    loop() {
        if (!this.isActive) return;
        
        const now = performance.now();
        const dt = Math.min(0.033, (now - this.lastTime) / 1000);
        this.lastTime = now;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        
        for (const flake of this.flakes) {
            flake.update(dt, this.width, this.height, this.windGlobal);
            flake.draw(this.ctx);
        }
        
        this.animationFrame = requestAnimationFrame(() => this.loop());
    }
}

class Flake {
    constructor(w, h, scale = 1, speedFactor = 1) {
        this.reset(w, h, scale, speedFactor);
    }
    
    reset(w, h, scale = 1, speedFactor = 1) {
        this.x = Math.random() * w;
        this.y = Math.random() * -h;
        this.size = (Math.random() * 1.2 + 0.8) * scale;
        this.speed = (Math.random() * 0.5 + 0.3) * speedFactor;
        this.wind = Math.random() * 1 - 0.5;
        this.tilt = Math.random() * Math.PI * 2;
        this.spin = (Math.random() * 0.02 - 0.01);
        this.opacity = Math.random() * 0.6 + 0.4;
    }
    
    update(dt, w, h, windGlobal) {
        this.tilt += this.spin * dt * 60;
        this.x += Math.sin(this.tilt) * 0.5 + (this.wind + windGlobal) * dt * 60;
        this.y += this.speed * dt * 60;
        
        if (this.y - this.size > h || this.x < -50 || this.x > w + 50) {
            this.reset(w, h);
            this.y = -10 - Math.random() * 50;
        }
    }
    
    draw(ctx) {
        ctx.beginPath();
        ctx.globalAlpha = this.opacity;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Globális snow objektum
window.snowAnimation = null;

// Inicializálás amikor a DOM betöltött
window.addEventListener('DOMContentLoaded', () => {
    window.snowAnimation = new SnowAnimation();
});