const WikipediaImage = {
    cache: new Map(),

    extractKeywords(title) {
        if (!title) return '';
        let s = title.replace(/\(.*?\)/g, '').replace(/M\s*[\d.]+\s*-\s*/gi, '').replace(/^\d+\s*km\s*\w+\s*of\s*/gi, '').trim();
        // Keep last 3-5 meaningful words (usually location + event type)
        const stopWords = new Set(['the','of','and','in','on','at','near','km','mi','ca']);
        const words = s.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
        // Prefer tail (location) + head hint if disaster keyword present
        const disasterKeywords = ['earthquake','tsunami','volcano','flood','wildfire','cyclone','hurricane','tornado','landslide','drought','storm','avalanche','fire'];
        const hasDisaster = words.find(w => disasterKeywords.includes(w.toLowerCase()));
        const tail = words.slice(-4).join(' ');
        return hasDisaster ? `${tail} ${hasDisaster}`.trim() : (tail || s.slice(0, 60));
    },

    async getThumbnail(title, minWidth = 320) {
        if (!title) return null;
        const key = title.toLowerCase();
        if (this.cache.has(key)) return this.cache.get(key);

        const clean = title.replace(/\([^)]*\)/g, '').replace(/&/g, 'and').trim();
        // Try cleaned title, then keyword-extracted fallback
        const candidates = [clean, this.extractKeywords(title)].filter((v,i,a)=> v && a.indexOf(v)===i);

        for (const q of candidates) {
            const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}?redirect=true`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            try {
                const res = await fetch(wikiUrl, { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) {
                    const data = await res.json();
                    const source = data.thumbnail && data.thumbnail.source ? data.thumbnail.source : null;
                    if (source) {
                        // Upgrade thumbnail to requested width if possible
                        const upgraded = minWidth > 320 ? source.replace(/\/\d+px-/, `/${minWidth}px-`) : source;
                        this.cache.set(key, upgraded);
                        return upgraded;
                    }
                    // If page exists but no thumbnail, try originalimage
                    if (data.originalimage && data.originalimage.source) {
                        this.cache.set(key, data.originalimage.source);
                        return data.originalimage.source;
                    }
                }
            } catch (e) { clearTimeout(timeout); }
        }

        return this.getFromCommons(this.extractKeywords(title) || clean, key);
    },

    async getFromCommons(query, cacheKey) {
        if (!query) { this.cache.set(cacheKey, null); return null; }
        // Search Commons for keyword, then fetch thumb URL in same call via generator
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(searchUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                const pages = data.query && data.query.pages;
                if (pages) {
                    for (const page of Object.values(pages)) {
                        if (page.imageinfo && page.imageinfo[0]) {
                            const url = page.imageinfo[0].thumburl || page.imageinfo[0].url;
                            // Only accept image mime types
                            if (/\.(jpe?g|png|webp)$/i.test(url)) {
                                this.cache.set(cacheKey, url);
                                return url;
                            }
                        }
                    }
                }
            }
        } catch (e) { clearTimeout(timeout); }
        this.cache.set(cacheKey, null);
        return null;
    }
};

window.WikipediaImage = WikipediaImage;