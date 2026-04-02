const SearchUI = {
    init() {
        const input = document.getElementById('globalSearch');
        const resultsBox = document.getElementById('searchResults');

        if (!input || !resultsBox) return;

        input.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.length < 2) {
                resultsBox.classList.add('hidden');
                return;
            }

            const results = SearchEngine.search(query);
            this.renderResults(results);
        });

        // Hide results on click outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
                resultsBox.classList.add('hidden');
            }
        });
    },

    renderResults(results) {
        const resultsBox = document.getElementById('searchResults');
        if (!resultsBox) return;
        resultsBox.innerHTML = '';
        
        if (results.length === 0) {
            resultsBox.innerHTML = '<div class="search-result-item">No records found.</div>';
        } else {
            results.forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                const safeTitle = String(item.title).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const safeYear = String(item.year).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const safeCountry = String(item.country).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                div.innerHTML = `
                    <div class="result-icon ${item.type}"><i class="fas ${this.getIcon(item.type)}"></i></div>
                    <div class="result-info">
                        <div class="result-title">${safeTitle}</div>
                        <div class="result-meta">${safeYear} | ${safeCountry}</div>
                    </div>
                `;
                div.addEventListener('click', () => {
                    this.handleResultClick(item);
                });
                resultsBox.appendChild(div);
            });
        }
        
        resultsBox.classList.remove('hidden');
    },

    getIcon(type) {
        switch(type) {
            case 'disaster': return 'fa-house-damage';
            case 'war': return 'fa-shield-alt';
            case 'mystery': return 'fa-question-circle';
            case 'history': return 'fa-history';
            default: return 'fa-info-circle';
        }
    },

    handleResultClick(item) {
        if (typeof CameraManager !== 'undefined' && CameraManager.flyTo) {
            CameraManager.flyTo(item.lat, item.lng, 1000000);
        }
        if (item.entity && typeof ControlManager !== 'undefined' && ControlManager.onClick) {
            ControlManager.onClick(item.entity);
        }
        const resultsBox = document.getElementById('searchResults');
        const searchInput = document.getElementById('globalSearch');
        if (resultsBox) resultsBox.classList.add('hidden');
        if (searchInput) searchInput.value = item.title;
    }
};
