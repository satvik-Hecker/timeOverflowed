// content.js - Optimized for background.js integration
const DEBUG = {
    log: () => {},
    error: () => {},
    warn: () => {},
    time: () => {},
    focus: () => {},
    fullscreen: () => {},
    visibility: () => {},
    activity: () => {},
    status: () => {}
};

class TimeTrackingContent {
    constructor() {
        this.domain = window.location.hostname;
        this.lastActivityTime = Date.now();
        this.isUserActive = true;
        this.isVisible = true;
        this.isFocused = true;
        this.isFullscreen = false;
        this.lastStatusUpdate = Date.now();
        this.lastPeriodicCheck = Date.now();
        
        // Tracking state
        this.shouldTrack = this.calculateShouldTrack();
        this.lastShouldTrack = this.shouldTrack;

        // Debug logging utility
        this.DEBUG = {
            log: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[${timestamp}] ${message}`, data);
            },
            error: (message, error = null) => {
                const timestamp = new Date().toLocaleTimeString();
                console.error(`[${timestamp}] ❌ ERROR: ${message}`, error);
            },
            warn: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                console.warn(`[${timestamp}] ⚠️ WARNING: ${message}`, data);
            },
            time: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                const formattedData = {
                    ...data,
                    timeSinceLastActivity: data.timeSinceLastActivity ? `${data.timeSinceLastActivity}s` : 'N/A',
                    timeSinceLastCheck: data.timeSinceLastCheck ? `${data.timeSinceLastCheck}s` : 'N/A'
                };
                console.log(`[${timestamp}] ⏱️ TIME: ${message}`, formattedData);
            },
            focus: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[${timestamp}] 🎯 FOCUS: ${message}`, data);
            },
            fullscreen: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[${timestamp}] 🖥️ FULLSCREEN: ${message}`, data);
            },
            visibility: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[${timestamp}] 👁️ VISIBILITY: ${message}`, data);
            },
            activity: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                const formattedData = {
                    ...data,
                    timeSinceLastActivity: data.timeSinceLastActivity ? `${data.timeSinceLastActivity}s` : 'N/A'
                };
                console.log(`[${timestamp}] 🎮 ACTIVITY: ${message}`, formattedData);
            },
            status: (message, data = {}) => {
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[${timestamp}] 📊 STATUS: ${message}`, data);
            }
        };
        
        this.DEBUG.log('Content script initialized', {
            url: window.location.href,
            domain: window.location.hostname,
            initialState: {
                isUserActive: this.isUserActive,
                isVisible: this.isVisible,
                isFocused: this.isFocused,
                isFullscreen: this.isFullscreen
            }
        });
        
        this.init();
    }

    init() {
        this.DEBUG.log('Content script initialized');
        this.setupActivityTracking();
        this.setupVisibilityTracking();
        this.setupFocusTracking();
        this.setupFullscreenTracking();
        this.setupPeriodicChecks();
        this.notifyPageLoaded();
    }

    // Calculate if tracking should be active
    calculateShouldTrack() {
        const shouldTrack = this.isVisible && 
                          this.isFocused && 
                          this.isUserActive;
        this.DEBUG.log('Tracking status calculated:', {
            shouldTrack,
            isVisible: this.isVisible,
            isFocused: this.isFocused,
            isUserActive: this.isUserActive
        });
        return shouldTrack;
    }

    // Activity tracking setup
    setupActivityTracking() {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivityTime = Date.now();
                if (!this.isUserActive) {
                    this.isUserActive = true;
                    this.sendStatusUpdate();
                }
            });
        });

        setInterval(() => {
            const now = Date.now();
            if (now - this.lastActivityTime > 300000) {
                if (this.isUserActive) {
                    this.isUserActive = false;
                    this.sendStatusUpdate();
                }
            }
        }, 60000);
    }

    // Visibility change detection
    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = document.visibilityState === 'visible';
            this.sendStatusUpdate();
        });
    }

    // Window focus tracking
    setupFocusTracking() {
        window.addEventListener('focus', () => {
            this.isFocused = true;
            this.updateActivity(); // Focus counts as activity
            
            this.DEBUG.focus('Window focused');
            
            this.sendMessage({
                type: 'WINDOW_FOCUS',
                isFocused: true,
                domain: this.domain,
                timestamp: Date.now()
            });
            
            this.sendStatusUpdate();
        });

        window.addEventListener('blur', () => {
            this.isFocused = false;
            
            this.DEBUG.focus('Window blurred');
            
            this.sendMessage({
                type: 'WINDOW_BLUR',
                isFocused: false,
                domain: this.domain,
                timestamp: Date.now()
            });
            
            this.sendStatusUpdate();
        });
    }

    // Fullscreen detection
    setupFullscreenTracking() {
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = document.fullscreenElement !== null;
            
            this.DEBUG.fullscreen('Fullscreen changed', {
                isFullscreen: this.isFullscreen,
                timeSinceLastActivity: Math.floor((Date.now() - this.lastActivityTime) / 1000),
                currentState: {
                    isUserActive: this.isUserActive,
                    isVisible: this.isVisible,
                    isFocused: this.isFocused
                },
                status: this.isFullscreen ? 'Fullscreen' : 'Windowed'
            });
            
            this.sendStatusUpdate();
        });
    }

    // Periodic status updates
    setupPeriodicChecks() {
        setInterval(() => {
            const now = Date.now();
            if (now - this.lastPeriodicCheck >= 30000) {
                this.lastPeriodicCheck = now;
                this.sendStatusUpdate();
            }
        }, 30000);
    }

    // Update user activity
    updateActivity() {
        const wasActive = this.isUserActive;
        this.lastActivityTime = Date.now();
        this.isUserActive = true;

        if (!wasActive) {
            this.DEBUG.activity('User became active');
            
            this.sendMessage({
                type: 'USER_ACTIVITY_CHANGE',
                isActive: true,
                domain: this.domain,
                timestamp: Date.now()
            });
            
            this.sendStatusUpdate();
        }
    }

    // Update tracking status and notify background if changed
    sendStatusUpdate() {
        const now = Date.now();
        if (now - this.lastStatusUpdate < 1000) return;
        this.lastStatusUpdate = now;

        const timeSinceLastActivity = Math.floor((now - this.lastActivityTime) / 1000);
        const isIdle = timeSinceLastActivity >= 300; // 5 minutes

        if (isIdle && this.isUserActive) {
            this.DEBUG.activity('User idle', {
                timeSinceLastActivity,
                currentState: {
                    isVisible: this.isVisible,
                    isFocused: this.isFocused,
                    isFullscreen: this.isFullscreen
                },
                status: 'Idle'
            });
            this.isUserActive = false;
        }

        const newShouldTrack = this.calculateShouldTrack();
        
        if (newShouldTrack !== this.lastShouldTrack) {
            this.shouldTrack = newShouldTrack;
            this.lastShouldTrack = newShouldTrack;
            
            this.DEBUG.log('Tracking status changed:', {
                shouldTrack: this.shouldTrack,
                reason: this.getTrackingStatusReason()
            });
            
            const status = {
                type: 'STATUS_UPDATE',
                isActive: this.isUserActive,
                isVisible: this.isVisible,
                isFocused: this.isFocused,
                isFullscreen: this.isFullscreen,
                timeSinceLastActivity,
                timeSinceLastUpdate: Math.floor((now - this.lastStatusUpdate) / 1000),
                status: this.calculateStatus()
            };

            this.DEBUG.status('Status update', status);
            this.sendMessage(status);
        }
    }

    // Get reason for current tracking status
    getTrackingStatusReason() {
        if (!this.isVisible) return 'Page not visible';
        if (!this.isFocused) return 'Window not focused';
        if (!this.isUserActive) return 'User inactive';
        return 'All conditions met';
    }

    // Notify background script of page load
    notifyPageLoaded() {
        this.DEBUG.log('Page loaded');
        
        const status = {
            type: 'PAGE_LOADED',
            domain: this.domain,
            url: window.location.href,
            title: document.title,
            isVisible: this.isVisible,
            isFocused: this.isFocused,
            isActive: this.isUserActive,
            timestamp: Date.now()
        };

        this.DEBUG.status('Page loaded', status);
        this.sendMessage(status);
    }

    // Handle URL changes in SPAs
    handleUrlChange() {
        const newDomain = window.location.hostname;
        if (newDomain !== this.domain) {
            this.DEBUG.log('Domain changed:', {
                oldDomain: this.domain,
                newDomain: newDomain
            });
            
            this.sendMessage({
                type: 'DOMAIN_CHANGE',
                oldDomain: this.domain,
                newDomain: newDomain,
                url: window.location.href,
                timestamp: Date.now()
            });
            
            this.domain = newDomain;
        }
    }

    // Send message to background script
    sendMessage(message) {
        try {
            chrome.runtime.sendMessage(message).catch(error => {
                if (error.message.includes('Extension context invalidated')) {
                    this.DEBUG.log('Extension context invalidated, cleaning up');
                    this.cleanup();
                } else {
                    this.DEBUG.error('Failed to send message:', error);
                }
            });
        } catch (error) {
            this.DEBUG.error('Runtime error sending message:', error);
        }
    }

    // Cleanup intervals and listeners
    cleanup() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
        this.DEBUG.log('Content script cleaned up');
    }

    calculateStatus() {
        if (!this.isVisible) return 'Hidden';
        if (!this.isFocused) return 'Unfocused';
        if (!this.isUserActive) return 'Idle';
        if (this.isFullscreen) return 'Fullscreen';
        return 'Active';
    }
}

// Initialize content tracker
let contentTracker;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        contentTracker = new TimeTrackingContent();
    });
} else {
    contentTracker = new TimeTrackingContent();
}

// Handle SPA navigation and URL changes
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        if (contentTracker) {
            contentTracker.handleUrlChange();
        }
    }
}).observe(document, { subtree: true, childList: true });

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (contentTracker) {
        contentTracker.sendMessage({
            type: 'PAGE_UNLOAD',
            domain: contentTracker.domain,
            timestamp: Date.now()
        });
        contentTracker.cleanup();
    }
});

// Handle extension reload/update
chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
        if (contentTracker) {
            contentTracker.cleanup();
        }
    });
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ping' && contentTracker) {
        sendResponse({
            active: contentTracker.isUserActive,
            visible: contentTracker.isVisible,
            focused: contentTracker.isFocused,
            shouldTrack: contentTracker.shouldTrack,
            domain: contentTracker.domain,
            timestamp: Date.now()
        });
    }
    return true; // Keep message channel open
});
