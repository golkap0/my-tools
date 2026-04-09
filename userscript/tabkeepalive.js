// ==UserScript==
// @name         Vivo Tab Keeper v3.5.3 - Zero Intervention
// @namespace    http://tampermonkey.net/
// @version      3.5.3
// @description  Mencegah tab reload VIVO tanpa mengganggu volume video/audio lain
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
        try { return window.self !== window.top; } catch (e) { return true; }
    }
    if (isInsideIFrame()) return;

    const CONFIG = {
        activityInterval: 30000,
        autoStart: true,
        showIndicator: true,
        bottomPos: '7cm'
    };

    let isActive = false;
    let audioCtx = null;
    let source = null;
    let intervals = [];
    let indicatorElement = null;

    // ============ INISIALISASI ============
    function init() {
        if (window.__vivoTabKeeperActive) return;
        window.__vivoTabKeeperActive = true;

        if (CONFIG.showIndicator) createIndicator();
        if (CONFIG.autoStart) setTimeout(() => activateKeepAlive(), 2000);

        // Resume audio context jika tab kembali fokus (syarat browser modern)
        document.addEventListener('visibilitychange', () => {
            if (isActive && audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        });
    }

    // ============ AUDIO ENGINE (ZERO INTERVENTION) ============
    function startAudioKeepAlive() {
        try {
            if (!audioCtx) {
                // Gunakan Web Audio API karena tidak mengintervensi tag <video> atau <audio> bawaan web
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                
                // Buat buffer sunyi murni (0,05 detik saja cukup)
                const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
                
                source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;

                // GainNode diatur sangat rendah agar OS melihat aktivitas tapi tidak melakukan ducking volume
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = 0.0001; 

                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                source.start();
            }

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        } catch (err) {
            console.error('[VTK] Audio Error:', err);
        }
    }

    function stopAudioKeepAlive() {
        if (source) {
            try { source.stop(); } catch(e) {}
            source = null;
        }
        if (audioCtx) {
            try { audioCtx.close(); } catch(e) {}
            audioCtx = null;
        }
    }

    // ============ UI INDIKATOR (7CM) ============
    function createIndicator() {
        if (document.getElementById('vtk-indicator')) return;
        
        const btn = document.createElement('div');
        btn.id = 'vtk-indicator';
        btn.textContent = '💤';
        
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: CONFIG.bottomPos,
            right: '15px',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(33, 150, 243, 0.5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '2147483647',
            cursor: 'pointer',
            fontSize: '20px',
            backdropFilter: 'blur(5px)',
            webkitBackdropFilter: 'blur(5px)',
            border: '2px solid white',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            transition: 'all 0.3s',
            userSelect: 'none',
            touchAction: 'none'
        });

        btn.onclick = (e) => {
            e.preventDefault();
            toggleKeepAlive();
        };

        (document.body || document.documentElement).appendChild(btn);
        indicatorElement = btn;
    }

    function updateUI(active) {
        if (!indicatorElement) return;
        if (active) {
            indicatorElement.textContent = '🛡️';
            indicatorElement.style.background = 'rgba(76, 175, 80, 0.7)';
            indicatorElement.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.8)';
        } else {
            indicatorElement.textContent = '💤';
            indicatorElement.style.background = 'rgba(33, 150, 243, 0.5)';
            indicatorElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        }
    }

    // ============ CORE CONTROL ============
    function activateKeepAlive() {
        if (isActive) return;
        isActive = true;
        
        startAudioKeepAlive();
        
        const task = setInterval(() => {
            if (!isActive) return;
            try {
                // Heartbeat storage sangat ringan
                sessionStorage.setItem('vtk_heartbeat', Date.now());
            } catch (e) {}
        }, CONFIG.activityInterval);
        
        intervals.push(task);
        updateUI(true);
    }

    function deactivateKeepAlive() {
        isActive = false;
        stopAudioKeepAlive();
        intervals.forEach(clearInterval);
        intervals = [];
        updateUI(false);
    }

    function toggleKeepAlive() {
        isActive ? deactivateKeepAlive() : activateKeepAlive();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
