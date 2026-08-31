const UnsplashImage = {
    cache: new Map(),
    async searchImage(query) {
        if (!query) return null;
        const key = query.toLowerCase();
        if (this.cache.has(key)) return this.cache.get(key);
        try {
            const res = await fetch(`/api/unsplash?query=${encodeURIComponent(query)}&per_page=3`);
            if (!res.ok) { this.cache.set(key, null); return null; }
            const data = await res.json();
            const url = data.results && data.results[0] && (data.results[0].urls.regular || data.results[0].urls.small);
            if (url) { this.cache.set(key, url); return url; }
        } catch(e) {}
        this.cache.set(key, null);
        return null;
    }
};
window.UnsplashImage = UnsplashImage;
