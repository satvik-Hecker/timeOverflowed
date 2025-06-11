let activeTabId = null;
let activeDomain = null;
let startTime = null;

console.log('Background script initialized');

// Initialize state from storage on startup
async function initializeState() {
    try {
        const result = await chrome.storage.local.get(['activeTabId', 'activeDomain', 'startTime']);
        if (result.activeTabId && result.activeDomain && result.startTime) {
            activeTabId = result.activeTabId;
            activeDomain = result.activeDomain;
            startTime = result.startTime;
            console.log('Restored state:', { activeTabId, activeDomain, startTime });
        }
    } catch (error) {
        console.error('Error initializing state:', error);
    }
}

// Save current state to storage
async function saveState() {
    try {
        await chrome.storage.local.set({
            activeTabId,
            activeDomain,
            startTime
        });
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Clear state from storage
async function clearState() {
    try {
        await chrome.storage.local.remove(['activeTabId', 'activeDomain', 'startTime']);
    } catch (error) {
        console.error('Error clearing state:', error);
    }
}

//to get domain name from full url
function getDomain(url){
    try{
        if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('brave://') || url.startsWith('edge://') || url.startsWith('about:')) {
            return null;
        }
        const domain = new URL(url).hostname;
        console.log('Extracted domain:', domain);
        return domain;
    } catch {
        console.log('Failed to extract domain from URL:', url);
        return null;
    }
}

// Clean up data older than 7 days
function cleanupOldData() {
    console.log('Running cleanup for old data...');
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    chrome.storage.local.get(null, (items) => {
        console.log('Current storage data:', items);
        const keysToRemove = [];
        for (const key in items) {
            // Check if the key is a date (YYYY-MM-DD format)
            if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
                const keyDate = new Date(key);
                if (keyDate < sevenDaysAgo) {
                    keysToRemove.push(key);
                }
            }
        }
        
        if (keysToRemove.length > 0) {
            console.log('Removing old data for dates:', keysToRemove);
            chrome.storage.local.remove(keysToRemove);
        } else {
            console.log('No old data to clean up');
        }
    });
}

// Reset today's tracking data
function resetTodayData() {
    const dateKey = new Date().toISOString().slice(0,10);
    console.log('Resetting data for date:', dateKey);
    chrome.storage.local.get([dateKey], (result) => {
        console.log('Data before reset:', result[dateKey]);
        chrome.storage.local.remove(dateKey, () => {
            console.log('Data reset complete');
        });
    });
}

async function saveTime(domain, seconds){
    if(!domain || seconds < 1){
        console.log(`Skipping save for ${domain}: Time spent (${seconds}s) is too small`);
        return;
    }

    const dateKey = new Date().toISOString().slice(0,10);
    console.log(`Saving time for ${domain} on ${dateKey}: ${seconds} seconds`);

    try {
        const result = await chrome.storage.local.get([dateKey]);
        console.log('Current data for', dateKey, ':', result[dateKey]);
        const data = result[dateKey] || {};

        const prevSeconds = data[domain]?.totalSeconds || 0;
        const newTotal = prevSeconds + seconds;
        const hours = Math.floor(newTotal/3600);
        const minutes = Math.floor((newTotal%3600)/60);    

        data[domain] = {
            totalSeconds: newTotal,
            display: `${hours}h ${minutes}m`
        };

        console.log(`Updated time for ${domain}:`);
        console.log(`- Previous time: ${prevSeconds} seconds`);
        console.log(`- New time added: ${seconds} seconds`);
        console.log(`- Total time: ${newTotal} seconds (${hours}h ${minutes}m)`);
        
        await chrome.storage.local.set({[dateKey] : data });
        console.log('Storage updated successfully');
        
        // Verify the update
        const verify = await chrome.storage.local.get([dateKey]);
        console.log('Verification - Current data:', verify[dateKey]);
    } catch (error) {
        console.error('Error saving time:', error);
    }
}

