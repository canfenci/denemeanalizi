// ==================== AUTHENTICATION & LOGIN SCREEN ====================

import { auth, isFirebaseActive } from './firebase-config.js';
import { store, localDataKey } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { PRIVACY_NOTICE_VERSION } from './privacy-notice.js';

export function renderLoginScreen() {
    store.currentPage = "login";
    const sidebar = document.querySelector('#app-root > div.hidden.md\\:flex');
    if (sidebar) sidebar.style.display = 'none';
    const bottomNav = document.querySelector('#app-root > div.flex.md\\:hidden');
    if (bottomNav) bottomNav.style.display = 'none';
    const mainContent = document.querySelector('#app-root > div.w-full.md\\:w-3\\/4');
    if (mainContent) {
        mainContent.className = "app-workspace w-full p-6 overflow-y-auto pb-6";
    }

    const html = `
    <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border mt-10">
        <div class="text-center border-b pb-4 mb-6">
            <div class="text-3xl font-black text-blue-600 dark:text-blue-400 logo-canfenci">
                <span class="can-part">Can</span><span class="fenci-part">fenci</span>
            </div>
            <div class="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">Bulut Giriş Paneli</div>
        </div>
        
        <!-- Auth Tabs -->
        <div class="flex border-b mb-6 text-sm font-semibold">
            <button onclick="switchAuthTab('login')" id="tabLogin" class="flex-1 pb-2.5 text-center border-b-2 border-blue-600 text-blue-600 dark:text-blue-400">
                Giriş Yap
            </button>
            <button onclick="switchAuthTab('register')" id="tabRegister" class="flex-1 pb-2.5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                Kayıt Ol
            </button>
        </div>

        <div id="loginError" class="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-xl mb-4 text-sm hidden"></div>
        
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📧 E-posta</label>
                <input type="email" id="loginEmail" placeholder="ornek@canfenci.com" class="student-form-input">
            </div>
            <div>
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">🔑 Şifre</label>
                <input type="password" id="loginPassword" placeholder="••••••••" class="student-form-input">
            </div>
            <div id="forgotPasswordContainer" class="text-right -mt-2">
                <button type="button" onclick="handlePasswordReset()" class="min-h-[44px] px-1 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Şifremi unuttum</button>
            </div>
            <div id="confirmPasswordContainer" class="hidden">
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">🔑 Şifre Tekrar</label>
                <input type="password" id="loginConfirmPassword" placeholder="••••••••" class="student-form-input">
            </div>
            <div id="registerBranchesContainer" class="hidden">
                <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">📚 Ders Vereceğiniz Branşlar</label>
                <div class="flex flex-wrap gap-3 p-2 bg-gray-50 dark:bg-gray-900/30 rounded-xl border dark:border-gray-700 mb-2">
                    <label class="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" id="registerBranchTur" value="Türkçe" checked class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                        <span class="text-xs font-semibold text-gray-800 dark:text-gray-200">Türkçe</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" id="registerBranchMath" value="Matematik" checked class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                        <span class="text-xs font-semibold text-gray-800 dark:text-gray-200">Matematik</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" id="registerBranchScience" value="Fen Bilimleri" checked class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                        <span class="text-xs font-semibold text-gray-800 dark:text-gray-200">Fen</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" id="registerBranchSoc" value="Sosyal Bilgiler" checked class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                        <span class="text-xs font-semibold text-gray-800 dark:text-gray-200">Sosyal Bilgiler</span>
                    </label>
                </div>
                <label class="mt-3 flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 cursor-pointer">
                    <input type="checkbox" id="privacyNoticeAcknowledged" class="mt-0.5 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500">
                    <span class="text-xs leading-5 text-gray-600 dark:text-gray-300"><button type="button" onclick="event.preventDefault(); event.stopPropagation(); showPrivacyNotice()" class="font-black text-indigo-600 dark:text-indigo-400 underline">KVKK Aydınlatma Metni</button>ni okudum. Bunun açık rıza değil, veri işleme hakkında bilgilendirme olduğunu biliyorum.</span>
                </label>
            </div>
            
            <button id="authActionButton" onclick="handleLogin()" class="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2">
                <i class="fas fa-sign-in-alt"></i> Giriş Yap
            </button>
            
            <div class="relative flex py-2 items-center">
                <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                <span class="flex-shrink mx-4 text-gray-400 text-sm text-center">Veya</span>
                <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            
            <button onclick="continueOffline()" class="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2.5 rounded-xl transition text-sm">
                <i class="fas fa-user-secret mr-1"></i> Misafir Olarak Dene
            </button>
            <p class="text-xs text-center text-gray-500 dark:text-gray-400">Kayıt olmadan uygulamayı inceleyin. Misafir verileri yalnızca bu cihazda saklanır ve bulut hesaplarıyla paylaşılmaz.</p>
            <button type="button" onclick="showPrivacyNotice()" class="w-full min-h-[44px] text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline">Gizlilik ve KVKK Aydınlatma Metni</button>
        </div>
    </div>`;
    document.getElementById("dynamic-content").innerHTML = html;

    const flashMessage = sessionStorage.getItem('canfenci_auth_flash_v1');
    if (flashMessage) {
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.textContent = flashMessage;
            loginError.classList.remove('hidden');
        }
    }
}

