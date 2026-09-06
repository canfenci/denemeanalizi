// ==================== HOMEWORK MANAGEMENT MODULE ====================

import { db, auth, isFirebaseActive } from './firebase-config.js';
import { store, loadStudentsData, saveStudentsData, getStudentOdevler, getKonuListesiBySinifAndDers, escapeHtml } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { updateMobileNavActive } from './auth.js';
import { calculateTopicTestNet } from './topic-exam-insights.js';
import { readResourceSelection, resourceOptionsHtml, toggleManualResource } from './resource-books.js';
import { buildHomeworkErrorTopics, HATA_NEDENLERI, normalizeHomeworkErrorAnalysis, validateErrorAnalysisTotal, normalizeHataNedeniLabel, normalizeHataNedeniKey, getUnitsAndTopicsBySinifAndDers, getUnitListBySinifAndDers, getTopicsForUnit } from './homework-error-topics.js';
import { buildWorkPerformance } from './work-performance-insights.js';
import { buildHomeworkDashboard, filterHomeworkDashboard, getHomeworkDueState } from './homework-dashboard-insights.js';
import { buildHomeworkReportData, normalizeReportFilename, buildWhatsAppReportMessage, generateHomeworkPdf } from './homework-report-insights.js';
import {
    ANCHOR_START_DATE,
    getWeekInfoByNumber,
    getWeekInfoForDate,
    getCurrentWeekNumber,
    generateWeekList,
    resolveHomeworkWeek,
    filterHomeworksCombined
} from './homework-weeks-insights.js';

export function hideNavigationElements() {
    const sidebar = document.querySelector('#app-root > div.hidden.md\\:flex');
    if (sidebar) sidebar.style.display = 'none';
    const bottomNav = document.querySelector('#app-root > div.flex.md\\:hidden');
    if (bottomNav) bottomNav.style.display = 'none';
    const mainContent = document.querySelector('#app-root > div.w-full.md\\:w-3\\/4');
    if (mainContent) {
        mainContent.className = "w-full p-6 overflow-y-auto pb-6";
    }
}

export function renderParentHwPasscodeScreen(hwData) {
    store.currentPage = "parentHwPasscode";
    if (window.currentPage) window.currentPage = "parentHwPasscode";
    hideNavigationElements();
    const html = `
        <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border mt-10">
            <div class="text-center border-b pb-4 mb-4">
                <div class="text-2xl font-black text-blue-600 dark:text-blue-400">Canfenci</div>
                <div class="text-sm font-semibold text-gray-500 dark:text-gray-400">Ödev Giriş Doğrulaması</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-4 border text-sm text-center">
                <div class="font-semibold text-gray-700 dark:text-gray-300">Öğrenci: ${escapeHtml(hwData.studentName)}</div>
                <div class="text-xs text-gray-500 mt-1">${escapeHtml(hwData.konu)} (${escapeHtml(hwData.yayin)})</div>
            </div>
            <div id="passcodeError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-xl mb-4 text-xs hidden"></div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 text-center">🔑 6 Haneli Giriş Şifresi</label>
                    <input type="number" id="hwPasscode" placeholder="••••••" class="student-form-input text-2xl font-bold tracking-widest text-center" oninput="if(this.value.length>6) this.value=this.value.slice(0,6)">
                </div>
                <button onclick="verifyHwPasscode('${hwData.id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2 min-h-[44px]">Giriş Yap</button>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function verifyHwPasscode(hwId) {
    const pin = document.getElementById("hwPasscode").value.trim();
    const errDiv = document.getElementById("passcodeError");
    if (errDiv) errDiv.classList.add("hidden");
    if (pin.length !== 6) {
        if (errDiv) {
            errDiv.textContent = "Lütfen 6 haneli şifrenizi giriniz.";
            errDiv.classList.remove("hidden");
        }
        return;
    }
    db.collection("homeworks").doc(hwId).get().then(doc => {
        if (doc.exists) {
            const hwData = doc.data();
            if (hwData.passcode !== pin) {
                if (errDiv) {
                    errDiv.textContent = "Hatalı şifre! Lütfen öğretmeninizin gönderdiği şifreyi kontrol edin.";
                    errDiv.classList.remove("hidden");
                }
                return;
            }
            const today = new Date().toISOString().slice(0, 10);
            if (today > hwData.bitisTarihi) {
                if (errDiv) {
                    errDiv.textContent = `⚠️ Bu ödevin teslim süresi (${hwData.bitisTarihi}) dolmuştur. Giriş yapılamaz.`;
                    errDiv.classList.remove("hidden");
                }
                return;
            }
            if (hwData.durum === 'tamamlandi') {
                if (errDiv) {
                    errDiv.textContent = "ℹ️ Bu ödev zaten tamamlanmış.";
                    errDiv.classList.remove("hidden");
                }
                return;
            }
            renderParentHwEntry(hwData.studentName, hwData.studentId, hwData.id, hwData.konu, hwData.tur, hwData.yayin);
        } else {
            if (errDiv) {
                errDiv.textContent = "Ödev kaydı bulunamadı.";
                errDiv.classList.remove("hidden");
            }
        }
    }).catch(err => {
        console.error(err);
        if (errDiv) {
            errDiv.textContent = "Bağlantı hatası: " + err.message;
            errDiv.classList.remove("hidden");
        }
    });
}

export function renderParentHwEntry(studentName, studentId, hwId, konu, tur, yayin) {
    store.currentPage = "parentHwEntry";
    if (window.currentPage) window.currentPage = "parentHwEntry";
    hideNavigationElements();
    const isOnline = (store.useFirestore && isFirebaseActive);
    const btnIcon = isOnline ? 'fa-paper-plane' : 'fab fa-whatsapp';
    const btnText = isOnline ? 'Sonucu Gönder' : 'Sonucu Öğretmene Gönder';
    const html = `
        <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border mt-4">
            <div class="text-center border-b pb-4 mb-4">
                <div class="text-2xl font-black text-blue-600 dark:text-blue-400">Canfenci</div>
                <div class="text-sm font-semibold text-gray-500 dark:text-gray-400">Ödev Sonuç Giriş Paneli</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-4 border text-sm">
                <div class="mb-1"><span class="font-bold text-gray-700 dark:text-gray-300">Öğrenci:</span> ${escapeHtml(studentName)}</div>
                <div class="mb-1"><span class="font-bold text-gray-700 dark:text-gray-300">Ödev Konusu:</span> ${escapeHtml(konu)}</div>
                <div class="mb-1"><span class="font-bold text-gray-700 dark:text-gray-300">Tür / Yayın:</span> ${escapeHtml(tur)} / ${escapeHtml(yayin)}</div>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">✅ Doğru Sayısı</label>
                    <input type="number" id="parentCorrect" min="0" value="0" class="student-form-input text-lg font-bold text-center min-h-[44px]">
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">❌ Yanlış Sayısı</label>
                    <input type="number" id="parentWrong" min="0" value="0" class="student-form-input text-lg font-bold text-center min-h-[44px]">
                </div>
                <button onclick="submitParentHwResult('${studentId}', '${hwId}', '${escapeHtml(studentName)}', '${escapeHtml(konu)}', '${escapeHtml(tur)}', '${escapeHtml(yayin)}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2 mt-4 min-h-[44px]">
                    <i class="fas ${btnIcon} text-xl"></i> ${btnText}
                </button>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function submitParentHwResult(studentId, hwId, studentName, konu, tur, yayin) {
    const correct = parseInt(document.getElementById('parentCorrect').value) || 0;
    const wrong = parseInt(document.getElementById('parentWrong').value) || 0;
    if (store.useFirestore && isFirebaseActive) {
        showSyncStatus("Kaydediliyor...", false);
        db.collection("homeworks").doc(hwId).update({
            durum: "tamamlandi",
            dogru: correct,
            yanlis: wrong
        }).then(() => {
            showSyncStatus("✅ Başarıyla Kaydedildi!", false);
            document.getElementById("dynamic-content").innerHTML = `
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border mt-10 text-center">
                    <div class="text-green-500 text-5xl mb-4"><i class="fas fa-check-circle"></i></div>
                    <h2 class="text-2xl font-bold mb-2">Başarıyla Kaydedildi!</h2>
                    <p class="text-gray-500 text-sm">Girdiğiniz doğru ve yanlış sayıları öğretmen sistemine anlık olarak aktarıldı. Teşekkür ederiz.</p>
                </div>
            `;
        }).catch(err => {
            console.error(err);
            alert("Hata: " + err.message);
        });
    } else {
        const baseUrl = window.location.origin + window.location.pathname;
        let message = `Sayın Canfenci Öğretmenim,\n\n*${studentName}* isimli öğrencimizin *${konu}* (${yayin} - ${tur}) konulu ödev sonucu aşağıdaki gibidir:\n\n`;
        message += `✅ *Doğru:* ${correct}\n`;
        message += `❌ *Yanlış:* ${wrong}\n\n`;
        message += `Sonucu sisteme kaydetmek için lütfen aşağıdaki bağlantıya tıklayın:\n`;
        message += `${baseUrl}?action=teacher-import-hw&studentId=${studentId}&hwId=${hwId}&d=${correct}&y=${wrong}`;
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }
}

export function importHwResult(studentId, hwId, dogru, yanlis) {
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) {
        alert("Öğrenci bulunamadı. Lütfen verilerinizin güncel olduğunu kontrol edin.");
        window.location.href = window.location.origin + window.location.pathname;
        return;
    }
    if (!students[sIdx].odevler) students[sIdx].odevler = [];
    const hwIdx = students[sIdx].odevler.findIndex(h => h.id === hwId);
    if (hwIdx === -1) {
        alert("Ödev kaydı bulunamadı.");
        window.location.href = window.location.origin + window.location.pathname;
        return;
    }
    students[sIdx].odevler[hwIdx].durum = "tamamlandi";
    students[sIdx].odevler[hwIdx].dogru = dogru;
    students[sIdx].odevler[hwIdx].yanlis = yanlis;
    saveStudentsData(students);
    alert(`✅ ${students[sIdx].adSoyad} isimli öğrencinin ödev sonucu başarıyla kaydedildi!\nDoğru: ${dogru}, Yanlış: ${yanlis}`);
    window.location.href = window.location.origin + window.location.pathname + "?page=odevler";
}