async function handleTabSwitch(tabId, changeInfo, tab){
    const newDomain = tab.url ? getDomain(tab.url) : null;
    
    console.log('handleTabSwitch called:', {
        tabId,
        newDomain,
        currentActiveDomain: activeDomain,
        tabActive: tab.active,
        changeStatus: changeInfo?.status
    });

    // Always save time for the previous domain if it exists
    if(activeDomain && startTime){
        const timeSpent = Math.floor((Date.now()- startTime)/1000);
        console.log(`Tab switch detected:`);
        console.log(`- Previous domain: ${activeDomain}`);
        console.log(`- Time spent: ${timeSpent} seconds`);
        console.log(`- Start time: ${new Date(startTime).toLocaleTimeString()}`);
        console.log(`- End time: ${new Date().toLocaleTimeString()}`);
        await saveTime(activeDomain, timeSpent);
    }

    // Update current domain and start time
    if (newDomain) {
        activeTabId = tabId;
        activeDomain = newDomain;
        startTime = Date.now();
        await saveState();
        console.log(`Switched to new domain: ${activeDomain}`);
        console.log(`New start time: ${new Date(startTime).toLocaleTimeString()}`);
    } else {
        // Clear tracking for invalid domains
        activeTabId = null;
        activeDomain = null;
        startTime = null;
        await clearState();
        console.log('Cleared tracking for invalid domain');
    }
}

