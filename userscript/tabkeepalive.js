// ==UserScript==
// @name         Vivo Tab Keeper v3.4 - Silent
// @namespace    http://tampermonkey.net/
// @version      3.4.0
// @description  Mencegah tab reload VIVO - Silent Mode (Hanya error yang ditampilkan)
// @author       Custom for Vivo Users
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // ============ 🔒 IFRAME DETECTION ============

    function isInsideIFrame() {
        try {
            if (window.self !== window.top) return true;
            if (window.location !== window.parent.location) return true;
            if (window.frameElement && window.frameElement !== window) return true;
            if (window.parent && window.parent !== window) {
                try {
                    window.parent.document;
                    return true;
                } catch(e) {
                    return true;
                }
            }
        } catch (e) {
            return true;
        }

        return false;
    }

    if (isInsideIFrame()) {
        return; // Silent exit
    }

    // ============ KONFIGURASI ============
    const CONFIG = {
        mode: 'aggressive',
        activityInterval: 30000,
        autoStart: true,
        showIndicator: true,
        useWorker: false,
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
        if (window.__vivoTabKeeperActive) {
            return;
        }

        window.__vivoTabKeeperActive = true;

        if (CONFIG.showIndicator) {
            tryCreateIndicatorWithRetry();
        }

        if (CONFIG.autoStart) {
            setTimeout(() => {
                activateKeepAlive();
            }, 1500);
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('pagehide', handlePageHide);

        setupIndicatorObserver();
    }

    // ============ INDIKATOR VISUAL (STATIC) ============

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
            if (isInsideIFrame()) {
                return false;
            }

            if (!document.body) {
                return false;
            }

            if (document.getElementById('vtk-container-v34')) {
                containerElement = document.getElementById('vtk-container-v34');
                indicatorElement = document.getElementById('vivo-tab-keeper-indicator-v34');
                return true;
            }

            containerElement = document.createElement('div');
            containerElement.id = 'vtk-container-v34';

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

            indicatorElement = document.createElement('div');
            indicatorElement.id = 'vivo-tab-keeper-indicator-v34';

            indicatorElement.setAttribute('style', [
                'width: 100% !important',
                'height: 100% !important',
                'border-radius: 50% !important',
                'background: linear-gradient(135deg, rgba(0, 150, 255, 0.5), rgba(0, 100, 200, 0.7)) !important',
                'border: 3px solid rgba(255, 255, 255, 0.9) !important',
                'box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 150, 255, 0.5) !important',
                'cursor: pointer !important',
                'display: flex !important',
                'align-items: center !important',
                'justify-content: center !important',
                'font-size: 24px !important',
                'transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease !important',
                'backdrop-filter: blur(10px) !important',
                '-webkit-backdrop-filter: blur(10px) !important',
                'user-select: none !important',
                '-webkit-user-select: none !important',
                'pointer-events: auto !important',
                'visibility: visible !important',
                'opacity: 1 !important'
            ].join('; '));

            setTextContentSafe(indicatorElement, '💤');

            indicatorElement.title = '🛡️ Vivo Tab Keeper\nClick to toggle';

            addEventListeners(indicatorElement);

            containerElement.appendChild(indicatorElement);

            injectToBody(containerElement);

            addGlobalStyles();

            return true;

        } catch (err) {
            console.error('[Vivo Tab Keeper] Error creating indicator:', err);
            return false;
        }
    }

    function setTextContentSafe(element, text) {
        try {
            element.textContent = text;
        } catch (e) {
            try {
                const textNode = document.createTextNode(text);
                element.appendChild(textNode);
            } catch (e2) {
                try {
                    element.innerText = text;
                } catch (e3) {}
            }
        }
    }

    function addEventListeners(element) {
        element.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleKeepAlive();
        });

        element.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleKeepAlive();
        }, { passive: false });

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
        if (document.getElementById('vtk-global-styles-v34')) return;

        try {
            const style = document.createElement('style');
            style.id = 'vtk-global-styles-v34';

            const cssRules = `
                #vtk-container-v34 {
                    position: fixed !important;
                    top: 50% !important;
                    right: 15px !important;
                    transform: translateY(-50%) !important;
                    z-index: 2147483647 !important;
                }

                #vivo-tab-keeper-indicator-v34.active {
                    background: linear-gradient(135deg, rgba(0, 255, 100, 0.6), rgba(0, 200, 80, 0.8)) !important;
                    border-color: rgba(255, 255, 255, 1) !important;
                    box-shadow: 0 4px 20px rgba(0, 255, 100, 0.7), 0 0 25px rgba(0, 255, 100, 0.5) !important;
                }
            `;

            style.textContent = cssRules;

            if (document.head) {
                document.head.appendChild(style);
            } else {
                document.documentElement.appendChild(style);
            }
        } catch (err) {
            console.error('[Vivo Tab Keeper] Error adding styles:', err);
        }
    }

    function setupIndicatorObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node.id === 'vtk-container-v34' || node.id === 'vivo-tab-keeper-indicator-v34') {
                        if (!isInsideIFrame()) {
                            setTimeout(() => {
                                tryCreateIndicatorWithRetry();
                                if (isActive) updateIndicator(true);
                            }, 500);
                        }
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
                indicatorElement.classList.add('active');
                setTextContentSafe(indicatorElement, '🛡️');

                indicatorElement.style.cssText += [
                    'background: linear-gradient(135deg, rgba(0, 255, 100, 0.6), rgba(0, 200, 80, 0.8)) !important',
                    'border-color: rgba(255, 255, 255, 1) !important',
                    'box-shadow: 0 4px 20px rgba(0, 255, 100, 0.7), 0 0 25px rgba(0, 255, 100, 0.5) !important'
                ].join('; ');

            } else {
                indicatorElement.classList.remove('active');
                setTextContentSafe(indicatorElement, '💤');

                indicatorElement.style.cssText += [
                    'background: linear-gradient(135deg, rgba(0, 150, 255, 0.5), rgba(0, 100, 200, 0.7)) !important',
                    'border-color: rgba(255, 255, 255, 0.9) !important',
                    'box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 150, 255, 0.5) !important'
                ].join('; ');
            }
        } catch (e) {
            console.error('[Vivo Tab Keeper] Error updating indicator:', e);
        }
    }

    // ============ KEEP ALIVE MECHANISMS ============

    function activateKeepAlive() {
        if (isActive) return;

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
                startFetchKeepAlive();
                startActivityIntervals();
                startComputationInterval();
                break;
            default:
                startVideoKeepAlive();
                startAudioKeepAlive();
        }

        updateIndicator(true);
    }

    function deactivateKeepAlive() {
        if (!isActive) return;

        isActive = false;

        stopMediaElements();
        clearIntervals();
        stopAudioContext();

        updateIndicator(false);
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
            canvas.id = 'vtk-canvas-v34';
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
            mediaElement.id = 'vtk-video-v34';
            mediaElement.style.display = 'none';
            mediaElement.muted = true;
            mediaElement.playsInline = true;
            mediaElement.setAttribute('playsinline', '');
            mediaElement.srcObject = stream;
            document.body.appendChild(mediaElement);

            mediaElement.play().then(() => {
                registerMediaSession('video');
                drawFrame();
            }).catch(err => {
                startAudioKeepAlive();
            });

        } catch (err) {
            console.error('[Vivo Tab Keeper] Video error:', err);
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

        } catch (err) {
            console.error('[Vivo Tab Keeper] Audio error:', err);
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
                title: '🛡️ Vivo Tab Keeper (' + type + ')',
                artist: 'Protecting tabs',
                album: 'All-Site Protection',
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

        } catch (err) {
            console.error('[Vivo Tab Keeper] MediaSession error:', err);
        }
    }

    // ============ COMPUTATION INTERVAL ============
    function startComputationInterval() {
        const compInterval = setInterval(() => {
            if (!isActive) return;

            let result = 0;
            for (let i = 0; i < 100; i++) {
                result += Math.sqrt(i);
            }

        }, 5000);

        intervals.push(compInterval);
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
    }

    // ============ ACTIVITY INTERVALS ============
    function startActivityIntervals() {
        const activityInterval = setInterval(() => {
            if (!isActive) return;

            try {
                sessionStorage.setItem('vivo_tab_keeper_heartbeat_v34', Date.now().toString());
            } catch (e) {}

            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            tempDiv.setAttribute('data-timestamp', String(Date.now()));
            if (document.body) {
                document.body.appendChild(tempDiv);
                document.body.removeChild(tempDiv);
            }

        }, CONFIG.activityInterval);

        intervals.push(activityInterval);
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

        const canvas = document.getElementById('vtk-canvas-v34');
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
        // Silent
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