export function switchAuthTab(mode) {
    store.authMode = mode;
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const confirmContainer = document.getElementById("confirmPasswordContainer");
    const branchesContainer = document.getElementById("registerBranchesContainer");
    const forgotPasswordContainer = document.getElementById("forgotPasswordContainer");
    const actionBtn = document.getElementById("authActionButton");
    const errDiv = document.getElementById("loginError");
    
    if (errDiv) errDiv.classList.add("hidden");
 
    if (mode === "login") {
        if (tabLogin) tabLogin.className = "flex-1 pb-2.5 text-center border-b-2 border-blue-600 text-blue-600 dark:text-blue-400";
        if (tabRegister) tabRegister.className = "flex-1 pb-2.5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";
        if (confirmContainer) confirmContainer.classList.add("hidden");
        if (branchesContainer) branchesContainer.classList.add("hidden");
        if (forgotPasswordContainer) forgotPasswordContainer.classList.remove("hidden");
        if (actionBtn) {
            actionBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Giriş Yap`;
            actionBtn.setAttribute("onclick", "handleLogin()");
        }
    } else {
        if (tabRegister) tabRegister.className = "flex-1 pb-2.5 text-center border-b-2 border-blue-600 text-blue-600 dark:text-blue-400";
        if (tabLogin) tabLogin.className = "flex-1 pb-2.5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";
        if (confirmContainer) confirmContainer.classList.remove("hidden");
        if (branchesContainer) branchesContainer.classList.remove("hidden");
        if (forgotPasswordContainer) forgotPasswordContainer.classList.add("hidden");
        if (actionBtn) {
            actionBtn.innerHTML = `<i class="fas fa-user-plus"></i> Kayıt Ol (Bulut Kurulumu)`;
            actionBtn.setAttribute("onclick", "handleRegister()");
        }
    }
}

export async function handlePasswordReset() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const feedback = document.getElementById('loginError');
    if (!feedback) return;

    if (!email) {
        feedback.textContent = 'Şifre sıfırlama bağlantısı için önce e-posta adresinizi yazın.';
        feedback.className = 'bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-4 py-2.5 rounded-xl mb-4 text-sm';
        document.getElementById('loginEmail')?.focus();
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email, {
            url: 'https://canfenci.github.io/ogrenci-takip/',
            handleCodeInApp: false
        });
        feedback.textContent = 'Bu adresle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutusu ve spam klasörünü kontrol edin.';
        feedback.className = 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-2.5 rounded-xl mb-4 text-sm';
    } catch (err) {
        console.error('Password reset failed:', err);
        if (err.code === 'auth/invalid-email') {
            feedback.textContent = 'Geçerli bir e-posta adresi yazın.';
        } else if (err.code === 'auth/too-many-requests') {
            feedback.textContent = 'Çok fazla istek gönderildi. Bir süre bekleyip tekrar deneyin.';
        } else {
            // Do not reveal whether an account exists for the supplied address.
            feedback.textContent = 'Şifre sıfırlama isteği şu anda gönderilemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin.';
        }
        feedback.className = 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-2.5 rounded-xl mb-4 text-sm';
    }
}

export async function handleLogin() {
    store.isGuestMode = false;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errDiv = document.getElementById("loginError");
    sessionStorage.removeItem('canfenci_auth_flash_v1');
    errDiv.classList.add("hidden");

    if (!email || !password) {
        errDiv.textContent = "E-posta ve şifre giriniz.";
        errDiv.classList.remove("hidden");
        return;
    }

    try {
        showSyncStatus("Giriş yapılıyor...", false);
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        let user = userCredential.user;
        
        // Safari may initially expose a stale verification flag. Refresh the
        // user from Firebase before deciding to reject an otherwise valid login.
        await user.reload();
        user = auth.currentUser || user;

        // Email Verification Check
        if (!user.emailVerified) {
            try {
                await user.sendEmailVerification();
            } catch (verificationError) {
                console.warn('Verification email could not be resent:', verificationError);
            }
            sessionStorage.setItem('canfenci_auth_flash_v1', "E-posta adresiniz henüz doğrulanmamış. Yeni doğrulama e-postası gönderildi.");
            await auth.signOut();
            renderLoginScreen();
            return;
        }

        // Authentication is complete. Restore navigation immediately instead
        // of keeping Safari on the navigation-hidden login layout while the
        // Firestore profile request is still pending.
        restoreNavigationLayout();
        renderAppLoadingState();

        // Fetch user branches from Firestore users collection
        if (window.isFirebaseActive && window.db) {
            try {
                const doc = await window.db.collection("users").doc(user.uid).get();
                if (doc.exists && doc.data().branches) {
                    const branches = doc.data().branches;
                    localStorage.setItem('teacher_branches_v1', JSON.stringify(branches));
                    store.teacherBranches = branches;
                }
            } catch (err) {
                console.error("Error loading branches on login:", err);
            }
        }

        showSyncStatus("Giriş başarılı!", false);
        if (window.initializeFirestoreSync) {
            await window.initializeFirestoreSync();
        }
    } catch (err) {
        console.error(err);
        let msg = "Giriş başarısız: " + err.message;
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
            msg = "Hatalı e-posta veya şifre.";
        }
        errDiv.textContent = msg;
        errDiv.classList.remove("hidden");
    }
}

export async function handleRegister() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const confirmPassword = document.getElementById("loginConfirmPassword").value;
    const errDiv = document.getElementById("loginError");
    errDiv.classList.add("hidden");

    if (!email || !password || !confirmPassword) {
        errDiv.textContent = "Kaydolmak için e-posta, şifre ve şifre tekrarını giriniz.";
        errDiv.classList.remove("hidden");
        return;
    }

    if (password.length < 6) {
        errDiv.textContent = "Şifre en az 6 karakter olmalıdır.";
        errDiv.classList.remove("hidden");
        return;
    }

    if (password !== confirmPassword) {
        errDiv.textContent = "Şifreler uyuşmuyor. Lütfen tekrar kontrol edin.";
        errDiv.classList.remove("hidden");
        return;
    }

    if (!document.getElementById('privacyNoticeAcknowledged')?.checked) {
        errDiv.textContent = 'Kayıt olmadan önce KVKK Aydınlatma Metnini okuyup bilgilendirme kutusunu işaretleyin.';
        errDiv.classList.remove('hidden');
        return;
    }

    const branches = [];
    if (document.getElementById("registerBranchTur")?.checked) branches.push("Türkçe");
    if (document.getElementById("registerBranchMath")?.checked) branches.push("Matematik");
    if (document.getElementById("registerBranchScience")?.checked) branches.push("Fen Bilimleri");
    if (document.getElementById("registerBranchSoc")?.checked) branches.push("Sosyal Bilgiler");
    
    if (branches.length === 0) {
        errDiv.textContent = "Lütfen en az bir ders/branş seçiniz.";
        errDiv.classList.remove("hidden");
        return;
    }

    try {
        showSyncStatus("Kaydolunuyor...", false);
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save selected branches in user settings
        if (window.isFirebaseActive && window.db) {
            await window.db.collection("users").doc(user.uid).set({
                email: email,
                branches: branches,
                privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
                privacyNoticeAcknowledgedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });
        }
        
        // Save locally
        localStorage.setItem('teacher_branches_v1', JSON.stringify(branches));
        store.teacherBranches = branches;

        // Send verification email
        await user.sendEmailVerification();
        // Sign out immediately so they must verify
        await auth.signOut();
        
        alert("Kayıt başarıyla oluşturuldu! \n\nLütfen e-posta adresinize (veya spam klasörünüze) gönderilen doğrulama bağlantısına tıklayarak hesabınızı aktif edin. Doğrulama yapmadan sisteme giriş yapamazsınız.");
        
        // Switch tab back to login
        switchAuthTab("login");
        document.getElementById("loginPassword").value = "";
        document.getElementById("loginConfirmPassword").value = "";
    } catch (err) {
        console.error(err);
        errDiv.textContent = "Kayıt başarısız: " + err.message;
        errDiv.classList.remove("hidden");
    }
}

export function continueOffline() {
    store.isGuestMode = true;
    store.useFirestore = false;
    store.globalStudents = [];
    store.globalHomeworks = [];
    store.globalSchedules = {};
    store.globalLessons = {};
    store.globalGroups = [];

    const guestBranches = ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"];
    if (!localStorage.getItem(localDataKey('teacher_profile_completed_v1'))) {
        localStorage.setItem(localDataKey('teacher_name_v1'), 'Misafir Öğretmen');
        localStorage.setItem(localDataKey('teacher_school_v1'), 'Demo Okulu');
        localStorage.setItem(localDataKey('teacher_branches_v1'), JSON.stringify(guestBranches));
        localStorage.setItem(localDataKey('teacher_profile_completed_v1'), 'true');
    }
    store.teacherName = localStorage.getItem(localDataKey('teacher_name_v1')) || 'Misafir Öğretmen';
    store.teacherSchool = localStorage.getItem(localDataKey('teacher_school_v1')) || 'Demo Okulu';
    try { store.teacherBranches = JSON.parse(localStorage.getItem(localDataKey('teacher_branches_v1'))) || guestBranches; }
    catch (_) { store.teacherBranches = guestBranches; }

    showSyncStatus("Misafir modu aktif. Veriler yalnızca bu cihazda saklanır.", false);
    restoreNavigationLayout();
    if (window.ensureTeacherProfile && !window.ensureTeacherProfile()) return;
    if (window.renderHomeScreen) {
        window.renderReminderHome ? window.renderReminderHome() : window.renderHomeScreen();
    }
}

export async function handleLogout() {
    if (confirm("Oturumu kapatmak istediğinize emin misiniz?")) {
        try {
            if (window.resetFirestoreSync) window.resetFirestoreSync();
            await auth.signOut();
            window.location.reload();
        } catch (err) {
            console.error("Sign out error:", err);
        }
    }
}

export function restoreNavigationLayout() {
    const sidebar = document.querySelector('#app-root > div.hidden.md\\:flex');
    if (sidebar) sidebar.style.display = '';
    const bottomNav = document.querySelector('#app-root > div.flex.md\\:hidden');
    if (bottomNav) bottomNav.style.display = '';
    const mainContent = document.querySelector('#app-root > div.w-full.md\\:w-3\\/4');
    if (mainContent) {
        mainContent.className = "app-workspace w-full md:w-3/4 px-5 py-6 md:p-8 pb-36 md:pb-8 overflow-y-auto";
    }
}

export function renderAppLoadingState() {
    const content = document.getElementById('dynamic-content');
    if (!content) return;
    content.setAttribute('aria-busy', 'true');
    content.innerHTML = `
        <div class="min-h-[55vh] flex items-center justify-center px-4">
            <div class="app-panel w-full max-w-md p-7 text-center">
                <div class="mx-auto mb-4 h-11 w-11 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" aria-hidden="true"></div>
                <h1 class="text-lg font-black text-gray-900 dark:text-gray-100">Verileriniz hazırlanıyor</h1>
                <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Hesabınız ve çalışma alanınız güvenli biçimde yükleniyor…</p>
            </div>
        </div>`;
}

export function updateMobileNavActive(activeId) {
    // 1. Normalize IDs and handle legacy routing aliases
    let mobileId = null;
    let sidebarId = null;
    if (activeId) {
        let normalized = activeId;
        if (normalized === 'mobile-nav-schedule' || normalized === 'sidebar-nav-schedule') normalized = 'mobile-nav-lessons';
        if (normalized === 'mobile-nav-groups' || normalized === 'sidebar-nav-groups') normalized = 'mobile-nav-home';
        if (normalized === 'topbar-nav-general' || normalized === 'sidebar-nav-general' || normalized === 'general' || normalized === 'settings') {
            mobileId = 'topbar-nav-general';
            sidebarId = 'sidebar-nav-general';
        } else if (normalized.startsWith('mobile-nav-')) {
            mobileId = normalized;
            sidebarId = normalized.replace('mobile-nav-', 'sidebar-nav-');
        } else if (normalized.startsWith('sidebar-nav-')) {
            sidebarId = normalized;
            mobileId = normalized.replace('sidebar-nav-', 'mobile-nav-');
        } else {
            mobileId = normalized;
            sidebarId = normalized;
        }
    }

    // 2. Update mobile bottom navigation buttons and topbar actions
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-600', 'dark:text-blue-400', 'active');
        btn.classList.add('text-gray-500');
    });
    const topbarSettingsBtn = document.getElementById('topbar-nav-general');
    if (topbarSettingsBtn) {
        if (mobileId === 'topbar-nav-general') {
            topbarSettingsBtn.classList.add('bg-white/25', 'ring-2', 'ring-white/40');
        } else {
            topbarSettingsBtn.classList.remove('bg-white/25', 'ring-2', 'ring-white/40');
        }
    }
    if (mobileId && mobileId !== 'topbar-nav-general') {
        const activeBtn = document.getElementById(mobileId);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500');
            activeBtn.classList.add('text-blue-600', 'dark:text-blue-400', 'active');
        }
    }

    // 3. Update desktop sidebar buttons
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (sidebarId) {
        const activeSidebarBtn = document.getElementById(sidebarId);
        if (activeSidebarBtn) {
            activeSidebarBtn.classList.add('active');
        }
    }
}

// Bind to window for global accessibility
window.renderLoginScreen = renderLoginScreen;
window.switchAuthTab = switchAuthTab;
window.continueOffline = continueOffline;
window.restoreNavigationLayout = restoreNavigationLayout;
window.renderAppLoadingState = renderAppLoadingState;
window.updateMobileNavActive = updateMobileNavActive;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.handlePasswordReset = handlePasswordReset;