chrome.tabs.onActivated.addListener(async ({tabId}) => {
    console.log('Tab activated:', tabId);
    try {
        const tab = await chrome.tabs.get(tabId);
        console.log('Tab details:', {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            active: tab.active
        });
        await handleTabSwitch(tabId, {} , tab);
    } catch (error) {
        console.error('Error in onActivated:', error);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Handle URL changes and fullscreen changes
    if (tab.active && (changeInfo.url || changeInfo.status === 'complete' || changeInfo.fullscreen !== undefined)) {
        console.log('Tab updated:', {
            id: tabId,
            status: changeInfo.status,
            url: tab.url,
            title: tab.title,
            urlChanged: !!changeInfo.url,
            fullscreen: changeInfo.fullscreen,
            timestamp: new Date().toISOString()
        });
        
        // If it's the same domain and tab, keep tracking even in fullscreen
        if (changeInfo.fullscreen !== undefined && tab.id === activeTabId) {
            const domain = getDomain(tab.url);
            if (domain === activeDomain) {
                console.log('Fullscreen state changed:', {
                    isFullscreen: changeInfo.fullscreen,
                    domain: activeDomain,
                    timeElapsed: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
                    timestamp: new Date().toISOString()
                });
                return;
            }
        }
        
        await handleTabSwitch(tabId, changeInfo, tab);
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    console.log('Window focus changed:', {
        windowId,
        timestamp: new Date().toISOString(),
        currentState: {
            activeTabId,
            activeDomain,
            startTime: startTime ? new Date(startTime).toISOString() : null
        }
    });
    
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Window lost focus
        console.log('Window focus lost - Checking fullscreen state...');
        try {
            // Check if the window is in fullscreen mode
            const tabs = await chrome.tabs.query({ active: true });
            console.log('Active tabs found:', tabs.length);
            
            if (tabs.length > 0) {
                const tab = tabs[0];
                const tabDetails = await chrome.tabs.get(tab.id);
                console.log('Active tab details:', {
                    id: tab.id,
                    url: tab.url,
                    title: tab.title,
                    fullscreen: tabDetails.fullscreen,
                    active: tab.active,
                    windowId: tab.windowId
                });
                
                if (tabDetails.fullscreen && tab.id === activeTabId) {
                    console.log('Continuing tracking because:', {
                        isFullscreen: true,
                        sameTab: tab.id === activeTabId,
                        currentDomain: activeDomain,
                        timeElapsed: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
                    });
                    return;
                } else {
                    console.log('Not continuing tracking because:', {
                        isFullscreen: tabDetails.fullscreen,
                        sameTab: tab.id === activeTabId,
                        reason: !tabDetails.fullscreen ? 'Not in fullscreen' : 'Different tab'
                    });
                }
            }
            
            // If not fullscreen or different tab, save and clear state
            if (activeDomain && startTime) {
                const timeSpent = Math.floor((Date.now() - startTime) / 1000);
                console.log(`Saving time before window focus loss:`, {
                    domain: activeDomain,
                    timeSpent,
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date().toISOString(),
                    formattedTime: `${Math.floor(timeSpent / 3600)}h ${Math.floor((timeSpent % 3600) / 60)}m`
                });
                await saveTime(activeDomain, timeSpent);
                activeDomain = null;
                startTime = null;
                activeTabId = null;
                await clearState();
                console.log('Tracking state cleared');
            }
        } catch (error) {
            console.error('Error in window focus handling:', {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
    } else {
        // Window gained focus
        console.log('Window focus gained - Starting new tracking session');
        try {
            const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
            console.log('Active tabs in focused window:', tabs.length);
            
            if (tabs.length > 0) {
                const tab = tabs[0];
                const domain = getDomain(tab.url);
                console.log('Focused tab details:', {
                    id: tab.id,
                    url: tab.url,
                    domain,
                    title: tab.title,
                    windowId: tab.windowId
                });
                
                if (domain) {
                    // Start tracking new domain
                    activeTabId = tab.id;
                    activeDomain = domain;
                    startTime = Date.now();
                    await saveState();
                    console.log(`Started new tracking session:`, {
                        domain: activeDomain,
                        tabId: activeTabId,
                        startTime: new Date(startTime).toISOString(),
                        previousState: {
                            hadActiveDomain: !!activeDomain,
                            hadStartTime: !!startTime
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error starting new tracking session:', {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// Handle service worker wake-up
chrome.runtime.onStartup.addListener(async () => {
    console.log('Extension startup');
    await initializeState();
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed/updated');
    await initializeState();
    cleanupOldData();
});

// Add message listener for reset command
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "resetToday") {
        console.log('Reset command received');
        resetTodayData();
        sendResponse({success: true});
        return true; // Keep message channel open for async response
    }
});

// Periodic save to prevent data loss
setInterval(async () => {
    if (activeDomain && startTime) {
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);
        console.log(`Periodic save for ${activeDomain}: ${timeSpent} seconds`);
        await saveTime(activeDomain, timeSpent);
        startTime = Date.now(); // Reset start time after saving
        await saveState();
    }
}, 60000); // Every 60 seconds

// Run cleanup on Sundays at 12 PM
chrome.alarms.create('cleanupAlarm', {
    when: getNextSundayNoon()
});

function getNextSundayNoon() {
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay())); // Move to next Sunday
    nextSunday.setHours(12, 0, 0, 0); // Set to 12 PM
    
    // If we're already past 12 PM on Sunday, schedule for next week
    if (now.getDay() === 0 && now.getHours() >= 12) {
        nextSunday.setDate(nextSunday.getDate() + 7);
    }
    
    return nextSunday.getTime();
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupAlarm') {
        console.log('Cleanup alarm triggered');
        cleanupOldData();
        // Schedule next cleanup
        chrome.alarms.create('cleanupAlarm', {
            when: getNextSundayNoon()
        });
    }
});

// Add periodic check for fullscreen tracking status
setInterval(async () => {
    if (activeDomain && startTime) {
        try {
            const tabs = await chrome.tabs.query({ active: true });
            if (tabs.length > 0) {
                const tab = tabs[0];
                const tabDetails = await chrome.tabs.get(tab.id);
                if (tabDetails.fullscreen && tab.id === activeTabId) {
                    const timeElapsed = Math.floor((Date.now() - startTime) / 1000);
                    console.log('Fullscreen tracking status:', {
                        isFullscreen: true,
                        domain: activeDomain,
                        timeElapsed,
                        formattedTime: `${Math.floor(timeElapsed / 3600)}h ${Math.floor((timeElapsed % 3600) / 60)}m`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error('Error checking fullscreen tracking status:', {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
    }
}, 30000); // Check every 30 seconds

// Initialize on script load
initializeState();