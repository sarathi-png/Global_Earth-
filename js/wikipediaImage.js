const WikipediaImage = {
    cache: new Map(),

    async getThumbnail(title, minWidth = 320) {
        if (!title) return null;
        const key = title.toLowerCase();
        if (this.cache.has(key)) return this.cache.get(key);

        const clean = title.replace(/\([^)]*\)/g, '').replace(/&/g, 'and').trim();

        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}?redirect=true`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        try {
            const res = await fetch(wikiUrl, { signal: controller.signal });
            if (res.ok) {
                const data = await res.json();
                const source = data.thumbnail && data.thumbnail.source ? data.thumbnail.source : null;
                if (source) {
                    this.cache.set(key, source);
                    clearTimeout(timeout);
                    return source;
                }
            }
        } catch (e) { /* continue to commons */ }
        clearTimeout(timeout);

        return this.getFromCommons(clean, key);
    },

    async getFromCommons(query, cacheKey) {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(query)}&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        try {
            const res = await fetch(commonsUrl, { signal: controller.signal });
            if (res.ok) {
                const data = await res.json();
                const pages = data.query && data.query.pages;
                if (pages) {
                    const page = Object.values(pages)[0];
                    if (page.imageinfo && page.imageinfo[0]) {
                        const url = page.imageinfo[0].thumburl || page.imageinfo[0].url;
                        this.cache.set(cacheKey, url);
                        clearTimeout(timeout);
                        return url;
                    }
                }
            }
        } catch (e) { /* fallback */ }
        clearTimeout(timeout);

        this.cache.set(cacheKey, null);
        return null;
    }
};

window.WikipediaImage = WikipediaImage;