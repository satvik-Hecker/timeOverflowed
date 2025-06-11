document.addEventListener('DOMContentLoaded', () => {
    loadTodayData();
    document.getElementById('resetButton').addEventListener('click', resetTodayData);
    setupTabs();
    setupTrackingStatus();
});

function loadTodayData() {
    const dateKey = new Date().toISOString().slice(0, 10);
    
    chrome.storage.local.get([dateKey], (result) => {
        if (chrome.runtime.lastError) return;
        const data = result[dateKey] || {};
        updateUI(data);
    });
}

function updateUI(data) {
    const sitesList = document.getElementById('sitesList');
    const totalTimeElement = document.getElementById('totalTime');
    
    sitesList.innerHTML = '';
    
    let totalSeconds = 0;
    
    const sortedSites = Object.entries(data)
        .filter(([_, siteData]) => siteData.totalSeconds > 0)
        .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds);
    
    let othersSeconds = 0;
    sortedSites.forEach(([_, siteData], index) => {
        totalSeconds += siteData.totalSeconds;
        if (index >= 7) {
            othersSeconds += siteData.totalSeconds;
        }
    });
    
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    totalTimeElement.textContent = `${totalHours}h ${totalMinutes}m`;
    
    sortedSites.slice(0, 7).forEach(([domain, siteData], index) => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        
        const rank = document.createElement('div');
        rank.className = 'site-rank';
        rank.textContent = (index + 1).toString();
        siteItem.appendChild(rank);
        
        const siteInfo = document.createElement('div');
        siteInfo.className = 'site-info';
        
        const siteName = document.createElement('span');
        siteName.className = 'site-name';
        const displayName = domain.replace(/^www\./, '');
        siteName.textContent = displayName.length > 25 ? displayName.substring(0, 22) + '...' : displayName;
        siteName.title = displayName;
        
        const siteTime = document.createElement('span');
        siteTime.className = 'site-time';
        siteTime.textContent = siteData.display;
        
        siteInfo.appendChild(siteName);
        siteInfo.appendChild(siteTime);
        siteItem.appendChild(siteInfo);
        
        sitesList.appendChild(siteItem);
    });

    if (othersSeconds > 0) {
        const othersHeader = document.createElement('div');
        othersHeader.className = 'misc-header';
        othersHeader.textContent = 'Others';
        sitesList.appendChild(othersHeader);

        const othersItem = document.createElement('div');
        othersItem.className = 'site-item';
        
        const othersInfo = document.createElement('div');
        othersInfo.className = 'site-info';
        
        const othersName = document.createElement('span');
        othersName.className = 'site-name';
        othersName.textContent = 'Other Sites';
        
        const othersTime = document.createElement('span');
        othersTime.className = 'site-time';
        const othersHours = Math.floor(othersSeconds / 3600);
        const othersMinutes = Math.floor((othersSeconds % 3600) / 60);
        othersTime.textContent = `${othersHours}h ${othersMinutes}m`;
        
        othersInfo.appendChild(othersName);
        othersInfo.appendChild(othersTime);
        othersItem.appendChild(othersInfo);
        
        sitesList.appendChild(othersItem);
    }

    if (sortedSites.length === 0) {
        const noDataMessage = document.createElement('div');
        noDataMessage.className = 'no-data-message';
        noDataMessage.textContent = 'No tracking data for today';
        sitesList.appendChild(noDataMessage);
    }
}

function resetTodayData() {
    if (confirm('Are you sure you want to reset today\'s tracking data?')) {
        chrome.runtime.sendMessage({action: "resetToday"}, (response) => {
            if (chrome.runtime.lastError) return;
            if (response.success) {
                loadTodayData();
            }
        });
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const todayView = document.getElementById('todayView');
    const weeklyView = document.getElementById('weeklyView');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const tab = button.dataset.tab;
            if (tab === 'weekly') {
                todayView.style.display = 'none';
                weeklyView.style.display = 'flex';
                loadWeeklyData();
            } else {
                todayView.style.display = 'flex';
                weeklyView.style.display = 'none';
                loadTodayData();
            }
        });
    });
}

function loadWeeklyData() {
    const today = new Date();
    const dates = Array.from({length: 7}, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        return date.toISOString().slice(0, 10);
    }).reverse();

    chrome.storage.local.get(dates, (result) => {
        if (chrome.runtime.lastError) return;
        updateWeeklyView(result);
    });
}

function updateWeeklyView(storageData) {
    const weeklyAverage = document.getElementById('weeklyAverage');
    const weeklySitesList = document.getElementById('weeklySitesList');
    
    weeklySitesList.innerHTML = '';
    
    try {
        const data = {};
        let totalTime = 0;
        let daysWithData = 0;
        
        Object.entries(storageData).forEach(([dateKey, dateData]) => {
            if (dateData) {
                daysWithData++;
                Object.entries(dateData).forEach(([domain, info]) => {
                    if (!data[domain]) {
                        data[domain] = 0;
                    }
                    data[domain] += info.totalSeconds;
                    totalTime += info.totalSeconds;
                });
            }
        });
        
        const averageSeconds = daysWithData > 0 ? Math.floor(totalTime / daysWithData) : 0;
        const averageHours = Math.floor(averageSeconds / 3600);
        const averageMinutes = Math.floor((averageSeconds % 3600) / 60);
        weeklyAverage.textContent = `${averageHours}h ${averageMinutes}m`;
        
        const sortedDomains = Object.entries(data)
            .filter(([_, seconds]) => seconds > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
        
        sortedDomains.forEach(([domain, seconds]) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            
            const siteInfo = document.createElement('div');
            siteInfo.className = 'site-info';
            
            const siteName = document.createElement('div');
            siteName.className = 'site-name';
            const displayName = domain.replace(/^www\./, '');
            siteName.textContent = displayName.length > 25 ? displayName.substring(0, 22) + '...' : displayName;
            siteName.title = displayName;
            
            const siteTime = document.createElement('div');
            siteTime.className = 'site-time';
            siteTime.textContent = `${hours}h ${minutes}m`;
            
            siteInfo.appendChild(siteName);
            siteInfo.appendChild(siteTime);
            siteItem.appendChild(siteInfo);
            weeklySitesList.appendChild(siteItem);
        });

        if (sortedDomains.length === 0) {
            const noDataMessage = document.createElement('div');
            noDataMessage.className = 'no-data-message';
            noDataMessage.textContent = 'No tracking data for the past week';
            weeklySitesList.appendChild(noDataMessage);
        }
        
    } catch (error) {
        weeklySitesList.innerHTML = '<div class="error-message">Error loading weekly data</div>';
    }
}

function setupTrackingStatus() {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'trackingStatus';
    statusIndicator.className = 'tracking-status';
    document.body.insertBefore(statusIndicator, document.body.firstChild);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATUS_UPDATE') {
            updateTrackingStatus(message);
        }
    });
}

function updateTrackingStatus(status) {
    const indicator = document.getElementById('trackingStatus');
    if (!indicator) return;

    const isTracking = status.shouldTrack && status.isVisible && status.isFocused && status.isActive;
    indicator.className = `tracking-status ${isTracking ? 'active' : 'inactive'}`;
    indicator.title = `Tracking Status:
        Active: ${status.isActive ? 'Yes' : 'No'}
        Visible: ${status.isVisible ? 'Yes' : 'No'}
        Focused: ${status.isFocused ? 'Yes' : 'No'}
        Fullscreen: ${status.isFullscreen ? 'Yes' : 'No'}`;
} 