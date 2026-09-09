// ==================== UI HELPERS & PWA OPERATIONS ====================

import { store } from './store.js';

export function showSyncStatus(msg, isError) {
    const el = document.getElementById('syncStatus');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden', 'bg-gray-800', 'bg-red-600');
        el.classList.add(isError ? 'bg-red-600' : 'bg-gray-800');
        setTimeout(() => el.classList.add('hidden'), 3000);
    }
}

export function showFirebaseWarningBanner() {
    const existing = document.getElementById("firebaseWarningBanner");
    if (existing) return;
    const banner = document.createElement("div");
    banner.id = "firebaseWarningBanner";
    banner.className = "bg-amber-500 text-white text-center py-2 px-4 text-sm font-bold sticky top-0 z-50 flex justify-between items-center";
    banner.innerHTML = `
        <span>⚠️ İnternet bağlantısı algılanamadı veya bulut veri tabanına bağlanılamadı. Çevrimdışı modda çalışıyorsunuz. Verileriniz yerel kaydediliyor.</span>
        <button onclick="document.getElementById('firebaseWarningBanner').remove()" class="bg-amber-700 px-3 py-1 rounded text-xs font-bold hover:bg-amber-800 transition">Kapat</button>
    `;
    document.body.prepend(banner);
}

export function showLocalDevelopmentBanner() {
    if (document.getElementById("localDevelopmentBanner")) return;

    const banner = document.createElement("div");
    banner.id = "localDevelopmentBanner";
    banner.className = "bg-indigo-600 text-white text-center py-2 px-4 text-sm font-semibold sticky top-0 z-50 flex justify-between items-center gap-3";

    const message = document.createElement("span");
    message.textContent = "🛠️ Geliştirme modu: Bulut bağlantısı kapalıdır; veriler yalnızca bu tarayıcıda saklanır.";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "bg-indigo-800 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-900 transition";
    closeButton.textContent = "Kapat";
    closeButton.addEventListener("click", () => banner.remove());

    banner.append(message, closeButton);
    document.body.prepend(banner);
}

export function handleFirebaseError(err) {
    console.error("Firebase error details:", err);
    if (err && (err.code === "unavailable" || err.message.includes("Failed to get document"))) {
        showFirebaseWarningBanner();
    }
}

export function toggleTheme() {
    store.darkMode = !store.darkMode;
    localStorage.setItem('darkMode', store.darkMode);
    applyTheme();
    
    // We import renderer dynamically or call the global renderers
    if (window.renderHomeScreen && store.currentPage === 'home') window.renderHomeScreen();
    else if (window.renderSchedulePage && store.currentPage === 'schedule') window.renderSchedulePage();
    else if (window.renderStudentPanel && store.currentPage === 'student' && store.currentStudentId) window.renderStudentPanel(store.currentStudentId);
    else if (window.renderDersKayitlari && store.currentPage === 'dersKayitlari') window.renderDersKayitlari();
    else if (window.renderDersDetay && store.currentPage === 'dersDetay' && window._currentDersKayitStudentId) window.renderDersDetay(window._currentDersKayitStudentId);
    else if (window.renderGenelIslemler && store.currentPage === 'general') window.renderGenelIslemler();
    else if (window.renderOdevTakibi && store.currentPage === 'odevTakibi') window.renderOdevTakibi();
    else if (window.renderStudentOdevDetay && store.currentPage === 'studentOdevDetay' && window._currentOdevStudentId) window.renderStudentOdevDetay(window._currentOdevStudentId);
    else if (window.renderReminderHome) window.renderReminderHome();

    const themeBtn = document.getElementById('themeBtnText');
    if (themeBtn) themeBtn.textContent = store.darkMode ? 'Açık Mod' : 'Koyu Mod';
}

