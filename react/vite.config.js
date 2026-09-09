var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
// Single source of truth for the app version shown in-app (Help & Guide):
// read package.json at build time and inline it as the global __APP_VERSION__.
var pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
    plugins: [
        react(),
        {
            // Emit dist/version.json so the running app can detect when a newer
            // build has been deployed (UpdateBanner polls it). Build-only; the dev
            // server won't serve it, and the banner degrades to a no-op there.
            name: 'vyact-version-json',
            generateBundle: function () {
                this.emitFile({
                    type: 'asset',
                    fileName: 'version.json',
                    source: JSON.stringify({ version: pkg.version }),
                });
            },
        },
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: false, // we register manually via src/lib/pwa.ts to wire update + install UX
            includeAssets: ['favicon.svg'],
            manifest: {
                id: '/',
                name: 'Vyact — Family Finance OS',
                short_name: 'Vyact',
                description: 'Household finance, planned together. Track spend, budgets, debts, goals, and net worth across the family.',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
                orientation: 'portrait',
                background_color: '#FAF7F2',
                theme_color: '#E26D5C',
                lang: 'en',
                dir: 'ltr',
                categories: ['finance', 'productivity', 'lifestyle'],
                prefer_related_applications: false,
                icons: [
                    // SVG counts toward Chrome / Edge installability since 2022; PNG
                    // 192/512 entries can be added under /public/icons/ later for
                    // richer install UI and iOS home-screen tiles.
                    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
                ],
                shortcuts: [
                    { name: 'Add transaction', short_name: 'Add', url: '/transactions?add=1', description: 'Quick add a new transaction' },
                    { name: 'Dashboard', short_name: 'Home', url: '/', description: 'Open the dashboard' },
                    { name: 'Reports', short_name: 'Reports', url: '/reports', description: 'Open reports' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: false, // we surface an update prompt via UpdateBanner instead of auto-reloading
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /version\.json$/],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.origin === 'https://fonts.googleapis.com';
                        },
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'google-fonts-stylesheets' },
                    },
                    {
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.origin === 'https://fonts.gstatic.com';
                        },
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Supabase reads — network-first so users always see latest data
                        // when online, but still get a cached fallback when offline.
                        //
                        // Audit S5 — the SW cache is URL-keyed and NOT auth-aware: two
                        // users on one browser share an origin, so a cached REST response
                        // could be served to the second user. Never cache an AUTHORISED
                        // request. The offline fallback still works for public reads
                        // (apikey-only, e.g. /learn content); household data is covered
                        // by the app's own outbox+cache layer, not the SW.
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return /supabase\.co\/rest\/v1\//.test(url.href);
                        },
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-api',
                            networkTimeoutSeconds: 4,
                            expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
                            cacheableResponse: { statuses: [0, 200] },
                            matchOptions: {
                                // An authenticated request never matches a cache entry.
                                ignoreSearch: false,
                            },
                            plugins: [{
                                    // Workbox plugin hook: only put UNauthenticated responses in
                                    // the cache. An Authorization/apikey-bearing request (every
                                    // household-scoped read) is fetched, returned, and never
                                    // stored — so a second user on this browser cannot be served
                                    // the first user's cached rows.
                                    cacheWillUpdate: function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                                        var request = _b.request, response = _b.response;
                                        return __generator(this, function (_c) {
                                            if (request.headers.has('authorization'))
                                                return [2 /*return*/, null];
                                            return [2 /*return*/, response.status === 200 ? response : null];
                                        });
                                    }); },
                                }],
                        },
                    },
                ],
            },
            devOptions: {
                enabled: false, // dev SW disabled by default to avoid HMR weirdness; flip to true to test offline locally
                type: 'module',
            },
        }),
    ],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    // host: '::' binds to dual-stack (both IPv4 0.0.0.0 and IPv6 ::1) so
    // `localhost` resolves regardless of which stack the browser picks.
    // `host: true` would bind IPv4-only and leave ::1 unreachable on Windows.
    server: { port: 5173, host: '::', open: true },
    build: { outDir: 'dist', sourcemap: true, target: 'esnext' },
});
