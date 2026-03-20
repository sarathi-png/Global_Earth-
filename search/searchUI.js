const SearchUI = {
    init() {
        const input = document.getElementById('globalSearch');
        const resultsBox = document.getElementById('searchResults');

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
        resultsBox.innerHTML = '';
        
        if (results.length === 0) {
            resultsBox.innerHTML = '<div class="search-result-item">No records found.</div>';
        } else {
            results.forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `
                    <div class="result-icon ${item.type}"><i class="fas ${this.getIcon(item.type)}"></i></div>
                    <div class="result-info">
                        <div class="result-title">${item.title}</div>
                        <div class="result-meta">${item.year} | ${item.country}</div>
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
        CameraManager.flyTo(item.lat, item.lng, 1000000);
        ControlManager.onClick(item.entity);
        document.getElementById('searchResults').classList.add('hidden');
        document.getElementById('globalSearch').value = item.title;
    }
};
