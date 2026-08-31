const WikimediaCommons = {
    cache: new Map(),
    async searchImage(query) {
        if (!query) return null;
        const key = query.toLowerCase();
        if (this.cache.has(key)) return this.cache.get(key);
        const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);
            if (res.ok) {
                const data = await res.json();
                const pages = data.query && data.query.pages;
                if (pages) {
                    for (const p of Object.values(pages)) {
                        const u = p.imageinfo && p.imageinfo[0] && (p.imageinfo[0].thumburl || p.imageinfo[0].url);
                        if (u && /\.(jpe?g|png|webp)$/i.test(u)) { this.cache.set(key, u); return u; }
                    }
                }
            }
        } catch(e){ clearTimeout(t); }
        this.cache.set(key, null);
        return null;
    }
};
window.WikimediaCommons = WikimediaCommons;
