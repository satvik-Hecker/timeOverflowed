document.addEventListener('DOMContentLoaded', () => {
    // Load today's data
    loadTodayData();

    // Set up reset button
    document.getElementById('resetButton').addEventListener('click', resetTodayData);

    // Set up tabs
    setupTabs();
});

function loadTodayData() {
    const dateKey = new Date().toISOString().slice(0,10);
    
    chrome.storage.local.get([dateKey], (result) => {
        const data = result[dateKey] || {};
        updateUI(data);
    });
}

function updateUI(data) {
    const sitesList = document.getElementById('sitesList');
    const totalTimeElement = document.getElementById('totalTime');
    
    // Clear existing content
    sitesList.innerHTML = '';
    
    let totalSeconds = 0;
    
    // Sort sites by time spent (descending)
    const sortedSites = Object.entries(data).sort((a, b) => 
        b[1].totalSeconds - a[1].totalSeconds
    );
    
    // Update total time
    sortedSites.forEach(([_, siteData]) => {
        totalSeconds += siteData.totalSeconds;
    });
    
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    totalTimeElement.textContent = `${totalHours}h ${totalMinutes}m`;
    
    // Update sites list
    sortedSites.forEach(([domain, siteData], index) => {
        // Add miscellaneous header after top 7 sites
        if (index === 7) {
            const miscHeader = document.createElement('div');
            miscHeader.className = 'misc-header';
            miscHeader.textContent = 'Miscellaneous';
            sitesList.appendChild(miscHeader);
        }
        
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        
        // Add rank
        const rank = document.createElement('div');
        rank.className = 'site-rank';
        rank.textContent = (index + 1).toString();
        siteItem.appendChild(rank);
        
        // Create site info container
        const siteInfo = document.createElement('div');
        siteInfo.className = 'site-info';
        
        const siteName = document.createElement('span');
        siteName.className = 'site-name';
        // Remove 'www.' from domain
        siteName.textContent = domain.replace(/^www\./, '');
        
        const siteTime = document.createElement('span');
        siteTime.className = 'site-time';
        siteTime.textContent = siteData.display;
        
        siteInfo.appendChild(siteName);
        siteInfo.appendChild(siteTime);
        siteItem.appendChild(siteInfo);
        
        sitesList.appendChild(siteItem);
    });
}

function resetTodayData() {
    if (confirm('Are you sure you want to reset today\'s tracking data?')) {
        chrome.runtime.sendMessage({action: "resetToday"}, (response) => {
            if (response.success) {
                loadTodayData(); // Reload the data
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
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
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
    // Get the last 7 days
    const today = new Date();
    const dates = Array.from({length: 7}, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        return date.toISOString().slice(0,10);
    }).reverse();

    // Get data for all dates
    chrome.storage.local.get(dates, (result) => {
        updateWeeklyView();
    });
}

// Function to update weekly view
async function updateWeeklyView() {
    const weeklyAverage = document.getElementById('weeklyAverage');
    const weeklySitesList = document.getElementById('weeklySitesList');
    
    // Clear previous content
    weeklySitesList.innerHTML = '';
    
    try {
        // Get data for the last 7 days
        const today = new Date();
        const data = {};
        let totalTime = 0;
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateKey = date.toISOString().slice(0, 10);
            
            const result = await chrome.storage.local.get([dateKey]);
            if (result[dateKey]) {
                Object.entries(result[dateKey]).forEach(([domain, info]) => {
                    if (!data[domain]) {
                        data[domain] = 0;
                    }
                    data[domain] += info.totalSeconds;
                    totalTime += info.totalSeconds;
                });
            }
        }
        
        // Calculate average daily time
        const averageSeconds = Math.floor(totalTime / 7);
        const averageHours = Math.floor(averageSeconds / 3600);
        const averageMinutes = Math.floor((averageSeconds % 3600) / 60);
        weeklyAverage.textContent = `${averageHours}h ${averageMinutes}m`;
        
        // Sort domains by time spent
        const sortedDomains = Object.entries(data)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5); // Top 5 domains
        
        // Add to weekly sites list
        sortedDomains.forEach(([domain, seconds]) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            siteItem.innerHTML = `
                <div class="site-info">
                    <div class="site-name">${domain}</div>
                    <div class="site-time">${hours}h ${minutes}m</div>
                </div>
            `;
            weeklySitesList.appendChild(siteItem);
        });
        
    } catch (error) {
        console.error('Error updating weekly view:', error);
    }
}

// Update the weekly view when tab is clicked
document.querySelector('[data-tab="weekly"]').addEventListener('click', () => {
    updateWeeklyView();
}); 