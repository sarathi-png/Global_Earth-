const NotificationSystem = {
    seenIds: new Set(),
    feedItems: [],
    maxFeedItems: 50,
    enabled: true,
    toastDuration: 8000,
    _lastCount: 0,

    init() {
        this.container = document.getElementById('toastContainer');
        this.feedPanel = document.getElementById('eventFeed');
        this.feedList = document.getElementById('eventFeedList');
        this.feedToggle = document.getElementById('feedToggle');
        this.feedBadge = document.getElementById('feedBadge');
        this.feedCount = document.getElementById('feedCount');

        if (this.feedToggle) {
            this.feedToggle.addEventListener('click', () => this.toggleFeed());
        }

        if ('Notification' in window && Notification.permission === 'default') {
            // Don't request yet, wait for user interaction
        }
    },

    processEvents(events) {
        if (!this.enabled || !events) return;
        var newEvents = events.filter(e => e && e.id && !this.seenIds.has(e.id));
        if (newEvents.length === 0) return;

        newEvents.forEach(e => this.seenIds.add(e.id));

        var critical = newEvents.filter(e => e.severity === 'Critical' || e.severity === 'High');
        var moderate = newEvents.filter(e => e.severity === 'Moderate');

        critical.forEach(e => this.showToast(e, 'critical'));
        if (moderate.length > 0 && moderate.length <= 3) {
            moderate.forEach(e => this.showToast(e, 'moderate'));
        } else if (moderate.length > 3) {
            this.showToast({
                title: moderate.length + ' new moderate events',
                category: 'Multiple',
                severity: 'Moderate',
                source: moderate[0].source
            }, 'moderate');
        }

        newEvents.forEach(e => this.addToFeed(e));
        this.updateBadge();
    },

    showToast(event, priority) {
        if (!this.container) return;
        var toast = document.createElement('div');
        toast.className = 'toast ' + (priority === 'critical' ? 'toast-critical' : 'toast-moderate');

        var iconMap = {
            'Earthquake': 'fa-house-crack', 'Flood': 'fa-water', 'Floods': 'fa-water',
            'Wildfire': 'fa-fire', 'Wildfires': 'fa-fire', 'Tropical Cyclone': 'fa-hurricane',
            'Cyclone': 'fa-hurricane', 'Volcano': 'fa-volcano', 'Volcanoes': 'fa-volcano',
            'Severe Weather': 'fa-cloud-bolt', 'Epidemic': 'fa-virus', 'Landslide': 'fa-mountain',
            'Drought': 'fa-sun', 'Disaster': 'fa-triangle-exclamation', 'Multiple': 'fa-layer-group'
        };
        var icon = iconMap[event.category] || 'fa-circle-exclamation';
        var sevColor = priority === 'critical' ? '#ff3b30' : '#ff9500';

        toast.innerHTML = '<div class="toast-icon"><i class="fas ' + icon + '"></i></div>' +
            '<div class="toast-body">' +
            '<div class="toast-title">' + this.esc(event.title) + '</div>' +
            '<div class="toast-meta">' +
            '<span class="toast-badge" style="background:' + sevColor + '">' + (event.severity || '') + '</span>' +
            '<span class="toast-source">' + this.esc(event.source || '') + '</span>' +
            '</div></div>' +
            '<button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';

        toast.addEventListener('click', function(ev) {
            if (ev.target.closest('.toast-close')) return;
            if (event.lat !== undefined && event.lng !== undefined) {
                CameraManager.flyToIncident(event.lat, event.lng);
            }
            toast.remove();
        });

        this.container.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('toast-show'); });

        var dur = priority === 'critical' ? this.toastDuration * 1.5 : this.toastDuration;
        setTimeout(function() {
            toast.classList.remove('toast-show');
            setTimeout(function() { toast.remove(); }, 400);
        }, dur);

        if (priority === 'critical' && 'Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('Global Earth Alert', {
                    body: event.title + ' (' + (event.source || '') + ')',
                    icon: 'assets/icons/icon-192.svg',
                    tag: event.id
                });
            } catch (e) {}
        }
    },

    addToFeed(event) {
        var item = {
            id: event.id, title: event.title, category: event.category,
            severity: event.severity, source: event.source,
            lat: event.lat, lng: event.lng,
            time: new Date()
        };
        this.feedItems.unshift(item);
        if (this.feedItems.length > this.maxFeedItems) this.feedItems.pop();
        this.renderFeedItem(item, true);
    },

    renderFeedItem(item, prepend) {
        if (!this.feedList) return;
        var iconMap = {
            'Earthquake': 'fa-house-crack', 'Flood': 'fa-water', 'Floods': 'fa-water',
            'Wildfire': 'fa-fire', 'Wildfires': 'fa-fire', 'Tropical Cyclone': 'fa-hurricane',
            'Cyclone': 'fa-hurricane', 'Volcano': 'fa-volcano', 'Volcanoes': 'fa-volcano',
            'Severe Weather': 'fa-cloud-bolt', 'Epidemic': 'fa-virus', 'Landslide': 'fa-mountain',
            'Drought': 'fa-sun', 'Disaster': 'fa-triangle-exclamation'
        };
        var icon = iconMap[item.category] || 'fa-circle-exclamation';
        var sevClass = (item.severity === 'Critical' || item.severity === 'High') ? 'feed-sev-high' :
                       item.severity === 'Moderate' ? 'feed-sev-moderate' : 'feed-sev-low';
        var timeStr = this.timeAgo(item.time);

        var el = document.createElement('div');
        el.className = 'feed-item';
        el.innerHTML = '<div class="feed-icon ' + sevClass + '"><i class="fas ' + icon + '"></i></div>' +
            '<div class="feed-info">' +
            '<div class="feed-title">' + this.esc(item.title) + '</div>' +
            '<div class="feed-meta">' + this.esc(item.source || '') + ' &middot; ' + timeStr + '</div>' +
            '</div>';

        el.addEventListener('click', function() {
            if (item.lat !== undefined && item.lng !== undefined) {
                CameraManager.flyToIncident(item.lat, item.lng);
            }
        });

        if (prepend) {
            this.feedList.insertBefore(el, this.feedList.firstChild);
        } else {
            this.feedList.appendChild(el);
        }
    },

    renderFullFeed() {
        if (!this.feedList) return;
        this.feedList.innerHTML = '';
        this.feedItems.forEach(item => this.renderFeedItem(item, false));
    },

    async toggleFeed() {
        if (!this.feedPanel) return;
        var isOpen = this.feedPanel.classList.toggle('feed-open');
        if (isOpen) {
            // If opened and we have no feed items yet, fetch live data (user asked: keep toggle + map live data)
            if (this.feedItems.length === 0) {
                try {
                    // Prefer already-fetched LiveLayer data if available
                    if (typeof LiveLayer !== 'undefined' && Array.isArray(LiveLayer._lastEvents) && LiveLayer._lastEvents.length) {
                        this.processEvents(LiveLayer._lastEvents);
                    } else if (typeof LiveApi !== 'undefined' && LiveApi.fetchAll) {
                        if (navigator.onLine) {
                            // Show loading placeholder
                            if (this.feedList) this.feedList.innerHTML = '<div style="padding:16px;color:#888;text-align:center;">Loading live events…</div>';
                            const { events } = await LiveApi.fetchAll();
                            if (events && events.length) {
                                if (typeof LiveLayer !== 'undefined') LiveLayer._lastEvents = events;
                                // Clear placeholder before processing (renderFeedItem will populate)
                                if (this.feedList) this.feedList.innerHTML = '';
                                this.processEvents(events);
                            } else {
                                if (this.feedList) this.feedList.innerHTML = '<div style="padding:16px;color:#888;text-align:center;">No recent live events — check connection or try again.</div>';
                            }
                        }
                    }
                } catch (e) { console.warn('feed live fetch failed', e); }
            }
            this.renderFullFeed();
            // Hide badge when feed is opened (do NOT overwrite feedBadge DOM ref)
            if (this.feedBadge && this.feedBadge.style) this.feedBadge.style.display = 'none';
            if (this.feedCount) this.feedCount.textContent = this.feedItems.length;
        }
    },

    updateBadge() {
        var count = this.feedItems.length;
        if (this.feedBadge) {
            this.feedBadge.textContent = count > 99 ? '99+' : count;
            this.feedBadge.style.display = count > 0 ? 'flex' : 'none';
        }
        if (this.feedCount) {
            this.feedCount.textContent = count;
        }
    },

    timeAgo(date) {
        var secs = Math.floor((Date.now() - date.getTime()) / 1000);
        if (secs < 60) return 'just now';
        if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
        if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
        return Math.floor(secs / 86400) + 'd ago';
    },

    esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
};

window.NotificationSystem = NotificationSystem;
