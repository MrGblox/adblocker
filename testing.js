// antiAdblock.js
(function (global, factory) {
  if (typeof exports !== 'undefined' && typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global.AntiAdblock = factory();
  }
}(this, function () {
  'use strict';

  const AntiAdblock = {
    // Default configuration
    config: {
      baitSelectors: [
        'div.adsbox',
        '.ad-banner',
        '#ad-container',
        '.sponsor',
        '.advertisement',
        '.google-ads',
        '.adsbygoogle'
      ],
      baitUrls: [
        '/ads.js',
        '/banner.jpg',
        '/adblock-test',
        '/googlesyndication',
        '/doubleclick'
      ],
      checkInterval: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      redirectUrl: '/anti-adblock.html',
      timeoutSeconds: 15,
      message: 'Please disable your ad blocker to support our site.'
    },

    // State management
    state: {
      adblockDetected: false,
      checkCount: 0,
      isChecking: false,
      popupVisible: false,
      checkIntervalId: null,
      observer: null,
      timerIntervalId: null,
      currentTimeout: 0
    },

    // Utility functions
    utils: {
      // Create element with attributes
      createElement: (tag, attrs = {}, children = []) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
          if (key === 'style') {
            Object.assign(el.style, value);
          } else if (key === 'textContent') {
            el.textContent = value;
          } else if (key.startsWith('on')) {
            el.addEventListener(key.substring(2), value);
          } else {
            el.setAttribute(key, value);
          }
        });
        children.forEach(child => {
          if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
          } else {
            el.appendChild(child);
          }
        });
        return el;
      },

      // Async sleep utility
      sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

      // Safe fetch with timeout
      fetchWithTimeout: async (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },

      // Add CSS styles dynamically
      addStyles: () => {
        const style = AntiAdblock.utils.createElement('style', {
          textContent: `
            @keyframes antiAdblockFadeIn {
              from { opacity: 0; transform: scale(0.9); }
              to { opacity: 1; transform: scale(1); }
            }
            .anti-adblock-modal-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.6);
              backdrop-filter: blur(5px);
              z-index: 9999;
              display: flex;
              justify-content: center;
              align-items: center;
              animation: antiAdblockFadeIn 0.3s ease-out;
            }
            .anti-adblock-modal-content {
              background: white;
              border-radius: 16px;
              padding: 32px;
              max-width: 480px;
              width: 90%;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              text-align: center;
            }
            .anti-adblock-message {
              margin: 0 0 24px 0;
              color: #333;
              font-size: 18px;
              line-height: 1.5;
            }
            .anti-adblock-timer {
              margin: 20px 0;
              color: #666;
              font-size: 16px;
            }
            .anti-adblock-button {
              background-color: #007bff;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .anti-adblock-button:hover {
              background-color: #0056b3;
            }
          `
        });
        document.head.appendChild(style);
      }
    },

    // Detection methods
    detectors: {
      // Bait element detection with improved accuracy
      detectBaitElements: () => {
        const baitElements = [];
        const results = [];

        AntiAdblock.config.baitSelectors.forEach(selector => {
          // Create bait element with common ad-related class/id
          let className, id;
          if (selector.startsWith('.')) {
            className = selector.substring(1);
          } else if (selector.startsWith('#')) {
            id = selector.substring(1);
          } else {
            className = 'adsbox';
          }

          const bait = AntiAdblock.utils.createElement('div', {
            style: {
              display: 'block',
              visibility: 'visible',
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              left: '-9999px',
              fontSize: '10px'
            },
            className: className,
            id: id
          }, ['&nbsp;']);

          document.body.appendChild(bait);
          baitElements.push(bait);
        });

        // Check if any bait elements are hidden or altered
        baitElements.forEach((el, index) => {
          const computedStyle = window.getComputedStyle(el);
          const isHidden = computedStyle.display === 'none' || 
                          computedStyle.visibility === 'hidden' ||
                          el.offsetHeight === 0 ||
                          el.offsetWidth === 0;
          results.push(isHidden);
        });

        // Clean up bait elements
        baitElements.forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });

        // Only return true if at least one bait was blocked
        const blocked = results.some(result => result);
        console.log('AntiAdblock: Bait element detection result:', blocked, results);
        return blocked;
      },

      // Network request detection with improved accuracy
      detectBaitUrls: async () => {
        let blockedCount = 0;
        
        for (const url of AntiAdblock.config.baitUrls) {
          try {
            const response = await AntiAdblock.utils.fetchWithTimeout(url, {
              method: 'HEAD',
              cache: 'no-cache',
              headers: {
                'Accept': '*/*',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });
            
            // If we get a successful response, it's not blocked
            if (response.ok) {
              continue;
            }
            
            // If request fails due to network error, adblock likely blocked it
          } catch (error) {
            // Network error often indicates blocking
            blockedCount++;
            console.log('AntiAdblock: Network request blocked:', url);
          }
        }
        
        const isBlocked = blockedCount > 0;
        console.log('AntiAdblock: Network detection result:', isBlocked, 'blocked:', blockedCount);
        return isBlocked;
      },

      // Brave detection with improved accuracy
      detectBrave: () => {
        if (typeof navigator.brave !== 'undefined') {
          return true;
        }
        return false;
      }
    },

    // Main detection logic with retries and improved accuracy
    async detect() {
      if (AntiAdblock.state.isChecking) return AntiAdblock.state.adblockDetected;

      AntiAdblock.state.isChecking = true;
      
      try {
        let detectionResults = [];
        
        // Run multiple detection attempts
        for (let attempt = 0; attempt < AntiAdblock.config.maxRetries; attempt++) {
          console.log('AntiAdblock: Detection attempt', attempt + 1);
          
          const [baitHidden, networkBlocked, isBrave] = await Promise.all([
            AntiAdblock.detectors.detectBaitElements(),
            AntiAdblock.detectors.detectBaitUrls(),
            AntiAdblock.detectors.detectBrave()
          ]);

          // For improved accuracy, require both bait AND network to be blocked
          // (unless it's Brave with actual blocking)
          const detected = (baitHidden && networkBlocked) || (isBrave && (baitHidden || networkBlocked));
          
          detectionResults.push(detected);
          
          if (attempt < AntiAdblock.config.maxRetries - 1) {
            await AntiAdblock.utils.sleep(AntiAdblock.config.retryDelay);
          }
        }

        // Determine final result based on majority of attempts
        const trueCount = detectionResults.filter(result => result).length;
        const detected = trueCount >= Math.ceil(AntiAdblock.config.maxRetries / 2);
        
        console.log('AntiAdblock: Final detection result after', AntiAdblock.config.maxRetries, 'attempts:', detected);
        console.log('AntiAdblock: Individual results:', detectionResults);
        
        // Update state
        AntiAdblock.state.adblockDetected = detected;
        AntiAdblock.state.checkCount++;
        
        return detected;
      } catch (error) {
        console.warn('AntiAdblock: Detection error:', error);
        return false;
      } finally {
        AntiAdblock.state.isChecking = false;
      }
    },

    // Popup management
    popup: {
      element: null,
      overlay: null,

      create() {
        // Remove existing popup if any
        if (this.element) {
          this.destroy();
        }

        // Create overlay
        this.overlay = AntiAdblock.utils.createElement('div', {
          className: 'anti-adblock-modal-overlay'
        });

        // Create popup content
        const popupContent = AntiAdblock.utils.createElement('div', {
          className: 'anti-adblock-modal-content'
        }, [
          AntiAdblock.utils.createElement('p', {
            className: 'anti-adblock-message',
            textContent: AntiAdblock.config.message
          }),
          AntiAdblock.utils.createElement('p', {
            className: 'anti-adblock-timer',
            id: 'anti-adblock-timer'
          }),
          AntiAdblock.utils.createElement('button', {
            className: 'anti-adblock-button',
            textContent: 'I\'ve turned it off',
            onclick: () => {
              AntiAdblock.popup.checkAfterUserAction();
            }
          })
        ]);

        this.overlay.appendChild(popupContent);
        document.body.appendChild(this.overlay);
        AntiAdblock.state.popupVisible = true;
        
        // Disable background scroll
        document.body.style.overflow = 'hidden';
        
        // Start countdown timer
        AntiAdblock.popup.startTimer();
      },

      show() {
        if (!this.element && !this.overlay) {
          this.create();
        }
        if (this.overlay) {
          this.overlay.style.display = 'flex';
          AntiAdblock.state.popupVisible = true;
          document.body.style.overflow = 'hidden';
        }
      },

      hide() {
        if (this.overlay) {
          this.overlay.style.display = 'none';
          AntiAdblock.state.popupVisible = false;
          document.body.style.overflow = '';
        }
      },

      destroy() {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
          this.overlay = null;
          this.element = null;
          AntiAdblock.state.popupVisible = false;
          document.body.style.overflow = '';
        }
        AntiAdblock.popup.stopTimer();
      },

      startTimer() {
        AntiAdblock.state.currentTimeout = AntiAdblock.config.timeoutSeconds;
        
        // Update timer display immediately
        const timerElement = document.getElementById('anti-adblock-timer');
        if (timerElement) {
          timerElement.textContent = `Redirecting in ${AntiAdblock.state.currentTimeout}s...`;
        }
        
        AntiAdblock.state.timerIntervalId = setInterval(() => {
          AntiAdblock.state.currentTimeout--;
          
          const timerElement = document.getElementById('anti-adblock-timer');
          if (timerElement) {
            timerElement.textContent = `Redirecting in ${AntiAdblock.state.currentTimeout}s...`;
          }
          
          if (AntiAdblock.state.currentTimeout <= 0) {
            AntiAdblock.popup.handleTimeout();
          }
        }, 1000);
      },

      stopTimer() {
        if (AntiAdblock.state.timerIntervalId) {
          clearInterval(AntiAdblock.state.timerIntervalId);
          AntiAdblock.state.timerIntervalId = null;
        }
      },

      handleTimeout() {
        AntiAdblock.popup.stopTimer();
        window.location.href = AntiAdblock.config.redirectUrl;
      },

      async checkAfterUserAction() {
        // Stop the current timer
        AntiAdblock.popup.stopTimer();
        
        // Hide popup temporarily
        AntiAdblock.popup.hide();
        
        // Wait a bit for changes to take effect
        await AntiAdblock.utils.sleep(2000);
        
        // Run detection again
        const stillBlocked = await AntiAdblock.detect();
        
        if (!stillBlocked) {
          // Adblock is off, hide popup permanently and stop monitoring
          AntiAdblock.popup.destroy();
          AntiAdblock.stopMonitoring();
        } else {
          // Adblock still on, show popup again with fresh timer
          AntiAdblock.popup.show();
        }
      }
    },

    // Monitoring and auto-check
    startMonitoring() {
      if (AntiAdblock.state.checkIntervalId) {
        return; // Already monitoring
      }

      AntiAdblock.state.checkIntervalId = setInterval(async () => {
        if (AntiAdblock.state.popupVisible) return; // Don't check if popup is visible

        const detected = await AntiAdblock.detect();
        
        if (detected && !AntiAdblock.state.popupVisible) {
          AntiAdblock.popup.show();
        } else if (!detected && AntiAdblock.state.popupVisible) {
          // Adblock was turned off, hide popup
          AntiAdblock.popup.hide();
        }
      }, AntiAdblock.config.checkInterval);
    },

    stopMonitoring() {
      if (AntiAdblock.state.checkIntervalId) {
        clearInterval(AntiAdblock.state.checkIntervalId);
        AntiAdblock.state.checkIntervalId = null;
      }
    },

    // Initialize the anti-adblock system
    async init(options = {}) {
      // Merge options with defaults
      Object.assign(AntiAdblock.config, options);
      
      // Add required CSS styles
      AntiAdblock.utils.addStyles();

      // Run initial detection after a delay to avoid blocking page load
      setTimeout(async () => {
        const detected = await AntiAdblock.detect();
        
        if (detected) {
          AntiAdblock.popup.show();
        } else {
          // Start monitoring for changes
          AntiAdblock.startMonitoring();
        }
      }, 1000);

      // Also use requestIdleCallback if available for non-blocking execution
      if ('requestIdleCallback' in window) {
        requestIdleCallback(async () => {
          // Additional checks can be performed here
        });
      }
    },

    // Cleanup function
    destroy() {
      AntiAdblock.stopMonitoring();
      AntiAdblock.popup.destroy();
      
      // Clean up any remaining state
      AntiAdblock.state = {
        adblockDetected: false,
        checkCount: 0,
        isChecking: false,
        popupVisible: false,
        checkIntervalId: null,
        observer: null,
        timerIntervalId: null,
        currentTimeout: 0
      };
      
      // Re-enable scrolling
      document.body.style.overflow = '';
    }
  };

  return AntiAdblock;
}));
