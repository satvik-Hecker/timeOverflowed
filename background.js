// Enhanced background.js for accurate time tracking
let activeTab = null;
let activeDomain = null;
let startTime = null;
let isTrackingPaused = false;
let lastPeriodicCheck = Date.now();

// Debug logging utility
const DEBUG = {
    log: () => {},
    error: () => {},
    warn: () => {},
    time: () => {},
    focus: () => {},
    fullscreen: () => {},
    tracking: () => {}
};

DEBUG.log('Background script initialized');

// Initialize state from storage
async function initializeState() {
    try {
        const result = await chrome.storage.local.get(['activeTabId', 'activeDomain', 'startTime']);
        if (result.activeTabId && result.activeDomain && result.startTime) {
            activeTab = result.activeTabId;
            activeDomain = result.activeDomain;
            startTime = result.startTime;
            DEBUG.log('Restored state:', { activeTabId: activeTab, activeDomain, startTime: new Date(startTime).toLocaleTimeString() });
        } else {
            DEBUG.log('No saved state found');
        }
    } catch (error) {
        DEBUG.error('Error initializing state:', error);
    }
}

// Save current state to storage
async function saveState() {
    try {
        await chrome.storage.local.set({
            activeTabId: activeTab,
            activeDomain,
            startTime
        });
        DEBUG.log('State saved:', { activeTabId: activeTab, activeDomain, startTime: new Date(startTime).toLocaleTimeString() });
    } catch (error) {
        DEBUG.error('Error saving state:', error);
    }
}

// Clear tracking state
async function clearState() {
    try {
        await chrome.storage.local.remove(['activeTabId', 'activeDomain', 'startTime']);
        activeTab = null;
        activeDomain = null;
        startTime = null;
        isTrackingPaused = false;
        DEBUG.log('State cleared');
    } catch (error) {
        DEBUG.error('Error clearing state:', error);
    }
}

// Enhanced domain extraction with better validation
function getDomain(url) {
    try {
        if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || 
            url.startsWith('brave://') || url.startsWith('edge://') || url.startsWith('about:') ||
            url.startsWith('moz-extension://') || url.startsWith('safari-extension://')) {
            DEBUG.log('Invalid URL for domain extraction:', { url });
            return null;
        }
        const domain = new URL(url).hostname;
        DEBUG.log('Domain extracted:', { url, domain });
        return domain;
    } catch (error) {
        DEBUG.error('Failed to extract domain from URL:', { url, error });
        return null;
    }
}

// Improved saveTime function with better validation
async function saveTime(domain, seconds) {
    if (!domain || seconds < 1) {
        DEBUG.log(`Skipping save for ${domain}: Time spent (${seconds}s) is too small`);
        return;
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    DEBUG.log(`Saving time for ${domain} on ${dateKey}: ${seconds} seconds`);

    try {
        const result = await chrome.storage.local.get([dateKey]);
        const data = result[dateKey] || {};

        const prevSeconds = data[domain]?.totalSeconds || 0;
        const newTotal = prevSeconds + seconds;
        const hours = Math.floor(newTotal / 3600);
        const minutes = Math.floor((newTotal % 3600) / 60);

        data[domain] = {
            totalSeconds: newTotal,
            display: `${hours}h ${minutes}m`,
            lastUpdated: Date.now()
        };

        DEBUG.log(`Updated time for ${domain}:`, {
            previous: prevSeconds,
            added: seconds,
            total: newTotal,
            formatted: `${hours}h ${minutes}m`
        });
        
        await chrome.storage.local.set({ [dateKey]: data });
        DEBUG.log('Storage updated successfully');
    } catch (error) {
        DEBUG.error('Error saving time:', error);
    }
}

// Simplified tab switch handler
async function handleTabSwitch(tabId, tab) {
    const newDomain = tab.url ? getDomain(tab.url) : null;
    
    DEBUG.log('Tab switch:', {
        tabId,
        newDomain,
        currentDomain: activeDomain,
        isActive: tab.active,
        url: tab.url
    });

    // Save time for previous domain
    if (activeDomain && startTime && !isTrackingPaused) {
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);
        DEBUG.log(`Saving time on tab switch: ${activeDomain} - ${timeSpent}s`);
        await saveTime(activeDomain, timeSpent);
    }

    // Update to new domain
    if (newDomain && tab.active) {
        activeTab = tabId;
        activeDomain = newDomain;
        startTime = Date.now();
        isTrackingPaused = false;
        await saveState();
        DEBUG.log(`Started tracking: ${activeDomain}`);
    } else {
        await clearState();
        DEBUG.log('Cleared tracking state');
    }
}

// Pause tracking without clearing domain
async function pauseTracking(reason = 'unknown') {
    if (activeDomain && startTime && !isTrackingPaused) {
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);
        DEBUG.tracking('Pausing', {
            reason,
            domain: activeDomain,
            timeSpent,
            status: 'Paused'
        });
        await saveTime(activeDomain, timeSpent);
        isTrackingPaused = true;
        startTime = null;
        await saveState();
    }
}

