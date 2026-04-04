// ==UserScript==
// @name         Fix Image Freeze (Text Select OK)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Hanya blokir popup gambar (penyebab freeze), teks tetap bisa dicopy-paste
// @author       User
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. Hanya matikan fitur popup pada elemen GAMBAR (IMG)
    // CSS ini tidak akan mengganggu teks
    const style = document.createElement('style');
    style.innerHTML = `
        img, a img {
            -webkit-touch-callout: none !important; 
        }
    `;
    document.documentElement.appendChild(style);

    // 2. Blokir menu konteks HANYA jika yang ditekan lama adalah gambar
    window.addEventListener('contextmenu', function(e) {
        // Cek apakah yang ditekan adalah gambar
        if (e.target.tagName === 'IMG' || e.target.closest('img')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Jika yang ditekan adalah teks atau kolom input, biarkan saja (jangan diblokir)
    }, true);

    // 3. Pastikan kolom input dan teks tetap bisa disentuh/difokuskan
    window.addEventListener('touchstart', function(e) {
        // Biarkan sistem bekerja normal untuk teks dan input
    }, {passive: true});

})();