export function renderOdevTakibi(studentId = null, filters = {}) {
    store.currentPage = "odevTakibi";
    if (window.currentPage) window.currentPage = "odevTakibi";
    updateMobileNavActive('mobile-nav-homework');

    const students = loadStudentsData();
    const currentDate = new Date();
    const curWeekNum = getCurrentWeekNumber(currentDate);

    // Filter state resolution
    const activeFilters = {
        week: filters.week !== undefined ? filters.week : (window._homeworkDashboardFilters?.week !== undefined ? window._homeworkDashboardFilters.week : curWeekNum),
        studentId: studentId !== null ? (studentId || '') : (filters.studentId !== undefined ? filters.studentId : (window._homeworkDashboardFilters?.studentId || '')),
        status: filters.status || window._homeworkDashboardFilters?.status || 'all',
        query: filters.query !== undefined ? filters.query : (window._homeworkDashboardFilters?.query || ''),
        grade: filters.grade !== undefined ? filters.grade : (window._homeworkDashboardFilters?.grade || '')
    };

    window._homeworkDashboardFilters = activeFilters;

    if (students.length === 0) {
        document.getElementById("dynamic-content").innerHTML = `
            <div class="app-page"><div class="app-panel p-8 text-center"><i class="fas fa-list-check text-2xl text-gray-400"></i><h2 class="app-page-title">Ödev Takibi</h2><p class="mt-1 text-sm text-gray-500">İlk ödevi oluşturarak öğrenci çalışma takibini başlatabilirsiniz.</p><button onclick="showOdevAtaModal()" class="btn-primary mt-5 min-h-[44px] px-4"><i class="fas fa-plus mr-1"></i> Yeni Ödev</button></div></div>
        `;
        return;
    }

    // Combined filter execution
    const combined = filterHomeworksCombined({
        students,
        getHomeworks: getStudentOdevler,
        week: activeFilters.week,
        studentId: activeFilters.studentId,
        query: activeFilters.query,
        status: activeFilters.status,
        currentDate
    });

    const { records, metrics, viewMode, activeWeekNum, activeWeekInfo, activeStudent, title, subtitle } = combined;

    const weekOptions = generateWeekList(35);
    const renderDate = date => date ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`)) : 'Tarih belirtilmedi';

    const statusStyles = {
        overdue: 'border-red-200 text-red-700 dark:border-red-900/60 dark:text-red-300',
        today: 'border-amber-200 text-amber-700 dark:border-amber-900/60 dark:text-amber-300',
        upcoming: 'border-amber-200 text-amber-700 dark:border-amber-900/60 dark:text-amber-300',
        completed: 'border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300',
        active: 'border-blue-200 text-blue-700 dark:border-blue-900/60 dark:text-blue-300'
    };

    const statusFilters = [
        ['all', 'Tümü', metrics.total],
        ['active', 'Aktif', metrics.active],
        ['overdue', 'Geciken', metrics.overdue],
        ['today', 'Bugün', metrics.dueToday],
        ['upcoming', 'Yaklaşan', metrics.upcoming],
        ['completed', 'Tamamlanan', metrics.completed]
    ];

    // Build metric cards
    const metricCards = [
        ['fa-list-check', 'Toplam Ödev', metrics.total, viewMode === 'student_all_history' ? 'Öğrencinin tüm ödevleri' : (activeWeekInfo ? `${activeWeekInfo.weekNumber}. Hafta ödevleri` : 'Ödev sayısı')],
        ['fa-circle-check', 'Tamamlanan', metrics.completed, metrics.total ? `%${metrics.completionRate ?? 0} Tamamlanma` : 'Henüz sonuç yok'],
        ['fa-clock', 'Aktif / Bekleyen', metrics.active, metrics.dueToday ? `${metrics.dueToday} bugün teslim` : `${metrics.upcoming} yaklaşan teslim`],
        ['fa-triangle-exclamation', 'Geciken', metrics.overdue, metrics.overdue ? 'Müdahale gerekiyor' : 'Geciken ödev yok']
    ];

    const rowsHtml = records.map(({ homework, student, due, weekInfo }) => `
        <article class="border-b border-gray-100 px-5 py-4 transition hover:bg-slate-50/70 dark:border-gray-700 dark:hover:bg-slate-800/40 last:border-0">
            <div class="hidden md:grid md:grid-cols-[minmax(170px,.85fr)_minmax(240px,1.35fr)_minmax(150px,.8fr)_minmax(130px,.65fr)_auto] md:items-center md:gap-4">
                <div>
                    <p class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(student.adSoyad)}</p>
                    <p class="mt-1 text-xs text-gray-500">${escapeHtml(student.sinif ? `${student.sinif}. Sınıf` : 'Sınıf yok')}${viewMode === 'student_all_history' && weekInfo ? ` · <span class="font-semibold text-indigo-600 dark:text-indigo-400">${escapeHtml(weekInfo.compactLabel)}</span>` : ''}</p>
                </div>
                <div>
                    <p class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(homework.calismaDetayi || homework.konu || 'Ödev')}</p>
                    <p class="mt-1 text-xs text-gray-500">${escapeHtml(homework.konu || 'Konu belirtilmedi')} · ${escapeHtml(homework.yayin || homework.tur || 'Kaynak belirtilmedi')}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">Teslim</p>
                    <p class="mt-1 text-sm font-semibold">${escapeHtml(renderDate(homework.bitisTarihi))}</p>
                </div>
                <span class="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[due.key] || statusStyles.active}">
                    <i class="fas ${due.key === 'completed' ? 'fa-check' : due.key === 'overdue' ? 'fa-triangle-exclamation' : 'fa-clock'}"></i>
                    ${escapeHtml(due.label)}
                </span>
                <div class="flex justify-end gap-2">
                    ${due.key === 'completed' ? `
                        <button onclick="openHomeworkDetailModal('${student.id}', '${homework.id}')" class="btn-secondary min-h-[44px] px-3 text-sm text-blue-600 dark:text-blue-400 font-bold">
                            <i class="fas fa-file-pdf mr-1"></i> Rapor / Detay
                        </button>
                    ` : `
                        <button onclick="openHomeworkResultFromBoard('${student.id}', '${homework.id}')" class="btn-secondary min-h-[44px] px-3 text-sm">
                            <i class="fas fa-pen mr-1"></i> Sonuç Gir
                        </button>
                        <button onclick="openHomeworkDetailModal('${student.id}', '${homework.id}')" class="min-h-[44px] px-2 text-sm font-bold text-blue-600 dark:text-blue-400">
                            Detay
                        </button>
                    `}
                </div>
            </div>
            <div class="md:hidden">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(student.adSoyad)}</p>
                            ${viewMode === 'student_all_history' && weekInfo ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">${escapeHtml(weekInfo.compactLabel)}</span>` : ''}
                        </div>
                        <h3 class="mt-1 font-bold text-base">${escapeHtml(homework.calismaDetayi || homework.konu || 'Ödev')}</h3>
                    </div>
                    <span class="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${statusStyles[due.key] || statusStyles.active}">
                        <i class="fas ${due.key === 'completed' ? 'fa-check' : due.key === 'overdue' ? 'fa-triangle-exclamation' : 'fa-clock'}"></i>
                        ${escapeHtml(due.label)}
                    </span>
                </div>
                <p class="mt-2 text-sm text-gray-500">${escapeHtml(homework.konu || 'Konu belirtilmedi')} · ${escapeHtml(homework.yayin || homework.tur || 'Kaynak belirtilmedi')}</p>
                <div class="mt-3 flex items-center justify-between gap-3">
                    <p class="text-xs text-gray-500">Teslim: <span class="font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(renderDate(homework.bitisTarihi))}</span></p>
                    <div class="flex gap-2">
                        ${due.key === 'completed' ? `
                            <button onclick="openHomeworkDetailModal('${student.id}', '${homework.id}')" class="btn-secondary min-h-[44px] px-3 text-sm text-blue-600 dark:text-blue-400 font-bold">
                                <i class="fas fa-file-pdf mr-1"></i> Rapor
                            </button>
                        ` : `
                            <button onclick="openHomeworkResultFromBoard('${student.id}', '${homework.id}')" class="btn-secondary min-h-[44px] px-3 text-sm">
                                Sonuç Gir
                            </button>
                            <button onclick="openHomeworkDetailModal('${student.id}', '${homework.id}')" class="min-h-[44px] px-2 text-sm font-bold text-blue-600 dark:text-blue-400">
                                Detay
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </article>
    `).join('');

    const prevWeekNum = activeWeekNum ? Math.max(1, activeWeekNum - 1) : curWeekNum;
    const nextWeekNum = activeWeekNum ? activeWeekNum + 1 : curWeekNum;

    const html = `
        <div class="app-page pb-28 sm:pb-8">
            <!-- Header -->
            <header class="app-page-header">
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            ${viewMode === 'student_all_history' ? 'Öğrenci Geçmişi' : 'Haftalık Takip'}
                        </span>
                        ${activeWeekNum === curWeekNum ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Güncel Hafta</span>` : ''}
                    </div>
                    <h2 class="app-page-title mt-1">${escapeHtml(title)}</h2>
                    <p class="app-page-subtitle">${escapeHtml(subtitle)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="showOdevAtaModal()" class="btn-primary min-h-[44px] px-5">
                        <i class="fas fa-plus mr-1"></i> Yeni Ödev
                    </button>
                </div>
            </header>

            <!-- 2-Axis Primary Filter Panel (Hafta + Öğrenci) -->
            <section class="app-panel p-4 bg-white dark:bg-gray-800 shadow-sm border border-gray-200/80 dark:border-gray-700">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                    <!-- Hafta Seçici & Stepper -->
                    <div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black uppercase tracking-wider text-gray-500">📅 Hafta Seçimi</span>
                            ${activeWeekNum !== curWeekNum && activeWeekNum !== null ? `
                                <button onclick="updateHomeworkDashboardFilters({week: ${curWeekNum}})" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                    Bu Haftaya Dön
                                </button>
                            ` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="updateHomeworkDashboardFilters({week: ${prevWeekNum}})" class="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border rounded-lg font-bold text-sm transition min-h-[40px]" title="Önceki Hafta">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <select onchange="updateHomeworkDashboardFilters({week: this.value})" class="student-form-input flex-1 min-h-[40px] font-semibold text-sm">
                                ${activeStudent ? `<option value="all" ${activeWeekNum === null ? 'selected' : ''}>Tüm Haftalar (Tüm Ödev Geçmişi)</option>` : ''}
                                ${weekOptions.map(w => `
                                    <option value="${w.weekNumber}" ${activeWeekNum === w.weekNumber ? 'selected' : ''}>
                                        ${w.weekNumber}. Hafta · ${w.dateRangeShort}${w.weekNumber === curWeekNum ? ' (Güncel)' : ''}
                                    </option>
                                `).join('')}
                            </select>
                            <button onclick="updateHomeworkDashboardFilters({week: ${nextWeekNum}})" class="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border rounded-lg font-bold text-sm transition min-h-[40px]" title="Sonraki Hafta">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Öğrenci Seçici -->
                    <div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black uppercase tracking-wider text-gray-500">👤 Öğrenci Filtresi</span>
                            ${activeStudent ? `
                                <button onclick="updateHomeworkDashboardFilters({studentId: ''})" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                    Tüm Öğrencilere Dön
                                </button>
                            ` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <select onchange="updateHomeworkDashboardFilters({studentId: this.value})" class="student-form-input w-full min-h-[40px] font-semibold text-sm">
                                <option value="">Tüm Öğrenciler (Seçili Hafta)</option>
                                ${students.map(s => `
                                    <option value="${s.id}" ${activeFilters.studentId === s.id ? 'selected' : ''}>
                                        ${escapeHtml(s.adSoyad)} (${s.sinif ? `${s.sinif}. Sınıf` : 'Sınıf yok'})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Metrics Cards -->
            <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                ${metricCards.map(([icon, label, value, detail]) => `
                    <article class="app-panel p-4">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas ${icon} text-xs"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">${label}</p>
                        </div>
                        <p class="mt-3 text-2xl font-black text-slate-900 dark:text-white">${value}</p>
                        <p class="mt-1 text-xs text-gray-500">${detail}</p>
                    </article>
                `).join('')}
            </section>

            <!-- Secondary Filters & Search -->
            <section class="app-panel p-4 mt-3">
                <div class="flex flex-wrap gap-2">
                    ${statusFilters.map(([key, label, count]) => `
                        <button onclick="updateHomeworkDashboardFilters({status:'${key}'})" class="min-h-[38px] rounded-full border px-3 text-sm font-bold transition ${activeFilters.status === key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300 dark:border-gray-700 dark:text-gray-300'}">
                            ${label}${count !== undefined ? ` <span class="ml-1 opacity-75">${count}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
                <div class="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                    <label class="relative">
                        <span class="sr-only">Ödev veya öğrenci ara</span>
                        <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                        <input value="${escapeHtml(activeFilters.query)}" oninput="updateHomeworkDashboardFilters({query:this.value})" class="student-form-input min-h-[40px] pl-10" placeholder="Öğrenci, konu veya kaynak ara">
                    </label>
                    <select onchange="updateHomeworkDashboardFilters({grade:this.value})" class="student-form-input min-h-[40px]">
                        <option value="">Tüm sınıflar</option>
                        ${['5','6','7','8'].map(grade => `<option value="${grade}" ${activeFilters.grade === grade ? 'selected' : ''}>${grade}. Sınıf</option>`).join('')}
                    </select>
                </div>
            </section>

            <!-- List Section -->
            <section class="app-panel mt-4 overflow-hidden">
                <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                    <div>
                        <h3 class="text-lg font-black">${viewMode === 'student_all_history' ? 'Öğrenci Ödev Listesi' : 'Haftalık Ödev Listesi'}</h3>
                        <p class="mt-1 text-sm text-gray-500">
                            ${activeFilters.status === 'all' ? 'Öncelik ve duruma göre listelenir.' : `${records.length} ödev bulundu.`}
                        </p>
                    </div>
                    <span class="text-xs font-bold text-gray-400">${records.length} kayıt</span>
                </div>
                ${rowsHtml || `
                    <div class="px-5 py-12 text-center">
                        <div class="text-gray-300 dark:text-gray-600 text-4xl mb-3"><i class="fas fa-folder-open"></i></div>
                        <p class="font-bold text-gray-800 dark:text-gray-200">Bu filtrelere uygun ödev bulunamadı.</p>
                        <p class="mt-1 text-sm text-gray-500">Farklı bir hafta veya öğrenci seçebilirsiniz.</p>
                    </div>
                `}
            </section>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function updateHomeworkDashboardFilters(nextFilters = {}) {
    const current = window._homeworkDashboardFilters || {};
    const merged = { ...current, ...nextFilters };
    renderOdevTakibi(merged.studentId !== undefined ? merged.studentId : (current.studentId || null), merged);
}

export function openHomeworkResultFromBoard(studentId, homeworkId) {
    window._homeworkDashboardReturn = { ...(window._homeworkDashboardFilters || {}), studentId: window._homeworkDashboardFilters?.studentId || '' };
    showEnterOdevSonucModal(studentId, homeworkId);
}

export function renderStudentOdevDetay(studentId, performanceFilter = 'all') {
    store.currentPage = "studentOdevDetay";
    if (window.currentPage) window.currentPage = "studentOdevDetay";
    window._currentOdevStudentId = studentId;
    updateMobileNavActive('mobile-nav-homework');
    
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        renderOdevTakibi();
        return;
    }
    const odevler = getStudentOdevler(student);
    const performance = buildWorkPerformance(odevler, performanceFilter);
    const todayStr = new Date().toISOString().slice(0, 10);
    let listRows = '';
    
    for (let i = 0; i < odevler.length; i++) {
        const o = odevler[i];
        const isCompleted = o.durum === 'tamamlandi';
        const isOverdue = !isCompleted && todayStr > o.bitisTarihi;
        
        const statusBadge = isCompleted 
            ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">✅ Tamamlandı</span>`
            : (isOverdue 
                ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 animate-pulse">⚠️ Süresi Geçti</span>`
                : `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">⏳ Bekliyor</span>`);
        
        const resultText = isCompleted
            ? `<div class="text-base text-gray-600 dark:text-gray-400 mt-1 font-semibold">Sonuç: <span class="text-green-600">${o.dogru} Doğru</span> / <span class="text-red-650">${o.yanlis} Yanlış</span>${o.tur === 'Konu Denemesi' ? ` / <span class="text-blue-600">${calculateTopicTestNet(o.dogru, o.yanlis).toFixed(2)} Net</span>` : ''}${(o.yanlisKonular || []).length ? `<div class="mt-1 text-xs text-amber-700 dark:text-amber-300">Yanlış konusu: ${(o.yanlisKonular || []).map(item => `${escapeHtml(item.konu)}${item.altKonu ? ` › ${escapeHtml(item.altKonu)}` : ''} (${item.adet})`).join(', ')}</div>` : ''}</div>`
            : '';
        
        const dateTextClass = isOverdue ? 'text-red-500 font-bold' : 'text-gray-400 dark:text-gray-500';
        
        listRows += `
            <div class="border rounded-xl p-4 bg-white dark:bg-gray-800 flex justify-between items-center gap-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-base text-gray-800 dark:text-white">${escapeHtml(o.konu)}</span>
                        ${statusBadge}
                    </div>
                    <div class="text-base text-gray-500 dark:text-gray-400 mt-1">📚 Yayın: <span class="font-medium">${escapeHtml(o.yayin)}</span> | Tür: <span class="font-medium">${escapeHtml(o.tur)}</span></div>
                    ${o.calismaDetayi ? `<div class="text-sm text-indigo-600 dark:text-indigo-300 mt-1">📌 Çalışma: <span class="font-bold">${escapeHtml(o.calismaDetayi)}</span></div>` : ''}
                    <div class="text-base ${dateTextClass} mt-0.5">📅 Süre: ${o.baslamaTarihi} / <span>${o.bitisTarihi}</span></div>
                    ${resultText}
                </div>
                <div class="flex gap-2 flex-wrap items-center">
                    ${isCompleted ? `
                        <button onclick="openHomeworkDetailModal('${studentId}', '${o.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-xs font-bold border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 flex items-center gap-1.5 min-h-[44px] bg-blue-50/50 dark:bg-blue-950/20 shadow-xs">
                            <i class="fas fa-file-pdf"></i> Rapor / PDF
                        </button>
                    ` : `
                        <button onclick="sendSingleHwReminder('${studentId}', '${o.id}')" class="text-teal-600 hover:text-teal-700 text-sm font-semibold border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2.5 flex items-center gap-1 min-h-[44px]">
                            <i class="fab fa-whatsapp"></i> Hatırlat
                        </button>
                        <button onclick="showEnterOdevSonucModal('${studentId}', '${o.id}')" class="text-green-500 hover:text-green-600 text-base font-semibold border rounded px-3 py-2.5 min-h-[44px]">
                            D/Y Gir
                        </button>
                    `}
                    <button onclick="deleteOdev('${studentId}', '${o.id}')" class="text-red-500 hover:text-red-600 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    const html = `
        <div class="space-y-4">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-3">
                <div>
                    <h2 class="page-heading text-2xl font-bold text-gray-800 dark:text-white">${escapeHtml(student.adSoyad)}</h2>
                    <p class="text-sm text-gray-500">Ödev Takip Paneli</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="shareHomeworkWhatsApp('${studentId}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl shadow font-semibold transition flex items-center gap-2 min-h-[44px]">
                        <i class="fab fa-whatsapp text-lg"></i> Raporu Veliye Gönder
                    </button>
                    <button onclick="renderOdevTakibi()" class="bg-gray-500 text-white px-4 py-2.5 rounded-xl min-h-[44px]">
                        Geri
                    </button>
                </div>
            </div>
            <div class="mb-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/10 p-4">
                <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div><h3 class="font-black text-lg text-gray-800 dark:text-white">📈 Çalışma Performansı</h3><p class="text-xs text-gray-500">Testler ve konu denemelerinin D/Y/net gelişimi</p></div>
                    <div class="flex rounded-xl border bg-white dark:bg-gray-800 p-1 text-xs font-bold">
                        ${[['all','Tümü'],['test','Testler'],['topic','Konu Denemeleri']].map(([value,label]) => `<button onclick="renderStudentOdevDetay('${studentId}','${value}')" class="px-3 py-2 rounded-lg ${performanceFilter === value ? 'bg-indigo-600 text-white' : 'text-gray-500'}">${label}</button>`).join('')}
                    </div>
                </div>
                ${performance.count ? `
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        <div class="rounded-xl border bg-white dark:bg-gray-800 p-3"><span class="block text-xs text-gray-500">Çalışma</span><strong>${performance.count}</strong></div>
                        <div class="rounded-xl border bg-green-50 dark:bg-green-950/20 p-3"><span class="block text-xs text-gray-500">Ort. Doğru</span><strong class="text-green-600">${performance.averageCorrect.toFixed(2)}</strong></div>
                        <div class="rounded-xl border bg-red-50 dark:bg-red-950/20 p-3"><span class="block text-xs text-gray-500">Ort. Yanlış</span><strong class="text-red-600">${performance.averageWrong.toFixed(2)}</strong></div>
                        <div class="rounded-xl border bg-blue-50 dark:bg-blue-950/20 p-3"><span class="block text-xs text-gray-500">Ort. Net</span><strong class="text-blue-600">${performance.averageNet.toFixed(2)}</strong></div>
                    </div>
                    <div class="h-72 rounded-xl border bg-white dark:bg-gray-800 p-2"><canvas id="workPerformanceChart"></canvas></div>
                ` : '<p class="text-sm text-gray-500 text-center py-6">Bu filtrede sonuçlandırılmış çalışma bulunmuyor.</p>'}
            </div>
            <div class="space-y-3 mt-4">
                ${listRows || `
                    <div class="cf-empty-state my-4">
                        <div class="cf-empty-state-icon"><i class="fas fa-tasks"></i></div>
                        <div class="cf-empty-state-title">Henüz Atanmış Ödev Bulunmuyor</div>
                        <div class="cf-empty-state-description">Bu öğrenci veya filtre için henüz ödev kaydı girilmemiş.</div>
                    </div>
                `}
            </div>
        </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
    setTimeout(() => {
        const ctx = document.getElementById('workPerformanceChart')?.getContext('2d');
        if (!ctx || !performance.count || !window.Chart) return;
        if (window.workPerformanceChartInstance) window.workPerformanceChartInstance.destroy();
        window.workPerformanceChartInstance = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: performance.records.map(record => `${record.date} · ${record.label}`),
                datasets: [
                    { label: 'Doğru', data: performance.records.map(record => record.correct), borderColor: '#16a34a', backgroundColor: '#16a34a', tension: 0.25 },
                    { label: 'Yanlış', data: performance.records.map(record => record.wrong), borderColor: '#dc2626', backgroundColor: '#dc2626', tension: 0.25 },
                    { label: 'Net', data: performance.records.map(record => record.net), borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.25, borderWidth: 3 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true } } }
        });
    }, 0);
}

export function deleteOdev(studentId, hwId) {
    if (confirm("Bu ödevi silmek istediğinize emin misiniz?")) {
        if (store.useFirestore && isFirebaseActive) {
            db.collection("homeworks").doc(hwId).delete()
                .then(() => {
                    renderStudentOdevDetay(studentId);
                })
                .catch(err => console.error(err));
        } else {
            const students = loadStudentsData();
            const sIdx = students.findIndex(s => s.id === studentId);
            if (sIdx !== -1) {
                students[sIdx].odevler = (students[sIdx].odevler || []).filter(o => o.id !== hwId);
                saveStudentsData(students);
                renderStudentOdevDetay(studentId);
            }
        }
    }
}

export function sendSingleHwReminder(studentId, hwId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!student.veliTel) {
        alert("Lütfen bu öğrenci için önce veli telefon numarası giriniz.");
        if (window.editStudent) window.editStudent(studentId);
        return;
    }
    const odevler = getStudentOdevler(student);
    const o = odevler.find(x => x.id === hwId);
    if (!o) return;
    
    let message = `Merhaba Sayın Velimiz,\n\n*${student.adSoyad}* isimli öğrencimize atanan *${o.konu}* (${o.yayin}${o.calismaDetayi ? ` · ${o.calismaDetayi}` : ''} - ${o.tur}) ödevinin son teslim tarihi *${o.bitisTarihi}* dir.\n\nÖdev sonucunu doğru ve yanlış sayılarıyla bu mesajı yanıtlayarak iletebilirsiniz.\n\nİyi çalışmalar dileriz.`;
    
    let phone = student.veliTel.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '90' + phone.substring(1);
    else if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

export function showEnterOdevSonucModal(studentId, hwId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const odev = getStudentOdevler(student).find(o => o.id === hwId);
    if (!odev) return;

    const studentSinif = student.sinif || '8';
    const homeworkDers = odev.ders || odev.kaynakDers?.ders || 'Fen Bilimleri';
    const unitCatalog = getUnitsAndTopicsBySinifAndDers(studentSinif, homeworkDers);
    const unitList = unitCatalog.map(u => u.unite);

    const isEditing = odev.durum === 'tamamlandi';
    const initialWrong = Number(odev.yanlis) || 0;
    const initialCorrect = Number(odev.dogru) || 0;
    const existingErrors = normalizeHomeworkErrorAnalysis(odev);

    const modal = document.createElement('div');
    modal.id = "homeworkResultModal";
    modal.className = "app-modal-backdrop";
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });

    modal.innerHTML = `
        <div class="app-modal max-w-lg max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
            <div class="app-modal-header">
                <div>
                    <h2 class="app-page-title text-xl">${isEditing ? 'Ödev Sonucunu ve Yanlış Analizini Düzenle' : 'Ödev Sonucu Gir'}</h2>
                    <p class="app-page-subtitle">${escapeHtml(odev.konu)} · ${escapeHtml(odev.yayin)} (${escapeHtml(student.adSoyad || '')})</p>
                </div>
                <button onclick="this.closest('.app-modal-backdrop').remove()" class="app-modal-close" aria-label="Pencereyi kapat">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="app-modal-body space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Doğru Sayısı</label>
                        <input type="number" id="manualCorrect" min="0" value="${initialCorrect}" class="student-form-input min-h-[44px]">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Yanlış Sayısı</label>
                        <input type="number" id="manualWrong" min="0" value="${initialWrong}" class="student-form-input min-h-[44px]">
                    </div>
                </div>

                <div id="zeroWrongWarning" class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 font-medium hidden">
                    <i class="fas fa-exclamation-triangle mr-1"></i> Yanlış sayısını 0 yaptığınız için kayıtlı yanlış analizi kaydedildiğinde kaldırılacaktır.
                </div>

                <!-- Error Analysis Section (Ünite + Konu Odaklı) -->
                <div id="errorAnalysisSection" class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10 p-3.5 space-y-3 ${initialWrong > 0 ? '' : 'hidden'}">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="text-xs font-black uppercase tracking-wider text-red-900 dark:text-red-200 flex items-center gap-1.5">
                                <i class="fas fa-list-check text-red-600"></i> Yanlış Analizi (Ünite & Konu)
                            </span>
                            <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Yanlış yapılan ünite, konu ve hata nedenlerini sınıflandırın.</p>
                        </div>
                        <button type="button" id="addErrorRowBtn" class="border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1">
                            <i class="fas fa-plus text-[10px]"></i> Alan Ekle
                        </button>
                    </div>

                    <div id="errorRowsContainer" class="space-y-3">
                        <!-- Dynamic rows will be inserted here -->
                    </div>

                    <div id="errorAllocationStatus" class="text-[11px] font-bold text-gray-600 dark:text-gray-400 flex items-center justify-between pt-1 border-t border-red-100 dark:border-red-900/40">
                        <span id="errorAllocationSummary">Analiz Edilen: 0 / 0</span>
                        <span id="errorAllocationWarning" class="text-red-600 font-bold hidden">⚠️ Yanlış toplamı aşıldı!</span>
                    </div>
                </div>

                <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                    <button onclick="this.closest('.app-modal-backdrop').remove()" class="btn-secondary flex-1 py-2.5 min-h-[44px]">İptal</button>
                    <button onclick="saveManualOdevResult('${studentId}', '${hwId}')" class="btn-primary flex-1 py-2.5 min-h-[44px]">
                        <i class="fas fa-check mr-1"></i> ${isEditing ? 'Güncellemeleri Kaydet' : 'Sonucu Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const wrongInput = document.getElementById('manualWrong');
    const zeroWarning = document.getElementById('zeroWrongWarning');
    const analysisSection = document.getElementById('errorAnalysisSection');
    const rowsContainer = document.getElementById('errorRowsContainer');
    const addRowBtn = document.getElementById('addErrorRowBtn');
    const allocationSummary = document.getElementById('errorAllocationSummary');
    const allocationWarning = document.getElementById('errorAllocationWarning');

    function renderErrorRow(data = {}) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'error-row bg-white dark:bg-gray-800 rounded-xl p-3 border border-red-100 dark:border-red-900/40 space-y-2.5 shadow-xs relative';

        // Determine default unit and topic
        let defaultUnit = data.unite || '';
        let defaultKonu = data.konu || data.altKonu || '';

        if (!defaultUnit) {
            const foundUnit = unitCatalog.find(u => u.unite === odev.konu || u.konular.includes(odev.konu));
            if (foundUnit) {
                defaultUnit = foundUnit.unite;
                if (!defaultKonu && foundUnit.konular.includes(odev.konu)) {
                    defaultKonu = odev.konu;
                }
            } else {
                defaultUnit = unitList[0] || odev.konu || 'Genel';
            }
        }

        const countVal = Number(data.adet) || 1;
        const selectedReasonKeys = Array.isArray(data.hataNedenleriKeys) && data.hataNedenleriKeys.length > 0
            ? data.hataNedenleriKeys
            : (Array.isArray(data.hataNedenleri) ? data.hataNedenleri.map(normalizeHataNedeniKey) : []);

        const unitOptionsHtml = unitList.map(u => `<option value="${escapeHtml(u)}" ${u === defaultUnit ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('') + `<option value="__custom__" ${defaultUnit && !unitList.includes(defaultUnit) ? 'selected' : ''}>✍️ Manuel Gir</option>`;

        rowDiv.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <!-- Ünite Seçimi -->
                <div class="sm:col-span-6">
                    <label class="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-0.5">Ünite / Yanlış Yapılan Ana Konu</label>
                    <select class="error-unit-select student-form-input text-xs min-h-[38px] py-1.5 font-bold">
                        ${unitOptionsHtml}
                    </select>
                    <input type="text" class="error-unit-custom student-form-input text-xs min-h-[38px] py-1.5 mt-1 ${defaultUnit && !unitList.includes(defaultUnit) ? '' : 'hidden'}" placeholder="Ünite adını yazın" value="${defaultUnit && !unitList.includes(defaultUnit) ? escapeHtml(defaultUnit) : ''}">
                </div>

                <!-- Konu Seçimi -->
                <div class="sm:col-span-4">
                    <label class="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-0.5">Konu / Alt Konu</label>
                    <select class="error-topic-select student-form-input text-xs min-h-[38px] py-1.5">
                        <!-- Populated dynamically -->
                    </select>
                    <input type="text" class="manualWrongSubtopicText error-topic-custom student-form-input text-xs min-h-[38px] py-1.5 mt-1 hidden" placeholder="Konu adını yazın">
                </div>

                <!-- Yanlış Adedi & Sil Butonu -->
                <div class="sm:col-span-2 flex items-center gap-1.5">
                    <div class="flex-1">
                        <label class="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-0.5">Adet</label>
                        <input type="number" min="1" value="${countVal}" class="error-count-input student-form-input text-xs min-h-[38px] py-1.5 text-center font-bold">
                    </div>
                    <button type="button" class="remove-error-row-btn text-gray-400 hover:text-red-600 p-1.5 mt-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition" title="Bu alanı sil">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>

            <!-- Hata Nedenleri (Çoklu Seçim) -->
            <div>
                <label class="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Hata Nedeni <span class="text-xs font-normal text-gray-400">(çoklu seçim)</span></label>
                <div class="flex flex-wrap gap-1.5 error-reasons-group">
                    ${HATA_NEDENLERI.map(hn => {
                        const isChecked = selectedReasonKeys.includes(hn.key);
                        return `
                            <label class="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border select-none min-h-[36px] ${isChecked ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-200'}">
                                <input type="checkbox" value="${escapeHtml(hn.key)}" class="hidden error-reason-cb" ${isChecked ? 'checked' : ''}>
                                <span>${escapeHtml(hn.label)}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        const unitSelect = rowDiv.querySelector('.error-unit-select');
        const unitCustom = rowDiv.querySelector('.error-unit-custom');
        const topicSelect = rowDiv.querySelector('.error-topic-select');
        const topicCustom = rowDiv.querySelector('.error-topic-custom');

        function updateTopicsForSelectedUnit(targetKonu = '') {
            const currentUnit = unitSelect.value === '__custom__' ? unitCustom.value.trim() : unitSelect.value;
            const topics = getTopicsForUnit(studentSinif, homeworkDers, currentUnit);

            if (topics.length > 0) {
                topicSelect.classList.remove('hidden');
                topicSelect.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}" ${t === targetKonu ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('') + `<option value="__custom__" ${targetKonu && !topics.includes(targetKonu) ? 'selected' : ''}>✍️ Manuel Gir</option>`;
                if (targetKonu && !topics.includes(targetKonu)) {
                    topicCustom.value = targetKonu;
                    topicCustom.classList.remove('hidden');
                } else {
                    topicCustom.classList.add('hidden');
                }
            } else {
                topicSelect.classList.add('hidden');
                topicCustom.classList.remove('hidden');
                if (targetKonu) topicCustom.value = targetKonu;
            }
        }

        unitSelect.addEventListener('change', () => {
            if (unitSelect.value === '__custom__') {
                unitCustom.classList.remove('hidden');
                unitCustom.focus();
                topicSelect.classList.add('hidden');
                topicCustom.classList.remove('hidden');
            } else {
                unitCustom.classList.add('hidden');
                updateTopicsForSelectedUnit();
            }
        });

        unitCustom.addEventListener('input', () => {
            updateTopicsForSelectedUnit();
        });

        topicSelect.addEventListener('change', () => {
            if (topicSelect.value === '__custom__') {
                topicCustom.classList.remove('hidden');
                topicCustom.focus();
            } else {
                topicCustom.classList.add('hidden');
            }
        });

        // Initialize topic dropdown
        updateTopicsForSelectedUnit(defaultKonu);

        // Wire checkbox toggle style
        rowDiv.querySelectorAll('.error-reasons-group label').forEach(lbl => {
            const cb = lbl.querySelector('input[type="checkbox"]');
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    lbl.className = 'cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border select-none bg-blue-600 text-white border-blue-600 shadow-xs';
                } else {
                    lbl.className = 'cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border select-none bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-200';
                }
            });
        });

        // Wire count input change for sum check
        const countInp = rowDiv.querySelector('.error-count-input');
        countInp.addEventListener('input', updateSumValidation);

        // Wire remove row
        const removeBtn = rowDiv.querySelector('.remove-error-row-btn');
        removeBtn.addEventListener('click', () => {
            rowDiv.remove();
            updateSumValidation();
        });

        rowsContainer.appendChild(rowDiv);
        updateSumValidation();
    }

    function updateSumValidation() {
        const wrongTotal = parseInt(wrongInput.value) || 0;
        let sum = 0;
        rowsContainer.querySelectorAll('.error-count-input').forEach(inp => {
            sum += parseInt(inp.value) || 0;
        });

        allocationSummary.textContent = `Analiz Edilen: ${sum} / ${wrongTotal} Yanlış`;
        if (sum > wrongTotal && wrongTotal > 0) {
            allocationWarning.classList.remove('hidden');
            allocationWarning.textContent = `⚠️ Toplam ${wrongTotal} yanlışı aştı (${sum})!`;
        } else {
            allocationWarning.classList.add('hidden');
        }
    }

    wrongInput.addEventListener('input', () => {
        const wrongVal = parseInt(wrongInput.value) || 0;
        if (wrongVal > 0) {
            analysisSection.classList.remove('hidden');
            zeroWarning.classList.add('hidden');
            if (rowsContainer.children.length === 0) {
                renderErrorRow({ adet: wrongVal });
            }
        } else {
            analysisSection.classList.add('hidden');
            if (existingErrors.length > 0) {
                zeroWarning.classList.remove('hidden');
            }
        }
        updateSumValidation();
    });

    addRowBtn.addEventListener('click', () => {
        const wrongVal = parseInt(wrongInput.value) || 0;
        let currentSum = 0;
        rowsContainer.querySelectorAll('.error-count-input').forEach(inp => {
            currentSum += parseInt(inp.value) || 0;
        });
        const remaining = Math.max(1, wrongVal - currentSum);
        renderErrorRow({ adet: remaining });
    });

    // Populate initial rows
    if (initialWrong > 0) {
        if (existingErrors.length > 0) {
            existingErrors.forEach(err => renderErrorRow(err));
        } else {
            renderErrorRow({ adet: initialWrong });
        }
    }
}

export function saveManualOdevResult(studentId, hwId) {
    const correct = parseInt(document.getElementById('manualCorrect')?.value) || 0;
    const wrong = parseInt(document.getElementById('manualWrong')?.value) || 0;

    let errorTopics = [];

    if (wrong > 0) {
        const rows = document.querySelectorAll('#errorRowsContainer .error-row');
        const entries = [];
        let totalCount = 0;

        rows.forEach(row => {
            let unite = '';
            const unitSelect = row.querySelector('.error-unit-select');
            if (unitSelect) {
                if (unitSelect.value === '__custom__') {
                    unite = row.querySelector('.error-unit-custom')?.value.trim() || '';
                } else {
                    unite = unitSelect.value.trim();
                }
            }

            let konu = '';
            const topicSelect = row.querySelector('.error-topic-select');
            if (topicSelect && !topicSelect.classList.contains('hidden')) {
                if (topicSelect.value === '__custom__') {
                    konu = row.querySelector('.error-topic-custom')?.value.trim() || '';
                } else {
                    konu = topicSelect.value.trim();
                }
            } else {
                konu = row.querySelector('.error-topic-custom')?.value.trim() || '';
            }

            const count = parseInt(row.querySelector('.error-count-input')?.value) || 1;
            totalCount += count;

            const selectedReasons = [];
            row.querySelectorAll('.error-reason-cb:checked').forEach(cb => {
                const canonicalKey = normalizeHataNedeniKey(cb.value);
                if (canonicalKey) selectedReasons.push(canonicalKey);
            });

            if (unite || konu) {
                entries.push({
                    unite: unite || konu,
                    konu: konu || unite,
                    altKonu: konu,
                    adet: count,
                    hataNedenleri: selectedReasons
                });
            }
        });

        if (totalCount > wrong) {
            alert(`Yanlış analizindeki toplam adet (${totalCount}), ödevdeki toplam yanlış sayısını (${wrong}) geçemez. Lütfen adetleri kontrol edin.`);
            return;
        }

        if (entries.length > 0) {
            errorTopics = buildHomeworkErrorTopics({ entries, wrong });
        } else {
            errorTopics = buildHomeworkErrorTopics({
                assignedTopic: 'Genel',
                wrong
            });
        }
    }

    const returnToDashboard = window._homeworkDashboardReturn;
    const returnToDetailId = window._homeworkDetailReturnId;

    const renderAfterSave = () => {
        if (returnToDetailId === hwId) {
            window._homeworkDetailReturnId = null;
            openHomeworkDetailModal(studentId, hwId);
        } else if (returnToDashboard) {
            window._homeworkDashboardReturn = null;
            renderOdevTakibi(returnToDashboard.studentId || null, returnToDashboard);
        } else {
            renderStudentOdevDetay(studentId);
        }
    };

    if (store.useFirestore && isFirebaseActive) {
        db.collection("homeworks").doc(hwId).update({
            durum: "tamamlandi",
            dogru: correct,
            yanlis: wrong,
            yanlisKonular: errorTopics
        }).then(() => {
            document.getElementById('homeworkResultModal')?.remove();
            renderAfterSave();
        }).catch(err => console.error(err));
    } else {
        const students = loadStudentsData();
        const sIdx = students.findIndex(s => s.id === studentId);
        if (sIdx !== -1) {
            const hwIdx = students[sIdx].odevler.findIndex(o => o.id === hwId);
            if (hwIdx !== -1) {
                students[sIdx].odevler[hwIdx].durum = "tamamlandi";
                students[sIdx].odevler[hwIdx].dogru = correct;
                students[sIdx].odevler[hwIdx].yanlis = wrong;
                students[sIdx].odevler[hwIdx].yanlisKonular = errorTopics;
                saveStudentsData(students);
            }
        }
        document.getElementById('homeworkResultModal')?.remove();
        renderAfterSave();
    }
}

export function openHomeworkDetailModal(studentId, homeworkId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const homework = getStudentOdevler(student).find(o => o.id === homeworkId);
    if (!homework) return;

    const reportData = buildHomeworkReportData({
        student,
        homework,
        teacherProfile: {
            name: store.teacherName,
            school: store.teacherSchool
        }
    });

    const isCompleted = homework.durum === 'tamamlandi';
    const accuracy = reportData.successRate || 0;
    const net = reportData.net || 0;

    const modalHtml = `
        <div class="app-modal-backdrop" onclick="closeHomeworkDetailModal()">
            <div class="app-modal max-w-lg max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="app-modal-header border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div>
                        <span class="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">CanFenci</span>
                        <span class="text-xs text-gray-400 dark:text-gray-500 font-medium ml-1">Ödev Değerlendirmesi</span>
                        <h2 class="app-page-title text-xl mt-0.5">Öğrenci Performans Raporu</h2>
                    </div>
                    <button onclick="closeHomeworkDetailModal()" class="app-modal-close" aria-label="Pencereyi kapat">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="app-modal-body space-y-4 pt-3">
                    <!-- Student & Meta Info Card -->
                    <div class="bg-gray-50 dark:bg-gray-900/60 p-3.5 rounded-xl border border-gray-200/70 dark:border-gray-800 flex justify-between items-center">
                        <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Öğrenci</span>
                            <span class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(student.adSoyad)}</span>
                            <span class="text-xs text-gray-500 ml-1">(${escapeHtml(student.sinif)}. Sınıf)</span>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Tarih</span>
                            <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">${reportData.reportDate}</span>
                        </div>
                    </div>

                    <!-- Homework Info Card -->
                    <div class="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Ödev Detayı</span>
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}">
                                ${isCompleted ? 'Tamamlandı' : 'Bekliyor'}
                            </span>
                        </div>
                        <div class="text-sm font-bold text-gray-800 dark:text-gray-100">
                            ${escapeHtml(reportData.konu)}${reportData.calismaDetayi ? ` · ${escapeHtml(reportData.calismaDetayi)}` : ''}
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 pt-1">
                            <div><span class="text-gray-400">Yayın:</span> ${escapeHtml(reportData.yayin)}</div>
                            <div><span class="text-gray-400">Tür:</span> ${escapeHtml(reportData.tur)}</div>
                            <div><span class="text-gray-400">Veriliş:</span> ${escapeHtml(reportData.baslamaTarihi || '-')}</div>
                            <div><span class="text-gray-400">Teslim:</span> ${escapeHtml(reportData.bitisTarihi || '-')}</div>
                        </div>
                    </div>

                    <!-- Performance Summary -->
                    ${isCompleted ? `
                        <div class="space-y-2">
                            <span class="text-xs font-black uppercase tracking-wider text-gray-500 block">Performans Özeti</span>
                            <div class="grid grid-cols-4 gap-2 text-center">
                                <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                                    <div class="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">Doğru</div>
                                    <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${reportData.correct}</div>
                                </div>
                                <div class="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50">
                                    <div class="text-[10px] font-black uppercase text-rose-800 dark:text-rose-300">Yanlış</div>
                                    <div class="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">${reportData.wrong}</div>
                                </div>
                                <div class="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <div class="text-[10px] font-black uppercase text-gray-600 dark:text-gray-400">Boş</div>
                                    <div class="text-lg font-black text-gray-700 dark:text-gray-300 mt-0.5">${reportData.emptyCount}</div>
                                </div>
                                <div class="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50">
                                    <div class="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300">Net</div>
                                    <div class="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">${net.toFixed(2)}</div>
                                </div>
                            </div>

                            <!-- Progress Bar -->
                            <div class="bg-gray-100 dark:bg-gray-700/60 p-2.5 rounded-xl space-y-1.5 mt-2">
                                <div class="flex justify-between text-xs font-bold">
                                    <span class="text-gray-700 dark:text-gray-300">Soru Dağılımı</span>
                                    <span class="text-blue-600 dark:text-blue-400">%${accuracy} Başarı</span>
                                </div>
                                <div class="w-full bg-gray-200 dark:bg-gray-600 h-2.5 rounded-full overflow-hidden flex">
                                    <div class="bg-emerald-500 h-full" style="width: ${reportData.totalQuestions > 0 ? (reportData.correct / reportData.totalQuestions * 100) : 0}%" title="Doğru"></div>
                                    <div class="bg-rose-500 h-full" style="width: ${reportData.totalQuestions > 0 ? (reportData.wrong / reportData.totalQuestions * 100) : 0}%" title="Yanlış"></div>
                                    <div class="bg-gray-400 h-full" style="width: ${reportData.totalQuestions > 0 ? (reportData.emptyCount / reportData.totalQuestions * 100) : 0}%" title="Boş"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Teacher Evaluation Text -->
                        <div class="p-3.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-200/60 dark:border-blue-900/50 space-y-1.5">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                    <i class="fas fa-chart-line text-blue-600 dark:text-blue-400"></i> Akademik Değerlendirme
                                </span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                                    ${reportData.evalStatus}
                                </span>
                            </div>
                            <p class="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                                ${escapeHtml(reportData.evalMessage)}
                            </p>
                        </div>

                        <!-- Error Topics if any -->
                        ${reportData.yanlisKonular && reportData.yanlisKonular.length > 0 ? `
                            <div class="p-3.5 bg-red-50/40 dark:bg-red-950/20 rounded-xl border border-red-200/60 dark:border-red-900/50">
                                <div class="flex items-center gap-2 mb-2">
                                    <i class="fas fa-list-check text-red-600 dark:text-red-400 text-xs"></i>
                                    <span class="text-xs font-black uppercase tracking-wider text-red-900 dark:text-red-200">Yanlış Analizi</span>
                                </div>
                                <div class="space-y-2">
                                    ${reportData.yanlisKonular.map(item => {
                                        const mainTitle = item.unite || item.konu || 'Genel';
                                        const subTitle = (item.konu && item.unite && item.konu !== item.unite) ? item.konu : (item.altKonu || '');
                                        return `
                                            <div class="bg-white/90 dark:bg-gray-800/90 p-2.5 rounded-lg border border-red-100 dark:border-red-900/40 flex flex-col gap-1 shadow-2xs">
                                                <div class="flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200">
                                                    <span>• ${escapeHtml(mainTitle)}${subTitle ? ` › <span class="text-gray-500 font-normal">${escapeHtml(subTitle)}</span>` : ''}</span>
                                                    <span class="px-2 py-0.5 rounded text-[11px] font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">${item.adet} Yanlış</span>
                                                </div>
                                                ${item.hataNedenleri && item.hataNedenleri.length > 0 ? `
                                                    <div class="flex flex-wrap gap-1 mt-1">
                                                        ${item.hataNedenleri.map(reason => `
                                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">${escapeHtml(normalizeHataNedeniLabel(reason))}</span>
                                                        `).join('')}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Teacher Note if any -->
                        ${reportData.teacherNote ? `
                            <div class="p-3.5 bg-slate-50 dark:bg-gray-855 rounded-xl border border-gray-200 dark:border-gray-700">
                                <span class="text-xs font-black uppercase tracking-wider text-gray-500 block mb-1">Öğretmen Notu</span>
                                <p class="text-xs text-gray-700 dark:text-gray-300 italic">"${escapeHtml(reportData.teacherNote)}"</p>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="py-6 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <i class="fas fa-hourglass-half text-2xl text-amber-500 mb-2"></i>
                            <p class="font-bold text-sm text-gray-800 dark:text-gray-200">Bu ödev henüz sonuçlandırılmadı</p>
                            <p class="text-xs text-gray-500 mt-1">Öğrencinin doğru ve yanlış sayılarını girerek performans raporunu oluşturabilirsiniz.</p>
                            <button onclick="closeHomeworkDetailModal(); showEnterOdevSonucModal('${studentId}', '${homeworkId}');" class="btn-primary mt-3 px-4 py-2 text-xs font-bold min-h-[44px]">
                                <i class="fas fa-pen mr-1"></i> Sonuç Gir
                            </button>
                        </div>
                    `}

                    <!-- Actions -->
                    ${isCompleted ? `
                        <div class="pt-2 space-y-2">
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <button onclick="downloadHomeworkPdfReport('${studentId}', '${homeworkId}')" class="btn-primary py-2.5 px-2 rounded-xl font-bold text-xs min-h-[44px] flex items-center justify-center gap-1 shadow-md">
                                    <i class="fas fa-file-pdf"></i> PDF İndir
                                </button>
                                <button onclick="shareHomeworkReport('${studentId}', '${homeworkId}')" class="border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 py-2.5 px-2 rounded-xl font-bold text-xs min-h-[44px] flex items-center justify-center gap-1 transition">
                                    <i class="fas fa-share-nodes"></i> Paylaş
                                </button>
                                <button onclick="sendHomeworkReportWhatsApp('${studentId}', '${homeworkId}')" class="border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 py-2.5 px-2 rounded-xl font-bold text-xs min-h-[44px] flex items-center justify-center gap-1 transition">
                                    <i class="fab fa-whatsapp"></i> WhatsApp
                                </button>
                                <button onclick="window._homeworkDetailReturnId = '${homeworkId}'; closeHomeworkDetailModal(); showEnterOdevSonucModal('${studentId}', '${homeworkId}');" class="border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 py-2.5 px-2 rounded-xl font-bold text-xs min-h-[44px] flex items-center justify-center gap-1 transition" title="Sonuç ve yanlış analizini düzenle">
                                    <i class="fas fa-pen-to-square"></i> Düzenle
                                </button>
                            </div>
                            <p class="text-[11px] text-gray-500 dark:text-gray-400 text-center pt-1"><i class="fas fa-info-circle mr-1 text-blue-500"></i>WhatsApp mesajını açtıktan sonra indirdiğiniz PDF raporunu görüşmeye ekleyebilirsiniz.</p>
                            <button onclick="closeHomeworkDetailModal()" class="w-full border border-gray-300 dark:border-gray-600 py-2.5 rounded-xl font-bold text-xs min-h-[44px] text-gray-700 dark:text-gray-300">
                                Kapat
                            </button>
                        </div>
                    ` : `
                        <div class="pt-2 flex gap-2">
                            <button onclick="sendSingleHwReminder('${studentId}', '${homeworkId}')" class="flex-1 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/30 py-3 px-3 rounded-xl font-bold text-xs min-h-[44px] flex items-center justify-center gap-1.5">
                                <i class="fab fa-whatsapp"></i> Veliye Hatırlat
                            </button>
                            <button onclick="closeHomeworkDetailModal()" class="border border-gray-300 dark:border-gray-600 px-4 py-3 rounded-xl font-bold text-xs min-h-[44px] text-gray-700 dark:text-gray-300">
                                Kapat
                            </button>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

    const existing = document.getElementById('homeworkDetailModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'homeworkDetailModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

export function closeHomeworkDetailModal() {
    document.getElementById('homeworkDetailModal')?.remove();
}

export function downloadHomeworkPdfReport(studentId, homeworkId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const homework = getStudentOdevler(student).find(o => o.id === homeworkId);
    if (!homework) return;

    const reportData = buildHomeworkReportData({ student, homework });
    if (!reportData) return;

    const filename = normalizeReportFilename({
        studentName: reportData.studentName,
        homeworkTitle: reportData.konu,
        date: reportData.reportDateIso
    });

    try {
        const doc = generateHomeworkPdf(reportData);
        doc.save(filename);
    } catch (err) {
        console.error("PDF oluşturma hatası:", err);
        alert("PDF oluşturulurken bir hata oluştu: " + err.message);
    }
}

export async function shareHomeworkReport(studentId, homeworkId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const homework = getStudentOdevler(student).find(o => o.id === homeworkId);
    if (!homework) return;

    const reportData = buildHomeworkReportData({ student, homework });
    if (!reportData) return;

    const filename = normalizeReportFilename({
        studentName: reportData.studentName,
        homeworkTitle: reportData.konu,
        date: reportData.reportDateIso
    });

    try {
        const doc = generateHomeworkPdf(reportData);
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
                title: `CanFenci - ${reportData.studentName} Ödev Raporu`,
                text: `${reportData.studentName} öğrencimizin ${reportData.konu} ödev performans raporu.`,
                files: [pdfFile]
            });
            return;
        } else if (navigator.share) {
            await navigator.share({
                title: `CanFenci - ${reportData.studentName} Ödev Raporu`,
                text: buildWhatsAppReportMessage(reportData)
            });
            return;
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.warn("Paylaşım desteklenmiyor veya iptal edildi, PDF indiriliyor:", err);
        }
    }
    // Fallback: download PDF
    downloadHomeworkPdfReport(studentId, homeworkId);
}

export function sendHomeworkReportWhatsApp(studentId, homeworkId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!student.veliTel) {
        alert("Lütfen bu öğrenci için önce veli telefon numarası giriniz.");
        if (window.editStudent) window.editStudent(studentId);
        return;
    }
    const homework = getStudentOdevler(student).find(o => o.id === homeworkId);
    if (!homework) return;

    const reportData = buildHomeworkReportData({ student, homework });
    const message = buildWhatsAppReportMessage(reportData);

    let phone = student.veliTel.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '90' + phone.substring(1);
    else if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

export function shareHomeworkWhatsApp(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!student.veliTel) {
        alert("Lütfen bu öğrenci için önce veli telefon numarası giriniz.");
        if (window.editStudent) window.editStudent(studentId);
        return;
    }
    const odevler = getStudentOdevler(student);
    if (odevler.length === 0) {
        alert("Atanmış ödev bulunmuyor.");
        return;
    }
    let message = `Merhaba Sayın Velimiz,\n\n*${student.adSoyad}* isimli öğrencimizin aktif ödev takip raporu aşağıdaki gibidir:\n\n`;
    for (let o of odevler) {
        const isCompleted = o.durum === 'tamamlandi';
        if (isCompleted) {
            message += `✅ *${o.konu}* (${o.yayin}${o.calismaDetayi ? ` · ${o.calismaDetayi}` : ''} - ${o.tur})\n`;
            message += `  - Durum: Tamamlandı\n`;
            message += `  - Sonuç: ${o.dogru} Doğru, ${o.yanlis} Yanlış\n\n`;
        } else {
            message += `⏳ *${o.konu}* (${o.yayin}${o.calismaDetayi ? ` · ${o.calismaDetayi}` : ''} - ${o.tur})\n`;
            message += `  - Durum: Bekliyor\n`;
            message += `  - Son Teslim: ${o.bitisTarihi}\n`;
            message += `  - Sonucu doğru/yanlış sayılarıyla bu mesajı yanıtlayarak iletebilirsiniz.\n\n`;
        }
    }
    message += `İyi çalışmalar dileriz.`;
    let phone = student.veliTel.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '90' + phone.substring(1);
    else if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

export function showOdevAtaModal() {
    window._geciciOdevListesi = [];
    renderOdevAtaModal(null, null);
}

export function renderOdevAtaModal(preSelectedStudentIds = null, lessonContext = null) {
    window._odevDersContext = lessonContext;
    const lessonContextHtml = lessonContext ? `
        <div class="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300">
            <div class="font-bold"><i class="fas fa-link"></i> Ders kaydına bağlı ödev</div>
            <div class="mt-1">${escapeHtml(lessonContext.ders)} · ${escapeHtml(lessonContext.konu)} · ${escapeHtml(lessonContext.tarih)}</div>
        </div>
    ` : '';
    const modalHtml = `
        <div id="odevAtaModal" class="app-modal-backdrop" onclick="if(event.target===this) closeOdevAtaModal()">
            <div class="app-modal max-w-2xl" onclick="event.stopPropagation()">
                <div class="app-modal-header"><div><h2 class="app-page-title text-xl">Ödev Ata</h2><p class="app-page-subtitle">Ödev ayrıntılarını belirleyip öğrencilere toplu olarak atayın.</p></div><button onclick="closeOdevAtaModal()" class="app-modal-close" aria-label="Pencereyi kapat"><i class="fas fa-times"></i></button></div>
                <div class="app-modal-body space-y-4">
                    ${lessonContextHtml}
                    <div>
                        <label class="block text-sm font-bold mb-1">Sınıf Seviyesi Seçin (Dinamik Filtreleme)</label>
                        <select id="odevGradeSelect" class="student-form-input min-h-[44px]">
                            <option value="" disabled selected>Sınıf Seçiniz</option>
                            <option value="5">5. Sınıf</option>
                            <option value="6">6. Sınıf</option>
                            <option value="7">7. Sınıf</option>
                            <option value="8">8. Sınıf (LGS)</option>
                        </select>
                    </div>
                    <div id="odevDetayForm" class="hidden bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border space-y-3">
                        <h3 class="font-bold text-sm text-gray-700 dark:text-gray-300">Ödev Bilgileri</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Başlama Tarihi</label>
                                <input type="date" id="odevBaslamaTarihi" class="student-form-input min-h-[44px]">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Bitiş Tarihi</label>
                                <input type="date" id="odevBitisTarihi" class="student-form-input min-h-[44px]">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 mb-1">Ders</label>
                            <select id="odevDersSelect" onchange="onOdevSubjectChanged()" class="student-form-input min-h-[44px]">
                                <option value="">Ders seçin</option>
                                ${(store.teacherBranches || []).map(subject => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 mb-1">Ödev Konusu</label>
                            <select id="odevKonuSelect" class="student-form-input min-h-[44px]"></select>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Ödevin Türü</label>
                                <select id="odevTurSelect" class="student-form-input min-h-[44px]">
                                    <option value="Konu Denemesi">Konu Denemesi</option>
                                    <option value="Konu Testi">Konu Testi</option>
                                    <option value="Örnek Sınavlar">Örnek Sınavlar</option>
                                    <option value="Konu Tekrarı" selected>Konu Tekrarı</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Kaynak Kitap / Yayın</label>
                                <select id="odevYayinSelect" onchange="toggleOdevManualResource()" class="student-form-input min-h-[44px]"><option value="">Önce sınıf ve ders seçin</option></select>
                                <div id="odevYayinManualArea" class="hidden mt-2"><input type="text" id="odevYayinInput" placeholder="Kaynak adını manuel girin" class="student-form-input min-h-[44px]"></div>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 mb-1">Çalışma Detayı</label>
                            <input type="text" id="odevCalismaDetayi" maxlength="120" placeholder="Örn: 1. Deneme, Test 24-25 veya Sayfa 40-45" class="student-form-input min-h-[44px]">
                            <p class="text-xs text-gray-400 mt-1">Kaynakta öğrencinin çözeceği bölümü belirtin.</p>
                        </div>
                        <button onclick="addOdevToGeciciList()" class="btn-secondary w-full py-2.5 text-sm flex items-center justify-center gap-1 min-h-[44px]">
                            <i class="fas fa-plus"></i> Listeye Ödev Ekle
                        </button>
                    </div>
                    <div id="geciciOdevListesiArea" class="hidden">
                        <h4 class="font-bold text-sm mb-2">Eklenecek Ödevler:</h4>
                        <div id="geciciOdevListContainer" class="space-y-2 border p-3 rounded-xl bg-gray-50 dark:bg-gray-900/30 max-h-36 overflow-y-auto"></div>
                    </div>
                    <div id="odevOgrenciSecimArea" class="hidden">
                        <label class="block text-sm font-bold mb-1">Öğrenci Seçimi:</label>
                        <div id="odevOgrenciChecklist" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-3 rounded-xl bg-gray-50 dark:bg-gray-900/30"></div>
                    </div>
                    <button id="odevAtaSubmitBtn" class="btn-primary hidden w-full py-3 mt-3 min-h-[44px]">
                        <i class="fas fa-check mr-1"></i> Seçilen Öğrencilere Ata
                    </button>
                </div>
            </div>
        </div>
    `;
    const existing = document.getElementById('odevAtaModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'odevAtaModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
    
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    document.getElementById('odevBaslamaTarihi').value = today;
    document.getElementById('odevBitisTarihi').value = nextWeek;
    
    document.getElementById('odevGradeSelect').addEventListener('change', (e) => {
        onOdevGradeChanged(e.target.value);
    });
    document.getElementById('odevAtaSubmitBtn').addEventListener('click', () => submitBatchOdev());

    if (preSelectedStudentIds && preSelectedStudentIds.length > 0) {
        const students = loadStudentsData();
        const firstStudent = students.find(s => s.id === preSelectedStudentIds[0]);
        if (firstStudent) {
            const grade = firstStudent.sinif;
            document.getElementById('odevGradeSelect').value = grade;
            onOdevGradeChanged(grade, preSelectedStudentIds);
            if (lessonContext) {
                document.getElementById('odevTurSelect').value = 'Konu Denemesi';
                document.getElementById('odevBaslamaTarihi').value = lessonContext.tarih;
                document.getElementById('odevDersSelect').value = lessonContext.ders;
                onOdevSubjectChanged();
                if (lessonContext.kaynak) {
                    const resourceSelect = document.getElementById('odevYayinSelect');
                    const hasResource = Array.from(resourceSelect.options).some(option => option.value === lessonContext.kaynak);
                    resourceSelect.value = hasResource ? lessonContext.kaynak : '__manual__';
                    if (!hasResource) document.getElementById('odevYayinInput').value = lessonContext.kaynak;
                    toggleOdevManualResource();
                }
                const topicSelect = document.getElementById('odevKonuSelect');
                const hasLessonTopic = Array.from(topicSelect.options).some(option => option.value === lessonContext.konu);
                if (!hasLessonTopic) topicSelect.add(new Option(lessonContext.konu, lessonContext.konu));
                topicSelect.value = lessonContext.konu;
            }
        }
    }
}

export function closeOdevAtaModal() {
    document.getElementById('odevAtaModal')?.remove();
    window._odevDersContext = null;
    window._homeworkReturnToCockpit = null;
}

export function onOdevGradeChanged(grade, preSelectedStudentIds = null) {
    document.getElementById('odevDetayForm').classList.remove('hidden');
    document.getElementById('odevOgrenciSecimArea').classList.remove('hidden');
    document.getElementById('odevAtaSubmitBtn').classList.remove('hidden');
    
    onOdevSubjectChanged();
    
    const students = loadStudentsData();
    const filtered = students.filter(s => s.sinif === grade);
    const checklist = document.getElementById('odevOgrenciChecklist');
    if (filtered.length === 0) {
        checklist.innerHTML = `<span class="text-xs text-gray-500 col-span-2 text-center py-2">Bu sınıf seviyesinde öğrenci bulunmuyor.</span>`;
    } else {
        checklist.innerHTML = filtered.map(s => {
            const isChecked = preSelectedStudentIds && preSelectedStudentIds.includes(s.id) ? 'checked' : '';
            return `
            <label class="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition">
                <input type="checkbox" value="${s.id}" ${isChecked} class="odevStudentCheck rounded border-gray-300 dark:border-gray-600 text-blue-600">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">${escapeHtml(s.adSoyad)}</span>
            </label>
            `;
        }).join('');
    }
}

export function onOdevSubjectChanged() {
    const grade = document.getElementById('odevGradeSelect')?.value || '';
    const subject = document.getElementById('odevDersSelect')?.value || '';
    const topicSelect = document.getElementById('odevKonuSelect');
    if (topicSelect) topicSelect.innerHTML = '<option value="">Konu seçin</option>' + getKonuListesiBySinifAndDers(grade, subject).map(topic => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('');
    const resourceSelect = document.getElementById('odevYayinSelect');
    if (resourceSelect) resourceSelect.innerHTML = resourceOptionsHtml(grade, subject, escapeHtml);
    toggleManualResource('odevYayinSelect', 'odevYayinManualArea');
}

export function toggleOdevManualResource() {
    toggleManualResource('odevYayinSelect', 'odevYayinManualArea');
}

export function addOdevToGeciciList() {
    const konu = document.getElementById('odevKonuSelect').value;
    const baslama = document.getElementById('odevBaslamaTarihi').value;
    const bitis = document.getElementById('odevBitisTarihi').value;
    const tur = document.getElementById('odevTurSelect').value;
    const ders = document.getElementById('odevDersSelect')?.value || '';
    const yayin = readResourceSelection('odevYayinSelect', 'odevYayinInput');
    const calismaDetayi = document.getElementById('odevCalismaDetayi')?.value.trim() || '';
    if (!ders || !konu || !yayin || !calismaDetayi) {
        alert("Lütfen ders, konu, kaynak ve çalışma detayı bilgilerini eksiksiz doldurun.");
        return;
    }
    const newHw = {
        id: "hw_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        baslamaTarihi: baslama,
        bitisTarihi: bitis,
        konu: konu,
        ders,
        tur: tur,
        yayin: yayin,
        calismaDetayi,
        durum: "verildi",
        dogru: null,
        yanlis: null,
        ...(window._odevDersContext ? { kaynakDers: { ...window._odevDersContext } } : {})
    };
    window._geciciOdevListesi.push(newHw);
    document.getElementById('geciciOdevListesiArea').classList.remove('hidden');
    renderGeciciOdevListUI();
    document.getElementById('odevYayinInput').value = '';
    document.getElementById('odevCalismaDetayi').value = '';
    showSyncStatus("✅ Ödev listeye eklendi", false);
}

export function renderGeciciOdevListUI() {
    const container = document.getElementById('geciciOdevListContainer');
    container.innerHTML = window._geciciOdevListesi.map((o, idx) => `
        <div class="flex justify-between items-center text-xs border-b pb-1">
            <span class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(o.konu)} (${escapeHtml(o.yayin)} · ${escapeHtml(o.calismaDetayi)} - ${escapeHtml(o.tur)})</span>
            <button onclick="removeOdevFromGeciciList(${idx})" class="text-red-500"><i class="fas fa-times-circle"></i></button>
        </div>
    `).join('');
}

export function removeOdevFromGeciciList(idx) {
    window._geciciOdevListesi.splice(idx, 1);
    renderGeciciOdevListUI();
    if (window._geciciOdevListesi.length === 0) {
        document.getElementById('geciciOdevListesiArea').classList.add('hidden');
    }
}

export function submitBatchOdev() {
    const yayin = readResourceSelection('odevYayinSelect', 'odevYayinInput');
    if (window._geciciOdevListesi.length === 0) {
        if (yayin) {
            addOdevToGeciciList();
        } else {
            alert("Lütfen önce en az bir ödev ekleyin.");
            return;
        }
    }
    const checkedBoxes = document.querySelectorAll('.odevStudentCheck:checked');
    const selectedStudentIds = Array.from(checkedBoxes).map(cb => cb.value);
    if (selectedStudentIds.length === 0) {
        alert("Lütfen ödev atamak için en az bir öğrenci seçin.");
        return;
    }
    if (store.useFirestore && isFirebaseActive) {
        const students = loadStudentsData();
        const user = auth.currentUser;
        const userId = user ? user.uid : null;
        selectedStudentIds.forEach(sid => {
            const student = students.find(s => s.id === sid);
            const studentName = student ? student.adSoyad : "";
            window._geciciOdevListesi.forEach(o => {
                const uniqueId = o.id + "_" + sid;
                const newHw = { ...o, id: uniqueId, studentId: sid, studentName: studentName };
                if (userId) newHw.userId = userId;
                db.collection("homeworks").doc(uniqueId).set(newHw).catch(err => console.error(err));
            });
        });
        showSyncStatus("✅ Ödevler buluta eklendi", false);
    } else {
        const students = loadStudentsData();
        for (let sid of selectedStudentIds) {
            const sIdx = students.findIndex(s => s.id === sid);
            if (sIdx !== -1) {
                if (!students[sIdx].odevler) students[sIdx].odevler = [];
                const clonedList = JSON.parse(JSON.stringify(window._geciciOdevListesi));
                clonedList.forEach(o => {
                    o.id = o.id + "_" + sid;
                    o.studentId = sid;
                    o.studentName = students[sIdx].adSoyad;
                });
                students[sIdx].odevler.push(...clonedList);
            }
        }
        saveStudentsData(students);
    }
    const lessonContext = window._odevDersContext;
    const cockpitReturnStudentId = window._homeworkReturnToCockpit;
    const cockpitReturnOrigin = window._homeworkReturnOrigin || 'home';
    showSyncStatus(`✅ ${selectedStudentIds.length} öğrenciye ${window._geciciOdevListesi.length} ödev atandı`, false);
    closeOdevAtaModal();
    if (lessonContext && selectedStudentIds.length === 1 && window.renderDersDetay) {
        window.renderDersDetay(selectedStudentIds[0]);
    } else if (cockpitReturnStudentId && window.renderStudentCockpit) {
        window.renderStudentCockpit(cockpitReturnStudentId, cockpitReturnOrigin);
    } else {
        renderOdevTakibi();
    }
}

// Global window mappings for compatibility
window.hideNavigationElements = hideNavigationElements;
window.renderParentHwPasscodeScreen = renderParentHwPasscodeScreen;
window.verifyHwPasscode = verifyHwPasscode;
window.renderParentHwEntry = renderParentHwEntry;
window.submitParentHwResult = submitParentHwResult;
window.importHwResult = importHwResult;
window.renderOdevTakibi = renderOdevTakibi;
window.updateHomeworkDashboardFilters = updateHomeworkDashboardFilters;
window.openHomeworkResultFromBoard = openHomeworkResultFromBoard;
window.renderStudentOdevDetay = renderStudentOdevDetay;
window.deleteOdev = deleteOdev;
window.sendSingleHwReminder = sendSingleHwReminder;
window.openHomeworkDetailModal = openHomeworkDetailModal;
window.closeHomeworkDetailModal = closeHomeworkDetailModal;
window.downloadHomeworkPdfReport = downloadHomeworkPdfReport;
window.shareHomeworkReport = shareHomeworkReport;
window.sendHomeworkReportWhatsApp = sendHomeworkReportWhatsApp;
window.generateHomeworkPdf = generateHomeworkPdf;
window.buildHomeworkReportData = buildHomeworkReportData;
window.normalizeReportFilename = normalizeReportFilename;
window.buildWhatsAppReportMessage = buildWhatsAppReportMessage;
window.showEnterOdevSonucModal = showEnterOdevSonucModal;
window.saveManualOdevResult = saveManualOdevResult;
window.shareHomeworkWhatsApp = shareHomeworkWhatsApp;
window.showOdevAtaModal = showOdevAtaModal;
window.renderOdevAtaModal = renderOdevAtaModal;
window.closeOdevAtaModal = closeOdevAtaModal;
window.onOdevGradeChanged = onOdevGradeChanged;
window.onOdevSubjectChanged = onOdevSubjectChanged;
window.toggleOdevManualResource = toggleOdevManualResource;
window.addOdevToGeciciList = addOdevToGeciciList;
window.renderGeciciOdevListUI = renderGeciciOdevListUI;
window.removeOdevFromGeciciList = removeOdevFromGeciciList;
window.submitBatchOdev = submitBatchOdev;
window._geciciOdevListesi = [];
window._currentOdevStudentId = null;
window._odevDersContext = null;
window._homeworkDashboardFilters = null;
window._homeworkDashboardReturn = null;
window._homeworkReturnToCockpit = null;
