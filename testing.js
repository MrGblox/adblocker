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
    // Configuration
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
      checkInterval: 3000,
      maxRetries: 3,
      retryDelay: 1000
    },

    // State management
    state: {
      adblockDetected: false,
      checkCount: 0,
      isChecking: false,
      popupVisible: false,
      checkIntervalId: null,
      observer: null
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
      }
    },

    // Detection methods
    detectors: {
      // Bait element detection
      detectBaitElements: () => {
        const baitElements = [];
        AntiAdblock.config.baitSelectors.forEach(selector => {
          const bait = AntiAdblock.utils.createElement('div', {
            style: {
              display: 'none',
              visibility: 'hidden',
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              left: '-9999px'
            },
            className: selector.includes('.') ? selector.substring(1) : 'adsbox',
            id: selector.startsWith('#') ? selector.substring(1) : undefined
          });
          
          // Use the selector logic to determine where to place it
          let placementSelector = selector.replace(/^[.#]/, '');
          if (selector.startsWith('#')) {
            bait.id = placementSelector;
          } else if (selector.startsWith('.')) {
            bait.className = placementSelector;
          }
          
          document.body.appendChild(bait);
          baitElements.push(bait);
        });

        // Check if any bait elements are hidden
        const isHidden = baitElements.some(el => {
          const computedStyle = window.getComputedStyle(el);
          return computedStyle.display === 'none' || 
                 computedStyle.visibility === 'hidden' ||
                 el.offsetHeight === 0;
        });

        // Clean up bait elements
        baitElements.forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });

        return isHidden;
      },

      // Network request detection
      detectBaitUrls: async () => {
        for (const url of AntiAdblock.config.baitUrls) {
          try {
            const response = await AntiAdblock.utils.fetchWithTimeout(url, {
              method: 'HEAD',
              cache: 'no-cache'
            });
            
            // If we get a 404 or similar, it might be blocked
            if (response.status >= 400) {
              continue; // Try next URL
            }
            
            // If request fails due to network error, adblock likely blocked it
          } catch (error) {
            // Network error often indicates blocking
            return true;
          }
        }
        return false;
      },

      // Brave Shields detection
      detectBrave: () => {
        if (typeof navigator.brave !== 'undefined') {
          return true;
        }
        // Additional Brave detection methods
        const braveIndicators = [
          window.chrome && window.chrome.loadTimes,
          navigator.userAgent.includes('Brave'),
          navigator.plugins.length < 5 // Brave typically has fewer plugins
        ];
        return braveIndicators.some(indicator => indicator);
      }
    },

    // Main detection logic
    async detect() {
      if (AntiAdblock.state.isChecking) return AntiAdblock.state.adblockDetected;

      AntiAdblock.state.isChecking = true;
      
      try {
        // Run all detection methods concurrently
        const [baitHidden, networkBlocked, isBrave] = await Promise.all([
          AntiAdblock.detectors.detectBaitElements(),
          AntiAdblock.detectors.detectBaitUrls(),
          AntiAdblock.detectors.detectBrave()
        ]);

        const detected = baitHidden || networkBlocked || isBrave;
        
        // Update state
        AntiAdblock.state.adblockDetected = detected;
        AntiAdblock.state.checkCount++;
        
        console.log('AntiAdblock: Detection complete. Adblock detected:', detected);
        
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
          style: {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: '9998',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }
        });

        // Create popup content
        const popupContent = AntiAdblock.utils.createElement('div', {
          style: {
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            textAlign: 'center',
            fontFamily: 'sans-serif',
            color: '#000000'
          }
        }, [
          AntiAdblock.utils.createElement('h3', {
            textContent: 'Please turn off your ad blocker to continue using this site.',
            style: {
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: 'normal'
            }
          }),
          AntiAdblock.utils.createElement('div', {
            style: {
              marginTop: '20px'
            }
          }, [
            AntiAdblock.utils.createElement('button', {
              textContent: 'I\'ve turned it off',
              style: {
                backgroundColor: '#007bff',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginRight: '10px',
                fontSize: '14px'
              },
              onclick: () => {
                AntiAdblock.popup.checkAfterUserAction();
              }
            }),
            AntiAdblock.utils.createElement('button', {
              textContent: 'Close',
              style: {
                backgroundColor: '#6c757d',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              },
              onclick: () => {
                AntiAdblock.popup.hide();
              }
            })
          ])
        ]);

        this.overlay.appendChild(popupContent);
        document.body.appendChild(this.overlay);
        AntiAdblock.state.popupVisible = true;
      },

      show() {
        if (!this.element && !this.overlay) {
          this.create();
        }
        if (this.overlay) {
          this.overlay.style.display = 'flex';
          AntiAdblock.state.popupVisible = true;
        }
      },

      hide() {
        if (this.overlay) {
          this.overlay.style.display = 'none';
          AntiAdblock.state.popupVisible = false;
        }
      },

      destroy() {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
          this.overlay = null;
          this.element = null;
          AntiAdblock.state.popupVisible = false;
        }
      },

      async checkAfterUserAction() {
        // Hide popup temporarily
        this.hide();
        
        // Wait a bit for changes to take effect
        await AntiAdblock.utils.sleep(1000);
        
        // Run detection again
        const stillBlocked = await AntiAdblock.detect();
        
        if (!stillBlocked) {
          // Adblock is off, hide popup permanently
          this.destroy();
          AntiAdblock.stopMonitoring();
        } else {
          // Adblock still on, show popup again
          this.show();
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
      // Merge options
      if (options.baitSelectors) {
        AntiAdblock.config.baitSelectors = [...AntiAdblock.config.baitSelectors, ...options.baitSelectors];
      }
      if (options.baitUrls) {
        AntiAdblock.config.baitUrls = [...AntiAdblock.config.baitUrls, ...options.baitUrls];
      }
      if (options.checkInterval) {
        AntiAdblock.config.checkInterval = options.checkInterval;
      }

      // Add CSS styles dynamically
      const style = AntiAdblock.utils.createElement('style', {
        textContent: `
          .anti-adblock-hidden { display: none !important; }
          .anti-adblock-invisible { visibility: hidden !important; }
        `
      });
      document.head.appendChild(style);

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
        observer: null
      };
    }
  };

  return AntiAdblock;
}));
