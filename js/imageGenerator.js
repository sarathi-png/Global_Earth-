const IncidentImageGenerator = {
    canvas: null,
    ctx: null,

    init() {
        if (this.canvas) return;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 640;
        this.canvas.height = 360;
        this.ctx = this.canvas.getContext('2d');
    },

    typeConfig: {
        disaster: {
            icon: 'fa-house-damage',
            bg: '#1a0a00',
            accent: '#ffb400',
            text: 'MAJOR DISASTER'
        },
        war: {
            icon: 'fa-shield-alt',
            bg: '#1a0000',
            accent: '#ff3b30',
            text: 'CONFLICT / WAR'
        },
        mystery: {
            icon: 'fa-question-circle',
            bg: '#0d001a',
            accent: '#bf5af2',
            text: 'MYSTERY / UNKNOWN'
        },
        history: {
            icon: 'fa-history',
            bg: '#001a1a',
            accent: '#fc3d21',
            text: 'MAJOR HISTORICAL EVENT'
        },
        aircraft: {
            icon: 'fa-plane',
            bg: '#001020',
            accent: '#00d4ff',
            text: 'AEROSPACE TRACKING'
        },
        satellite: {
            icon: 'fa-satellite',
            bg: '#101000',
            accent: '#ff9500',
            text: 'SATELLITE ORBIT'
        },
        default: {
            icon: 'fa-globe',
            bg: '#0a0a1a',
            accent: '#fc3d21',
            text: 'INTELLIGENCE REPORT'
        }
    },

    generate(type, title, year) {
        this.init();
        const config = this.typeConfig[type] || this.typeConfig.default;

        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        const gradient = ctx.createLinearGradient(0, 0, W, H);
        gradient.addColorStop(0, config.bg);
        gradient.addColorStop(0.5, this.darken(config.bg, 30));
        gradient.addColorStop(1, config.bg);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = config.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, W - 20, H - 20);

        const innerGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.45);
        innerGrad.addColorStop(0, this.hexToRgba(config.accent, 0.08));
        innerGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = innerGrad;
        ctx.fillRect(10, 10, W - 20, H - 20);

        ctx.fillStyle = config.accent;
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.letterSpacing = '3px';
        ctx.textAlign = 'center';
        ctx.fillText(config.text, W / 2, 50);

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 28px "Inter", sans-serif';
        const words = title.split(' ');
        const lines = [];
        let currentLine = '';
        words.forEach(word => {
            const test = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(test).width > W - 80) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = test;
            }
        });
        lines.push(currentLine);
        const lineHeight = 36;
        const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
            ctx.fillText(line, W / 2, startY + i * lineHeight);
        });

        if (year) {
            ctx.fillStyle = config.accent;
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.fillText(String(year), W / 2, H - 45);
        }

        const dotX = 80;
        const dotY = H - 45;
        const dotR = 5;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = config.accent;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '12px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('GEO-INTEL', dotX + 15, dotY + 4);

        return this.canvas.toDataURL('image/png');
    },

    darken(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },

    hexToRgba(hex, alpha) {
        const num = parseInt(hex.replace('#', ''), 16);
        const R = num >> 16;
        const G = (num >> 8) & 0x00FF;
        const B = num & 0x0000FF;
        return `rgba(${R},${G},${B},${alpha})`;
    }
};

window.IncidentImageGenerator = IncidentImageGenerator;
