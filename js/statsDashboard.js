const StatsDashboard = {
    _timer: null,
    _lastData: null,

    init() {
        this._timer = setInterval(() => this.update(), 10000);
        this.update();
    },

    update() {
        if (typeof LiveLayer === 'undefined' || !LiveLayer._lastEvents) return;
        var events = LiveLayer._lastEvents;
        this._lastData = events;
        this.renderSidebarStats(events);
    },

    renderSidebarStats(events) {
        var container = document.getElementById('liveStats');
        if (!container) return;

        var bySource = {};
        var byCategory = {};
        var bySeverity = { Critical: 0, High: 0, Moderate: 0, Minor: 0 };

        events.forEach(function(e) {
            var src = e.source || 'Unknown';
            bySource[src] = (bySource[src] || 0) + 1;
            var cat = e.category || 'Unknown';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
            var sev = e.severity || 'Minor';
            bySeverity[sev] = (bySeverity[sev] || 0) + 1;
        });

        var html = '<div class="stats-grid">';
        html += '<div class="stat-card stat-total"><div class="stat-number">' + events.length + '</div><div class="stat-label">Total Events</div></div>';
        html += '<div class="stat-card stat-critical"><div class="stat-number">' + (bySeverity.Critical || 0) + '</div><div class="stat-label">Critical</div></div>';
        html += '<div class="stat-card stat-high"><div class="stat-number">' + (bySeverity.High || 0) + '</div><div class="stat-label">High</div></div>';
        html += '<div class="stat-card stat-moderate"><div class="stat-number">' + (bySeverity.Moderate || 0) + '</div><div class="stat-label">Moderate</div></div>';
        html += '</div>';

        html += '<div class="stats-section"><h4>Sources</h4>';
        var srcEntries = Object.entries(bySource).sort(function(a, b) { return b[1] - a[1]; });
        srcEntries.forEach(function(entry) {
            var pct = events.length > 0 ? Math.round(entry[1] / events.length * 100) : 0;
            html += '<div class="stats-bar-row"><span class="stats-bar-label">' + entry[0] + '</span>';
            html += '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div>';
            html += '<span class="stats-bar-value">' + entry[1] + '</span></div>';
        });
        html += '</div>';

        html += '<div class="stats-section"><h4>Categories</h4>';
        var catEntries = Object.entries(byCategory).sort(function(a, b) { return b[1] - a[1]; });
        catEntries.slice(0, 8).forEach(function(entry) {
            var pct = events.length > 0 ? Math.round(entry[1] / events.length * 100) : 0;
            html += '<div class="stats-bar-row"><span class="stats-bar-label">' + entry[0] + '</span>';
            html += '<div class="stats-bar-track"><div class="stats-bar-fill cat-fill" style="width:' + pct + '%"></div></div>';
            html += '<span class="stats-bar-value">' + entry[1] + '</span></div>';
        });
        html += '</div>';

        container.innerHTML = html;
    },

    destroy() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }
};

window.StatsDashboard = StatsDashboard;