export function applyTheme() {
    if (store.darkMode) {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
}

// PWA service worker registration & update management
export let deferredPrompt = null;

export function registerPWA() {
    if ('serviceWorker' in navigator) {
        // Auto-reload the page when the new service worker takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });

        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
        .then(reg => {
            console.log('Service Worker Registered Successfully', reg.scope);
            reg.update().catch(err => console.warn('Service Worker update check failed', err));
            // Service Worker update detection
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        const updateBanner = document.getElementById('pwaUpdateBanner');
                        if (updateBanner) updateBanner.classList.remove('hidden');
                    }
                });
            });
        })
        .catch(err => console.warn('Service Worker registration failed', err));
    }
}

export function triggerPWAInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the PWA install');
            }
            deferredPrompt = null;
            dismissPWAInstall();
        });
    }
}

export function dismissPWAInstall() {
    const installBanner = document.getElementById('pwaInstallBanner');
    if (installBanner) installBanner.classList.add('hidden');
    sessionStorage.setItem('pwa_install_dismissed', 'true');
}

export function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (navigator.onLine) {
        if (offlineIndicator && !offlineIndicator.classList.contains('hidden')) {
            offlineIndicator.classList.add('hidden');
            showSyncStatus("✅ İnternet bağlantısı sağlandı. Çevrimiçi moda geçildi.", false);
        }
    } else {
        if (offlineIndicator) {
            offlineIndicator.classList.remove('hidden');
            showSyncStatus("⚠️ İnternet bağlantısı kesildi. Çevrimdışı çalışılıyor.", true);
        }
    }
}

export let userHasNavigatedDuringStartup = false;

export function markStartupUserNavigation() {
    userHasNavigatedDuringStartup = true;
}

export function resetStartupUserNavigation() {
    userHasNavigatedDuringStartup = false;
}

export function isStartupNavigationElement(element) {
    if (!element || typeof element.closest !== 'function') return false;
    return Boolean(element.closest('[data-app-nav="true"], #sidebar-nav-reminders, #sidebar-nav-home, #sidebar-nav-guidance, #sidebar-nav-groups, #sidebar-nav-schedule, #sidebar-nav-homework, #sidebar-nav-lessons, #sidebar-nav-general, #topbar-nav-general, #mobile-nav-reminders, #mobile-nav-home, #mobile-nav-guidance, #mobile-nav-schedule, #mobile-nav-homework, #mobile-nav-lessons, #mobile-nav-general'));
}

export function shouldRenderInitialView(options = {}) {
    if (typeof options === 'object' && options !== null && ('initialViewRendered' in options || 'userHasNavigatedDuringStartup' in options)) {
        if (options.initialViewRendered) return false;
        if (options.userHasNavigatedDuringStartup) return false;
        return true;
    }
    const userNav = arguments.length > 1 ? arguments[1] : userHasNavigatedDuringStartup;
    if (userNav) return false;
    if (typeof options === 'boolean') {
        return !options;
    }
    return true;
}

// Global PWA Listeners and window bindings
if (typeof window !== 'undefined') {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('load', updateOnlineStatus);

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!sessionStorage.getItem('pwa_install_dismissed')) {
            const installBanner = document.getElementById('pwaInstallBanner');
            if (installBanner) installBanner.classList.remove('hidden');
        }
    });

    window.showSyncStatus = showSyncStatus;
    window.showFirebaseWarningBanner = showFirebaseWarningBanner;
    window.showLocalDevelopmentBanner = showLocalDevelopmentBanner;
    window.handleFirebaseError = handleFirebaseError;
    window.toggleTheme = toggleTheme;
    window.applyTheme = applyTheme;
    window.registerPWA = registerPWA;
    window.triggerPWAInstall = triggerPWAInstall;
    window.dismissPWAInstall = dismissPWAInstall;
    window.updateOnlineStatus = updateOnlineStatus;
    window.shouldRenderInitialView = shouldRenderInitialView;
    window.isStartupNavigationElement = isStartupNavigationElement;
    window.markStartupUserNavigation = markStartupUserNavigation;
    window.resetStartupUserNavigation = resetStartupUserNavigation;
}
