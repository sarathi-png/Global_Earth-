const WikipediaImage = {
    cache: new Map(),

    async getThumbnail(title, minWidth = 320) {
        if (!title) return null;
        const key = title.toLowerCase();
        if (this.cache.has(key)) return this.cache.get(key);

        const clean = title.replace(/\([^)]*\)/g, '').replace(/&/g, 'and').trim();
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}?redirect=true`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) {
                this.cache.set(key, null);
                return null;
            }
            const data = await res.json();
            const source = data.thumbnail && data.thumbnail.source ? data.thumbnail.source : null;
            this.cache.set(key, source);
            return source;
        } catch (e) {
            this.cache.set(key, null);
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }
};

window.WikipediaImage = WikipediaImage;