// Resume tracking for current domain
async function resumeTracking(reason = 'unknown') {
    if (activeDomain && isTrackingPaused) {
        DEBUG.tracking('Resuming', {
            reason,
            domain: activeDomain,
            status: 'Active'
        });
        startTime = Date.now();
        isTrackingPaused = false;
        await saveState();
    }
}

// Chrome API event listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.startsWith('http')) {
            activeTab = tab;
            updateTrackingStatus();
        }
    } catch (error) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        activeTab = tab;
        updateTrackingStatus();
    }
});

// Simplified window focus handler
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        DEBUG.focus('Window focus lost');
        pauseTracking();
    } else {
        DEBUG.focus('Window focus gained');
        resumeTracking();
    }
});

// Enhanced message listener for content script integration
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FULLSCREEN_CHANGE') {
        DEBUG.fullscreen('Fullscreen changed:', message.isFullscreen);
        updateTrackingStatus();
    } else if (message.type === 'STATUS_UPDATE') {
        DEBUG.tracking('Status update received:', message);
        updateTrackingStatus();
    } else if (message.action === 'resetToday') {
        resetTodayData(sendResponse);
        return true;
    }
});

function updateTrackingStatus() {
    if (!activeTab) return;
    const domain = new URL(activeTab.url).hostname;
    const dateKey = new Date().toISOString().slice(0, 10);
    
    chrome.storage.local.get([dateKey], (result) => {
        if (chrome.runtime.lastError) return;
        const data = result[dateKey] || {};
        const siteData = data[domain] || { totalSeconds: 0, lastUpdate: Date.now() };
        
        const timeSpent = siteData.totalSeconds;
        const hours = Math.floor(timeSpent / 3600);
        const minutes = Math.floor((timeSpent % 3600) / 60);
        
        DEBUG.time('Time spent on', domain, ':', `${hours}h ${minutes}m`);
        
        if (Date.now() - lastPeriodicCheck >= 30000) {
            lastPeriodicCheck = Date.now();
            DEBUG.time('Periodic check - Time spent on', domain, ':', `${hours}h ${minutes}m`);
        }
    });
}

function pauseTracking() {
    if (!activeTab) return;
    const domain = new URL(activeTab.url).hostname;
    const dateKey = new Date().toISOString().slice(0, 10);
    
    chrome.storage.local.get([dateKey], (result) => {
        if (chrome.runtime.lastError) return;
        const data = result[dateKey] || {};
        const siteData = data[domain] || { totalSeconds: 0, lastUpdate: Date.now() };
        
        const now = Date.now();
        const timeDiff = Math.floor((now - siteData.lastUpdate) / 1000);
        siteData.totalSeconds += timeDiff;
        siteData.lastUpdate = now;
        
        data[domain] = siteData;
        chrome.storage.local.set({ [dateKey]: data });
        
        DEBUG.tracking('Tracking paused for', domain, '- Total time:', siteData.totalSeconds);
    });
}

function resumeTracking() {
    if (!activeTab) return;
    const domain = new URL(activeTab.url).hostname;
    const dateKey = new Date().toISOString().slice(0, 10);
    
    chrome.storage.local.get([dateKey], (result) => {
        if (chrome.runtime.lastError) return;
        const data = result[dateKey] || {};
        const siteData = data[domain] || { totalSeconds: 0, lastUpdate: Date.now() };
        siteData.lastUpdate = Date.now();
        
        data[domain] = siteData;
        chrome.storage.local.set({ [dateKey]: data });
        
        DEBUG.tracking('Tracking resumed for', domain);
    });
}

function resetTodayData(sendResponse) {
    const dateKey = new Date().toISOString().slice(0, 10);
    chrome.storage.local.remove([dateKey], () => {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false });
            return;
        }
        sendResponse({ success: true });
    });
}

// Cleanup and alarm functions
function cleanupOldData() {
    DEBUG.log('Running cleanup for old data...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) return;
        
        const keysToRemove = Object.keys(items).filter(key => {
            const date = new Date(key);
            return date < thirtyDaysAgo;
        });
        
        if (keysToRemove.length > 0) {
            DEBUG.log('Removing old data:', keysToRemove);
            chrome.storage.local.remove(keysToRemove);
        } else {
            DEBUG.log('No old data to clean up');
        }
    });
}

// Runtime event listeners
chrome.runtime.onStartup.addListener(initializeState);
chrome.runtime.onInstalled.addListener(() => {
    DEBUG.log('Extension installed/updated');
    initializeState();
    cleanupOldData();
});

// Alarm setup
chrome.alarms.create('cleanupOldData', { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupOldData') {
        cleanupOldData();
    }
});

// Initialize on script load
initializeState();
