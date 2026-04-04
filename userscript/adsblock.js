// ==UserScript==
// @name         uBlock_Ultra_Indo_Mega_Engine
// @namespace    uBlock.Ultra.Indo
// @version      8.0
// @description  Full uBlock Filters + ABP Indo + Anti-Anti-Adblock + Custom Ads Fix
// @author       User
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. DAFTAR URL FILTER LENGKAP (uBlock + ABP Indo)
    var filterURLs = [
        "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
        "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
        "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
        "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt",
        "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt",
        "https://raw.githubusercontent.com/ABPindo/indonesianadblockrules/master/subscriptions/abpindo.txt"
    ];

    // 2. STEALTH & FAKE AD SYSTEM (Bypass Detection)
    var noop = function() {};
    window.canRunAds = true;
    window.isAdBlockerPresent = false;
    window.adsbygoogle = { push: noop, loaded: true, length: 0 };
    
    // Menipu website agar mengira iklan tampil (getComputedStyle Spoofing)
    var nativeGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function(el) {
        var style = nativeGetComputedStyle(el);
        if (el.className && (el.className.indexOf('ad') !== -1 || el.className.indexOf('adsbygoogle') !== -1)) {
            var fakeStyle = Object.create(style);
            Object.defineProperty(fakeStyle, 'display', { value: 'block', writable: false });
            Object.defineProperty(fakeStyle, 'visibility', { value: 'visible', writable: false });
            Object.defineProperty(fakeStyle, 'height', { value: '250px', writable: false });
            return fakeStyle;
        }
        return style;
    };

    // 3. FUNGSI DOWNLOAD & PARSING (Support Local Storage)
    function fetchAndApplyFilters() {
        var cached = localStorage.getItem('ub_full_css');
        var lastUpdate = localStorage.getItem('ub_full_time');
        var now = new Date().getTime();

        if (cached) injectCSS(JSON.parse(cached));

        if (!cached || (now - lastUpdate > 86400000)) {
            var allSelectors = [];
            var completed = 0;

            filterURLs.forEach(function(url) {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        var lines = xhr.responseText.split('\n');
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i].trim();
                            // Ambil aturan Cosmetic (##) dan hindari aturan rumit yang bikin lag
                            if (line.indexOf('##') === 0 && line.indexOf(':') === -1) {
                                var s = line.substring(2);
                                if (s.length > 1) allSelectors.push(s);
                            }
                        }
                        completed++;
                        if (completed === filterURLs.length) {
                            localStorage.setItem('ub_full_css', JSON.stringify(allSelectors));
                            localStorage.setItem('ub_full_time', now.toString());
                        }
                    }
                };
                xhr.send();
            });
        }
    }

    // 4. INJEKSI CSS (STEALTH MODE)
    function injectCSS(selectors) {
        if (!selectors || selectors.length === 0) return;
        var style = document.getElementById('ub-mega-engine') || document.createElement('style');
        style.id = 'ub-mega-engine';
        // Menggunakan teknik 'absolute positioning' agar iklan tidak memakan ruang tapi web mengira iklan ada
        style.textContent = selectors.join(', ') + ", [class*='-ad-'], [id*='-ad-'], ins.adsbygoogle, div[data-adunit], .mgid-tag, .taboola-main-container { position: absolute !important; left: -9999px !important; top: -9999px !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; height: 1px !important; width: 1px !important; }";
        (document.head || document.documentElement).appendChild(style);
    }

    // 5. CUSTOM ADS SCANNER (Menangkap Iklan Tidak Populer)
    function scanCustomAds() {
        // Cari elemen berdasarkan atribut umum iklan
        var tags = document.querySelectorAll('iframe, div, ins, aside');
        for (var i = 0; i < tags.length; i++) {
            var el = tags[i];
            var src = el.src || "";
            var id = el.id || "";
            var cls = el.className || "";

            // Deteksi berdasarkan kata kunci provider tidak populer
            var adKeywords = /ad-system|proads|mgid|propeller|popads|click-under|adsterra|ad-track|sponsored|banner/i;
            
            if (adKeywords.test(src) || adKeywords.test(id) || adKeywords.test(cls)) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('height', '0', 'important');
            }
        }
    }

    // 6. ANTI-ADBLOCK MODAL REMOVER
    function removeAnnoyances() {
        var overlays = document.querySelectorAll('div[style*="z-index"], div[class*="modal"], div[class*="overlay"]');
        var keywords = ['adblock', 'matikan iklan', 'menonaktifkan iklan', 'whitelist', 'blocking'];
        
        for (var i = 0; i < overlays.length; i++) {
            var el = overlays[i];
            var text = el.innerText ? el.innerText.toLowerCase() : "";
            for (var j = 0; j < keywords.length; j++) {
                if (text.indexOf(keywords[j]) !== -1 && text.length < 600) {
                    el.remove();
                    document.body.style.setProperty('overflow', 'auto', 'important');
                    document.documentElement.style.setProperty('overflow', 'auto', 'important');
                }
            }
        }
    }

    // EKSEKUSI ENGINE
    fetchAndApplyFilters();

    // Jalankan pembersihan berkala
    setInterval(function() {
        scanCustomAds();
        removeAnnoyances();
    }, 1500);

    document.addEventListener('DOMContentLoaded', function() {
        scanCustomAds();
        removeAnnoyances();
    });

})();
