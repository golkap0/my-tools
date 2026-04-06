// ==UserScript==
// @name         Vivo Tab Keeper v3.0 - CSP Safe Edition
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Mencegah tab reload VIVO - Tanpa CSP Error - Icon Tengah Kanan
// @author       Custom for Vivo Users
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ============ KONFIGURASI ============
    const CONFIG = {
        mode: 'aggressive',
        activityInterval: 30000,
        autoStart: true,
        showIndicator: true,
        useWorker: false, // MATIKAN - menyebabkan CSP error
        useFetchKeepAlive: true,
        keepAliveUrl: 'https://www.google.com/favicon.ico'
    };

    // ============ GLOBAL VARIABLES ============
    let isActive = false;
    let mediaElement = null;
    let mediaSessionActive = false;
    let intervals = [];
    let indicatorElement = null;
    let containerElement = null;
    let audioContext = null;
    let oscillator = null;
    let retryCount = 0;
    const MAX_RETRY = 5;

    // ============ INISIALISASI UTAMA ============
    function init() {
        console.log('[Vivo Tab Keeper v3] Initializing...');
        
        if (window.__vivoTabKeeperActive) {
            console.log('[Vivo Tab Keeper v3] Already running');
            return;
        }
        
        window.__vivoTabKeeperActive = true;

        // Buat indikator dengan retry
        if (CONFIG.showIndicator) {
            tryCreateIndicatorWithRetry();
        }
        
        // Auto-start
        if (CONFIG.autoStart) {
            setTimeout(() => {
                activateKeepAlive();
            }, 1500);
        }

        // Event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('pagehide', handlePageHide);

        // Observer untuk proteksi indicator
        setupIndicatorObserver();

        console.log('[Vivo Tab Keeper v3] Initialized successfully');
    }

    // ============ INDIKATOR VISUAL (TENGAH KANAN) - CSP SAFE ============
    
    function tryCreateIndicatorWithRetry() {
        const success = tryCreateIndicator();
        
        if (!success && retryCount < MAX_RETRY) {
            retryCount++;
            setTimeout(() => {
                tryCreateIndicatorWithRetry();
            }, 1000 * retryCount);
        }
    }

    function tryCreateIndicator() {
        try {
            if (!document.body) {
                return false;
            }

            // Cek apakah sudah ada
            if (document.getElementById('vtk-container-v3')) {
                containerElement = document.getElementById('vtk-container-v3');
                indicatorElement = document.getElementById('vivo-tab-keeper-indicator-v3');
                return true;
            }

            // ============ BUAT CONTAINER ============
            containerElement = document.createElement('div');
            containerElement.id = 'vtk-container-v3';
            
            // Set atribut style satu peratu (CSP safe)
            containerElement.setAttribute('style', [
                'position: fixed !important',
                'top: 50% !important',
                'right: 15px !important',
                'transform: translateY(-50%) !important',
                'z-index: 2147483647 !important',
                'pointer-events: auto !important',
                'display: block !important',
                'visibility: visible !important',
                'opacity: 1 !important',
                'width: 50px !important',
                'height: 50px !important'
            ].join('; '));

            // ============ BUAT INDICATOR BUTTON ============
            indicatorElement = document.createElement('div');
            indicatorElement.id = 'vivo-tab-keeper-indicator-v3';
            
            // Set style (CSP safe - tanpa innerHTML)
            indicatorElement.setAttribute('style', [
                'width: 100% !important',
                'height: 100% !important',
                'border-radius: 50% !important',
                'background: linear-gradient(135deg, rgba(0, 150, 255, 0.4), rgba(0, 100, 200, 0.6)) !important',
                'border: 3px solid rgba(255, 255, 255, 0.8) !important',
                'box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 150, 255, 0.4) !important',
                'cursor: pointer !important',
                'display: flex !important',
                'align-items: center !important',
                'justify-content: center !important',
                'font-size: 24px !important',
                'transition: all 0.3s ease !important',
                'backdrop-filter: blur(10px) !important',
                '-webkit-backdrop-filter: blur(10px) !important',
                'user-select: none !important',
                '-webkit-user-select: none !important',
                'pointer-events: auto !important',
                'visibility: visible !important',
                'opacity: 1 !important'
            ].join('; '));

            // Set text content (CSP SAFE - bukan innerHTML!)
            setTextContentSafe(indicatorElement, '💤');
            
            // Set title
            indicatorElement.title = '🛡️ Vivo Tab Keeper v3\nClick to toggle';

            // Event listeners
            addEventListeners(indicatorElement);

            // Assemble
            containerElement.appendChild(indicatorElement);
            
            // Inject ke body
            injectToBody(containerElement);

            // Add global styles
            addGlobalStyles();

            console.log('[Vivo Tab Keeper v3] ✅ Indicator created at CENTER-RIGHT');
            return true;

        } catch (err) {
            console.error('[Vivo Tab Keeper v3] Error creating indicator:', err);
            return false;
        }
    }

    // ============ CSP SAFE TEXT CONTENT ============
    function setTextContentSafe(element, text) {
        try {
            // Method 1: textContent (paling aman)
            element.textContent = text;
        } catch (e) {
            try {
                // Method 2: createTextNode
                const textNode = document.createTextNode(text);
                element.appendChild(textNode);
            } catch (e2) {
                try {
                    // Method 3: innerText
                    element.innerText = text;
                } catch (e3) {
                    console.error('[Vivo Tab Keeper v3] All text methods failed');
                }
            }
        }
    }

    // ============ EVENT LISTENERS ============
    function addEventListeners(element) {
        // Click handler
        element.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleKeepAlive();
        });
        
        // Touch handler (mobile)
        element.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleKeepAlive();
        }, { passive: false });

        // Prevent bubbling
        element.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        element.addEventListener('mouseup', function(e) {
            e.stopPropagation();
        });
    }

    function injectToBody(element) {
        try {
            if (document.body) {
                document.body.appendChild(element);
                return;
            }
        } catch (e) {}

        try {
            document.documentElement.appendChild(element);
            return;
        } catch (e) {}

        try {
            if (document.body && document.body.firstChild) {
                document.body.insertBefore(element, document.body.firstChild);
                return;
            }
        } catch (e) {}

        // Fallback observer
        const observer = new MutationObserver((mutations, obs) => {
            if (document.body) {
                document.body.appendChild(element);
                obs.disconnect();
            }
        });
        
        if (document.documentElement) {
            observer.observe(document.documentElement, { childList: true });
        }
    }

    function addGlobalStyles() {
        if (document.getElementById('vtk-global-styles-v3')) return;

        try {
            const style = document.createElement('style');
            style.id = 'vtk-global-styles-v3';
            
            // Gunakan textContent untuk CSS (CSP safe)
            const cssRules = `
                #vtk-container-v3 {
                    position: fixed !important;
                    top: 50% !important;
                    right: 15px !important;
                    transform: translateY(-50%) !important;
                    z-index: 2147483647 !important;
                }
                
                #vivo-tab-keeper-indicator-v3.active {
                    background: linear-gradient(135deg, rgba(0, 255, 100, 0.5), rgba(0, 200, 80, 0.7)) !important;
                    border-color: rgba(255, 255, 255, 1) !important;
                    box-shadow: 0 4px 20px rgba(0, 255, 100, 0.6), 0 0 30px rgba(0, 255, 100, 0.4) !important;
                    animation: vtk-pulse-v3 2s infinite !important;
                }

                @keyframes vtk-pulse-v3 {
                    0% { transform: scale(1); box-shadow: 0 4px 15px rgba(0, 255, 100, 0.4), 0 0 0 0 rgba(0, 255, 100, 0.7); }
                    50% { transform: scale(1.08); box-shadow: 0 6px 25px rgba(0, 255, 100, 0.6), 0 0 0 15px rgba(0, 255, 100, 0); }
                    100% { transform: scale(1); box-shadow: 0 4px 15px rgba(0, 255, 100, 0.4), 0 0 0 0 rgba(0, 255, 100, 0); }
                }
            `;
            
            style.textContent = cssRules;
            
            if (document.head) {
                document.head.appendChild(style);
            } else {
                document.documentElement.appendChild(style);
            }
        } catch (err) {
            console.error('[Vivo Tab Keeper v3] Error adding styles:', err);
        }
    }

    function setupIndicatorObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node.id === 'vtk-container-v3' || node.id === 'vivo-tab-keeper-indicator-v3') {
                        console.log('[Vivo Tab Keeper v3] ⚠️ Indicator removed! Recreating...');
                        setTimeout(() => {
                            tryCreateIndicatorWithRetry();
                            if (isActive) updateIndicator(true);
                        }, 500);
                    }
                });
            });
        });

        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        } else {
            const bodyObserver = new MutationObserver(() => {
                if (document.body) {
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    });
                    bodyObserver.disconnect();
                }
            });
            bodyObserver.observe(document.documentElement, { childList: true });
        }
    }

    function updateIndicator(active) {
        if (!indicatorElement) {
            tryCreateIndicator();
            if (!indicatorElement) return;
        }
        
        try {
            if (active) {
                // Add class active
                indicatorElement.classList.add('active');
                
                // Update text (CSP SAFE)
                setTextContentSafe(indicatorElement, '🛡️');
                
                // Update style inline
                indicatorElement.style.cssText += [
                    'background: linear-gradient(135deg, rgba(0, 255, 100, 0.5), rgba(0, 200, 80, 0.7)) !important',
                    'border-color: rgba(255, 255, 255, 1) !important',
                    'animation: vtk-pulse-v3 2s infinite !important'
                ].join('; ');
                
            } else {
                // Remove class active
                indicatorElement.classList.remove('active');
                
                // Update text (CSP SAFE)
                setTextContentSafe(indicatorElement, '💤');
                
                // Reset style
                indicatorElement.style.cssText += [
                    'background: linear-gradient(135deg, rgba(0, 150, 255, 0.4), rgba(0, 100, 200, 0.6)) !important',
                    'border-color: rgba(255, 255, 255, 0.8) !important',
                    'animation: none !important'
                ].join('; ');
            }
        } catch (e) {
            console.error('[Vivo Tab Keeper v3] Error updating indicator:', e);
        }
    }

    // ============ KEEP ALIVE MECHANISMS ============
    
    function activateKeepAlive() {
        if (isActive) return;
        
        console.log('[Vivo Tab Keeper v3] 🚀 ACTIVATING...');
        isActive = true;
        
        switch(CONFIG.mode) {
            case 'video':
                startVideoKeepAlive();
                break;
            case 'audio':
                startAudioKeepAlive();
                break;
            case 'both':
                startVideoKeepAlive();
                startAudioKeepAlive();
                break;
            case 'aggressive':
                startVideoKeepAlive();
                startAudioKeepAlive();
                // SKIP Worker - causes CSP error!
                startFetchKeepAlive();
                startActivityIntervals();
                // Alternative to Worker: Heavy computation interval
                startComputationInterval();
                break;
            default:
                startVideoKeepAlive();
                startAudioKeepAlive();
        }
        
        updateIndicator(true);
        console.log('[Vivo Tab Keeper v3] ✅ ACTIVE - Protected!');
    }

    function deactivateKeepAlive() {
        if (!isActive) return;
        
        console.log('[Vivo Tab Keeper v3] Deactivating...');
        isActive = false;
        
        stopMediaElements();
        clearIntervals();
        stopAudioContext();
        
        updateIndicator(false);
        console.log('[Vivo Tab Keeper v3] Deactivated');
    }

    function toggleKeepAlive() {
        if (isActive) {
            deactivateKeepAlive();
        } else {
            activateKeepAlive();
        }
    }

    // ============ VIDEO KEEP ALIVE ============
    function startVideoKeepAlive() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            canvas.style.display = 'none';
            canvas.id = 'vtk-canvas-v3';
            document.body.appendChild(canvas);
            
            const ctx = canvas.getContext('2d');
            let frameCount = 0;
            
            function drawFrame() {
                if (!isActive || !canvas.parentNode) return;
                
                ctx.fillStyle = 'rgb(' + (frameCount % 256) + ',' + ((frameCount * 2) % 256) + ',' + ((frameCount * 3) % 256) + ')';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                frameCount++;
                requestAnimationFrame(drawFrame);
            }
            
            const stream = canvas.captureStream(10);
            
            mediaElement = document.createElement('video');
            mediaElement.id = 'vtk-video-v3';
            mediaElement.style.display = 'none';
            mediaElement.muted = true;
            mediaElement.playsInline = true;
            mediaElement.setAttribute('playsinline', '');
            mediaElement.srcObject = stream;
            document.body.appendChild(mediaElement);
            
            mediaElement.play().then(() => {
                console.log('[Vivo Tab Keeper v3] Video keep-alive started');
                registerMediaSession('video');
                drawFrame();
            }).catch(err => {
                console.warn('[Vivo Tab Keeper v3] Video failed, fallback audio');
                startAudioKeepAlive();
            });
            
        } catch (err) {
            console.error('[Vivo Tab Keeper v3] Video error:', err);
        }
    }

    // ============ AUDIO KEEP ALIVE ============
    function startAudioKeepAlive() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.frequency.setValueAtTime(20, audioContext.currentTime);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    registerMediaSession('audio');
                });
            } else {
                registerMediaSession('audio');
            }
            
            console.log('[Vivo Tab Keeper v3] Audio keep-alive started');
            
        } catch (err) {
            console.error('[Vivo Tab Keeper v3] Audio error:', err);
        }
    }

    function stopAudioContext() {
        try {
            if (oscillator) {
                oscillator.stop();
                oscillator.disconnect();
                oscillator = null;
            }
            if (audioContext) {
                audioContext.close();
                audioContext = null;
            }
        } catch (err) {}
    }

    // ============ MEDIA SESSION ============
    function registerMediaSession(type) {
        if (!('mediaSession' in navigator)) return;
        
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: '🛡️ Vivo Tab Keeper v3 (' + type + ')',
                artist: 'All-Site Protection',
                album: 'Active on all websites',
                artwork: [
                    { 
                        src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj50ZXh0IHk9Ii45ZW0iIGZvbnQtc2l6ZT0iOTAiPrKdjwvdGV4dD48L3N2Zz4=',
                        sizes: '96x96', 
                        type: 'image/svg+xml' 
                    }
                ]
            });
            
            navigator.mediaSession.playbackState = "playing";
            
            navigator.mediaSession.setActionHandler('pause', () => {
                navigator.mediaSession.playbackState = "playing";
            });
            
            navigator.mediaSession.setActionHandler('play', () => {
                navigator.mediaSession.playbackState = "playing";
            });
            
            mediaSessionActive = true;
            console.log('[Vivo Tab Keeper v3] MediaSession registered (' + type + ')');
            
        } catch (err) {
            console.error('[Vivo Tab Keeper v3] MediaSession error:', err);
        }
    }

    // ============ COMPUTATION INTERVAL (REPLACEMENT FOR WORKER) ============
    function startComputationInterval() {
        // Ini adalah alternatif untuk Web Worker yang diblokir CSP
        const compInterval = setInterval(() => {
            if (!isActive) return;
            
            // Light computation untuk menjaga CPU aktif
            let result = 0;
            for (let i = 0; i < 100; i++) {
                result += Math.sqrt(i);
            }
            
        }, 5000); // Setiap 5 detik
        
        intervals.push(compInterval);
        console.log('[Vivo Tab Keeper v3] Computation interval started (Worker alternative)');
    }

    // ============ FETCH KEEP ALIVE ============
    function startFetchKeepAlive() {
        if (!CONFIG.useFetchKeepAlive) return;
        
        const fetchInterval = setInterval(() => {
            if (!isActive) return;
            
            fetch(CONFIG.keepAliveUrl, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache',
                keepalive: true
            }).catch(() => {});
        }, CONFIG.activityInterval);
        
        intervals.push(fetchInterval);
        console.log('[Vivo Tab Keeper v3] Fetch keep-alive started');
    }

    // ============ ACTIVITY INTERVALS ============
    function startActivityIntervals() {
        const activityInterval = setInterval(() => {
            if (!isActive) return;
            
            try {
                sessionStorage.setItem('vivo_tab_keeper_heartbeat_v3', Date.now().toString());
            } catch (e) {}
            
            // DOM manipulation ringan
            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            tempDiv.setAttribute('data-timestamp', String(Date.now()));
            if (document.body) {
                document.body.appendChild(tempDiv);
                document.body.removeChild(tempDiv);
            }
            
        }, CONFIG.activityInterval);
        
        intervals.push(activityInterval);
        
        const logInterval = setInterval(() => {
            if (!isActive) return;
            console.log('[Vivo Tab Keeper v3] 💚 Still protecting... | Mode:', CONFIG.mode);
        }, 60000);
        
        intervals.push(logInterval);
    }

    function clearIntervals() {
        intervals.forEach(interval => clearInterval(interval));
        intervals = [];
    }

    // ============ STOP MEDIA ELEMENTS ============
    function stopMediaElements() {
        if (mediaElement) {
            mediaElement.pause();
            mediaElement.srcObject = null;
            if (mediaElement.parentNode) {
                mediaElement.parentNode.removeChild(mediaElement);
            }
            mediaElement = null;
        }
        
        const canvas = document.getElementById('vtk-canvas-v3');
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
        
        if (mediaSessionActive && 'mediaSession' in navigator) {
            try {
                navigator.mediaSession.playbackState = "none";
                mediaSessionActive = false;
            } catch (e) {}
        }
    }

    // ============ EVENT HANDLERS ============
    function handleVisibilityChange() {
        if (document.hidden && isActive) {
            console.log('[Vivo Tab Keeper v3] Page hidden - boosting protection');
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }
    }

    function handlePageShow(event) {
        if (event.persisted && CONFIG.autoStart && !isActive) {
            setTimeout(() => activateKeepAlive(), 500);
        }
    }

    function handlePageHide(event) {
        console.log('[Vivo Tab Keeper v3] Page hide');
    }

    // ============ CLEANUP ============
    window.addEventListener('beforeunload', () => {
        deactivateKeepAlive();
    });

    // ============ START ============
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
