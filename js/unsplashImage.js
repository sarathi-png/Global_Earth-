const UnsplashImage = {
    cache: new Map(),
    async searchImage(query) {
        if (!query) return null;
        const key = query.toLowerCase();
        if (this.cache.has(key)) return this.cache.get(key);
        try {
            const res = await fetch(`/api/unsplash?query=${encodeURIComponent(query)}&per_page=3`);
            if (res.ok) {
                const data = await res.json();
                const url = data.results && data.results[0] && (data.results[0].urls.regular || data.results[0].urls.small);
                if (url) { this.cache.set(key, url); return url; }
            }
        } catch(e) {}
        // Static fallback: direct Unsplash API when ?unsplash_key= is supplied (else degrade silently).
        try {
            const params = new URLSearchParams(window.location.search);
            const ukey = params.get('unsplash_key');
            if (ukey && navigator.onLine) {
                const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`, {
                    headers: { 'Authorization': 'Client-ID ' + ukey }
                });
                if (res.ok) {
                    const data = await res.json();
                    const url = data.results && data.results[0] && (data.results[0].urls.regular || data.results[0].urls.small);
                    if (url) { this.cache.set(key, url); return url; }
                }
            }
        } catch(e) {}
        this.cache.set(key, null);
        return null;
    }
};
window.UnsplashImage = UnsplashImage;
