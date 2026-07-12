// Injects PWA installability tags into the built public/index.html.
// Run AFTER the web build (gulp + cljs + webpack + rsync static/ -> public/),
// because the build regenerates public/index.html from resources/index.html
// and would otherwise wipe our PWA edits.
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Rewrite any /static/ asset paths to root-relative (GitHub Pages silently
// drops files under a `static/` directory, so assets are published at /js,/css,/img).
html = html.replace(/(href|src)="\/static\//g, '$1="/');

// 1) manifest link (idempotent)
if (!html.includes('rel="manifest"')) {
  html = html.replace(
    /(<link[^>]*rel="stylesheet"[^>]*>)/,
    '$1\n  <link rel="manifest" href="/manifest.webmanifest">'
  );
}

// 2) theme-color meta (idempotent)
if (!html.includes('name="theme-color"')) {
  html = html.replace(
    /(<meta[^>]*name="viewport"[^>]*>)/,
    '$1\n  <meta name="theme-color" content="#ffffff">'
  );
}

// 3) service worker registration (idempotent, before </body>)
if (!html.includes('serviceWorker.register')) {
  const swScript = `
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (err) {
        console.warn('[PWA] service worker registration failed:', err);
      });
    });
  }
</script>
`;
  html = html.replace(/<\/body>/, swScript + '</body>');
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('[inject-pwa] updated public/index.html (asset paths + manifest + theme-color + SW)');
