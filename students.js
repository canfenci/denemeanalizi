// ==================== STUDENTS MANAGEMENT MODULE ====================

import { db, auth, isFirebaseActive } from './firebase-config.js';
import { store, loadStudentsData, saveStudentsData, createStudentDocument, updateStudentProfile, loadSchedule, loadDersKayitlari, getStudentOdevler, getKonuListesiBySinif, escapeHtml, POPULER_LISELER, HATA_KODLARI, getErrorColor, GENEL_DERSLER_KEY, GENEL_DERSLER_GORUNUM, localDataKey } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { updateMobileNavActive } from './auth.js';
import { getBransOrtalamaNet, getGenelOrtalamaNet, getOrtalamaNet, getKonuBazliBasarilar, getBestWorstTopics, getMotivationMessage, getHataIstatistikleri, lgsPuanHesapla, isExamResultPending } from './exams.js';
import { buildStudentTimeline, calculateSmartExamAnalysis, calculateStudentSummary, formatTimelineDate } from './student-insights.js';
import { validateStudentInput } from './data-validation.js';
import { renderLessonReminderCenter } from './lesson-reminders.js';
import { calculateTopicExamProgress } from './topic-exam-insights.js';
import { addResourceBook, deleteResourceBook, loadResourceBooks } from './resource-books.js';
import { backupFileName, buildFullBackup, summarizeBackupData, validateFullBackup } from './backup.js';
import { buildCockpitStatusItems, cockpitTimelineIcons, formatCockpitNet, getCockpitData, getStudentInitials } from './student-cockpit-insights.js';

let selectedSettingsResourceGrade = '';

export function onTargetSchoolChanged(selectEl, netInputId, customAreaId) {
    const customArea = document.getElementById(customAreaId);
    const netInput = document.getElementById(netInputId);
    if (selectEl.value === "Diger") {
        if (customArea) customArea.style.display = 'block';
        if (netInput) {
            netInput.value = "";
            netInput.removeAttribute('readonly');
        }
    } else {
        if (customArea) customArea.style.display = 'none';
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const net = selectedOption.getAttribute('data-net');
        if (netInput) {
            netInput.value = net;
            netInput.setAttribute('readonly', 'true');
        }
    }
}

export function renderHomeScreen() {
    store.currentPage = "home";
    if (window.currentPage) window.currentPage = "home";
    updateMobileNavActive('mobile-nav-home');
    const students = loadStudentsData();
    let filtered = students;
    if (store.activeFilter !== "all") {
        filtered = students.filter(s => s.sinif === store.activeFilter);
    }
    const sorted = getSortedStudents(filtered, store.currentSortOrder);
    
    const filterHtml = `
        <div class="flex gap-2 mb-4 flex-wrap">
            <button onclick="setFilter('all')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.activeFilter === 'all' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Tümü</button>
            <button onclick="setFilter('5')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.activeFilter === '5' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">5. Sınıf</button>
            <button onclick="setFilter('6')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.activeFilter === '6' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">6. Sınıf</button>
            <button onclick="setFilter('7')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.activeFilter === '7' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">7. Sınıf</button>
            <button onclick="setFilter('8')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.activeFilter === '8' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">8. Sınıf</button>
        </div>
    `;
    
    const sortHtml = `
        <div class="flex gap-2 mb-4 flex-wrap">
            <button onclick="setSortOrder('default')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.currentSortOrder === 'default' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Varsayılan</button>
            <button onclick="setSortOrder('net-desc')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.currentSortOrder === 'net-desc' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Ort.Net (Yüksek↓)</button>
            <button onclick="setSortOrder('net-asc')" class="px-4 py-2.5 min-h-[44px] rounded-full text-sm font-bold border transition ${store.currentSortOrder === 'net-asc' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Ort.Net (Düşük↑)</button>
        </div>
    `;
    
    const studentsHtml = sorted.length === 0 
        ? `<div class="app-panel col-span-full cf-empty-state">
            <div class="cf-empty-icon"><i class="fas fa-users"></i></div>
            <h3 class="cf-empty-title">Kayıtlı Öğrenci Bulunmuyor</h3>
            <p class="cf-empty-desc">Sisteme ilk öğrencinizi ekleyerek deneme analizleri, ödev takibi ve rehberlik planlamalarını başlatabilirsiniz.</p>
            <button onclick="showAddStudentModal()" class="cf-btn-primary min-h-[44px]"><i class="fas fa-plus mr-1"></i> Yeni Öğrenci Ekle</button>
        </div>`
        : sorted.map(s => {
            const sinifGoster = s.sinif ? `${s.sinif}. Sınıf` : "Sınıf belirtilmemiş";
            
            return `
                <div onclick="selectStudent('${s.id}')" class="app-panel p-5 relative cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition">
                    <div class="pr-16">
                        <h3 class="text-xl font-bold">${escapeHtml(s.adSoyad)}</h3>
                        <p class="text-base text-gray-600 dark:text-gray-300">${escapeHtml(s.okul || 'Okul belirtilmemiş')} · ${escapeHtml(sinifGoster)}</p>
                    </div>
                    <div class="absolute top-2 right-2 flex gap-1">
                        <button onclick="event.stopPropagation(); editStudent('${s.id}')" class="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" title="Düzenle" aria-label="Öğrenciyi düzenle"><i class="fas fa-pen"></i></button>
                        <button onclick="event.stopPropagation(); deleteStudent('${s.id}')" class="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" title="Sil" aria-label="Öğrenciyi sil"><i class="fas fa-trash"></i></button>
                    </div>
                    <div class="text-sm font-bold text-indigo-600 dark:text-indigo-300 mt-4"><i class="fas fa-arrow-right mr-1"></i> Öğrenci Kokpitini aç</div>
                </div>
            `;
        }).join('');
        
    const shortcutsHtml = `
        <div class="app-panel p-4 mb-4">
            <h3 class="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <i class="fas fa-bolt text-indigo-500"></i> Hızlı İşlemler
            </h3>
            <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                <button onclick="showAddStudentModal()" class="btn-primary flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap min-h-[44px]">
                    <i class="fas fa-user-plus text-base"></i> Yeni Öğrenci Ekle
                </button>
                <button onclick="showDenemeAtaModal()" class="btn-secondary flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap min-h-[44px]">
                    <i class="fas fa-copy text-base"></i> Toplu Deneme Ata
                </button>
            </div>
        </div>
    `;
    
    document.getElementById("dynamic-content").innerHTML = `
        <div class="app-page"><header class="app-page-header"><div><h2 class="app-page-title">Öğrenciler</h2><p class="app-page-subtitle">${sorted.length} öğrenci · ${store.activeFilter === 'all' ? 'Tüm sınıflar' : store.activeFilter + '. sınıf'}</p></div></header>${shortcutsHtml}<div class="app-panel p-4"><p class="text-xs font-black uppercase tracking-wide text-gray-500 mb-2">Sınıf</p>${filterHtml}<p class="text-xs font-black uppercase tracking-wide text-gray-500 mb-2">Sıralama</p>${sortHtml}</div><div class="grid md:grid-cols-2 gap-4">${studentsHtml}</div></div>
    `;
}

export function renderStudentSummaryPanel(id) {
    return renderStudentCockpit(id, 'home');
}

export async function renderStudentCockpit(id, origin = store.studentPanelOrigin || 'home') {
    store.currentPage = 'student';
    if (window.currentPage) window.currentPage = 'student';
    store.currentStudentId = id;
    store.studentPanelOrigin = origin;
    updateMobileNavActive(origin === 'guidance' ? 'mobile-nav-guidance' : 'mobile-nav-home');
    const student = loadStudentsData().find(item => item.id === id);
    if (!student) return renderHomeScreen();

    const homeworks = getStudentOdevler(student);
    const lessons = loadDersKayitlari(id);
    const schedule = loadSchedule(id);
    const summary = calculateStudentSummary(student, homeworks, lessons, schedule);
    const analysis = calculateSmartExamAnalysis(student, homeworks);
    const cockpit = getCockpitData({ student, homeworks, summary, analysis, timeline: buildStudentTimeline(student, homeworks, lessons) });
    const statusItems = buildCockpitStatusItems(cockpit);
    const currentOrigin = origin === 'guidance' ? 'renderGuidancePage()' : 'renderHomeScreen()';
    const currentOriginLabel = origin === 'guidance' ? 'Rehberlik' : 'Öğrenci Listesi';
    const subjectNames = Object.fromEntries(GENEL_DERSLER_KEY.map((key, index) => [key, GENEL_DERSLER_GORUNUM[index] || key]));
    const formatDate = date => formatTimelineDate(date);
    const upcomingLesson = cockpit.upcomingLesson
        ? `${new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(cockpit.upcomingLesson.date)} · ${String(cockpit.upcomingLesson.saat || '').padStart(5, '0')}`
        : 'Planlanmadı';
    const insights = [
        ['fa-arrow-trend-up', 'En güçlü ders', cockpit.strongest ? `${subjectNames[cockpit.strongest.subject] || cockpit.strongest.subject} · %${cockpit.strongest.successRate}` : 'Yeterli veri yok'],
        ['fa-triangle-exclamation', 'Kritik eksik', cockpit.criticalTopic ? `${cockpit.criticalTopic.topic} · ${cockpit.criticalTopic.errors} hata` : 'Yeterli veri yok'],
        ['fa-magnifying-glass', 'En sık hata', cockpit.mostFrequentError ? cockpit.mostFrequentError.label : 'Yeterli veri yok'],
        ['fa-bullseye', 'Bu haftaki öncelik', cockpit.priority || 'Henüz öncelik belirlenmedi']
    ];
    const timelineHtml = cockpit.timeline.length ? cockpit.timeline.slice(0, 6).map((event, index) => `
        <div class="relative flex gap-3 ${index < cockpit.timeline.length - 1 ? 'pb-4' : ''}">
            ${index < cockpit.timeline.length - 1 ? '<span class="absolute left-4 top-8 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></span>' : ''}
            <span class="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-xs text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><i class="fas ${cockpitTimelineIcons[event.category] || 'fa-circle-info'}"></i></span>
            <div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-3"><p class="font-bold text-sm text-gray-800 dark:text-gray-100">${escapeHtml(event.title)}</p><time class="shrink-0 text-xs text-gray-400">${escapeHtml(formatDate(event.date))}</time></div><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(event.detail)}</p></div>
        </div>`).join('') : '<p class="py-6 text-sm text-gray-500">Henüz etkinlik kaydı yok. Deneme, ödev veya ders kaydı eklendiğinde burada görünür.</p>';
    const statusHtml = statusItems.length ? statusItems.map(item => `<li class="flex gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0"><i class="fas ${item.icon} mt-0.5 ${item.tone === 'positive' ? 'text-emerald-600' : item.tone === 'critical' ? 'text-red-500' : item.tone === 'warning' ? 'text-amber-600' : 'text-slate-500'}"></i><span class="text-sm text-gray-700 dark:text-gray-300">${escapeHtml(item.text)}</span></li>`).join('') : '<li class="py-5 text-sm text-gray-500">Durum özeti için yeterli veri yok.</li>';
    const metrics = [
        ['fa-file-lines', 'Son deneme', summary.latestNet === null ? '—' : `${formatCockpitNet(summary.latestNet)} net`, summary.latestExam ? escapeHtml(summary.latestExam.denemeAdi || formatDate(summary.latestExam.tarih)) : 'Genel deneme kaydı yok'],
        ['fa-chart-line', `${cockpit.averageCount || 5} deneme ort.`, cockpit.averageNet === null ? '—' : `${formatCockpitNet(cockpit.averageNet)} net`, cockpit.averageCount ? `${cockpit.averageCount} karşılaştırılabilir genel deneme` : 'Yeterli veri yok'],
        ['fa-list-check', 'Ödev disiplini', cockpit.homeworkCompletionRate === null ? '—' : `%${cockpit.homeworkCompletionRate}`, cockpit.homeworkCompletionRate === null ? 'Ödev kaydı yok' : `${cockpit.completedHomeworkCount} / ${cockpit.homeworkCount} tamamlandı`],
        ['fa-bullseye', 'Hedef durumu', cockpit.targetGap === null ? '—' : cockpit.targetGap <= 0 ? 'Hedefte' : `${formatCockpitNet(cockpit.targetGap)} net`, cockpit.targetGap === null ? 'Hedef veya son deneme yok' : cockpit.targetGap <= 0 ? 'Son deneme hedefe ulaştı' : 'Hedefe kalan net']
    ];

    const rawExams = Array.isArray(student.denemeler) ? student.denemeler : [];
    const sortedExams = rawExams
        .map((exam, origIdx) => ({ exam, origIdx }))
        .sort((a, b) => {
            const dateA = a.exam.tarih || '';
            const dateB = b.exam.tarih || '';
            if (dateA !== dateB) {
                return dateB.localeCompare(dateA);
            }
            return b.origIdx - a.origIdx;
        })
        .map(item => item.exam);

    const pendingCount = sortedExams.filter(ex => isExamResultPending(ex)).length;

    let examsListHtml = '';
    if (sortedExams.length === 0) {
        examsListHtml = `
            <div class="cf-empty-state my-2">
                <div class="cf-empty-state-icon"><i class="fas fa-file-lines"></i></div>
                <div class="cf-empty-state-title">Henüz deneme eklenmemiş.</div>
                <div class="cf-empty-state-description">Öğrenciye konu veya genel deneme atayarak sonuçları buradan takip edebilirsiniz.</div>
                <button onclick="openCockpitExam('${id}')" class="btn-primary min-h-[44px] px-4 py-2 text-sm inline-flex items-center gap-2">
                    <i class="fas fa-plus"></i> Deneme Ekle
                </button>
            </div>
        `;
    } else {
        const cards = sortedExams.map(ex => {
            const isPending = isExamResultPending(ex);
            const isGenel = ex.tip === 'genel';
            const typeBadge = isGenel
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"><i class="fas fa-layer-group text-[10px] mr-1"></i> Genel Deneme</span>'
                : '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"><i class="fas fa-flask text-[10px] mr-1"></i> Konu Denemesi</span>';

            const questionCount = Number(ex.toplamSoru ?? (Array.isArray(ex.sorular) ? ex.sorular.length : 0));
            const extraDetails = [
                ex.ders,
                ex.konu,
                ex.kaynak
            ].filter(Boolean).map(escapeHtml).join(' · ');

            const dateStr = ex.tarih ? formatDate(ex.tarih) : 'Tarih yok';

            return `
                <div class="rounded-xl border ${isPending ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'} p-4 transition hover:border-gray-300 dark:hover:border-gray-600">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div class="space-y-1.5 min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <h4 class="font-bold text-sm text-gray-900 dark:text-white break-words">${escapeHtml(ex.denemeAdi || 'İsimsiz Deneme')}</h4>
                                ${typeBadge}
                                ${isPending ? '<span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"><i class="fas fa-hourglass-half text-[10px]"></i> Sonuç Bekliyor</span>' : ''}
                            </div>
                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                <span><i class="far fa-calendar mr-1"></i>${escapeHtml(dateStr)}</span>
                                <span><i class="far fa-circle-question mr-1"></i>${questionCount} soru</span>
                                ${extraDetails ? `<span><i class="fas fa-tag mr-1"></i>${extraDetails}</span>` : ''}
                            </div>
                            ${!isPending ? `
                                <div class="flex flex-wrap items-center gap-3 pt-1">
                                    <span class="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                        <strong class="text-green-600 dark:text-green-400">${ex.toplamDogru ?? 0}D</strong>
                                        <span class="mx-1 text-gray-300 dark:text-gray-600">·</span>
                                        <strong class="text-red-600 dark:text-red-400">${ex.toplamYanlis ?? 0}Y</strong>
                                        <span class="mx-1 text-gray-300 dark:text-gray-600">·</span>
                                        <strong class="text-gray-500">${ex.toplamBos ?? 0}B</strong>
                                    </span>
                                    <span class="rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-xs font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                                        ${formatCockpitNet(ex.toplamNet ?? 0)} Net
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="flex flex-wrap items-center gap-2 shrink-0">
                            ${isPending ? `
                                <button onclick="editExam('${id}', '${ex.id}')" class="btn-primary min-h-[44px] px-4 py-2 text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm">
                                    <i class="fas fa-pen-to-square"></i> Sonuç Gir
                                </button>
                            ` : `
                                <button onclick="viewExam('${id}', '${ex.id}')" class="btn-secondary min-h-[44px] px-3.5 py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                                    <i class="fas fa-eye"></i> Sonucu Gör
                                </button>
                                <button onclick="editExam('${id}', '${ex.id}')" class="btn-secondary min-h-[44px] px-3.5 py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                                    <i class="fas fa-pen"></i> Düzenle
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        examsListHtml = `<div class="mt-4 space-y-3 max-h-[580px] overflow-y-auto pr-1">${cards}</div>`;
    }

    const examsSectionHtml = `
        <section class="app-panel p-5" id="cockpit-exams-section">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                        <i class="fas fa-file-signature text-sm"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-lg font-black text-gray-900 dark:text-white">Denemeler</h3>
                            ${pendingCount > 0 ? `<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"><i class="fas fa-clock text-[10px]"></i> ${pendingCount} sonuç bekliyor</span>` : ''}
                        </div>
                        <p class="mt-0.5 text-xs text-gray-500">Atanmış ve tamamlanmış tüm denemeler</p>
                    </div>
                </div>
                <button onclick="openCockpitExam('${id}')" class="btn-secondary min-h-[44px] px-3.5 text-sm flex items-center justify-center gap-1.5 self-start sm:self-auto"><i class="fas fa-plus"></i> Deneme Ekle</button>
            </div>
            ${examsListHtml}
        </section>
    `;

    document.getElementById('dynamic-content').innerHTML = `
        <div class="app-page cf-cockpit pb-28 sm:pb-8">
            <header class="app-page-header cf-cockpit-header"><div class="flex items-start gap-4"><button onclick="${currentOrigin}" class="btn-secondary min-h-[44px] px-3" aria-label="${currentOriginLabel} sayfasına dön"><i class="fas fa-arrow-left"></i></button><div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-lg font-black tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">${escapeHtml(getStudentInitials(student.adSoyad))}</div><div><h2 class="app-page-title">${escapeHtml(student.adSoyad)}</h2><p class="app-page-subtitle">${escapeHtml(student.sinif ? `${student.sinif}. Sınıf` : 'Sınıf belirtilmemiş')} ${student.hedefNet ? `· Hedef: ${escapeHtml(student.hedefNet)} net` : ''}</p><p class="mt-1 text-xs text-gray-500">${[student.okul, student.grup, student.hedefLise].filter(Boolean).map(escapeHtml).join(' · ') || 'Ek okul veya hedef bilgisi yok'}</p></div></div><button onclick="editStudent('${id}')" class="btn-secondary min-h-[44px] px-4"><i class="fas fa-pen mr-1"></i> Düzenle</button></header>
            <section class="app-panel p-4 sm:p-5"><div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p class="text-xs font-black uppercase tracking-[.12em] text-gray-400">Hızlı işlemler</p><p class="mt-1 text-sm text-gray-500">${escapeHtml(student.adSoyad)} seçili kalır.</p></div><div class="flex flex-wrap gap-2"><button onclick="openCockpitHomework('${id}')" class="btn-primary min-h-[44px] px-4"><i class="fas fa-plus mr-1"></i> Ödev Ekle</button><button onclick="openCockpitExam('${id}')" class="btn-secondary min-h-[44px] px-3"><i class="fas fa-file-circle-plus mr-1"></i> Deneme Ekle</button><button onclick="openCockpitLesson('${id}', false)" class="btn-secondary min-h-[44px] px-3"><i class="fas fa-book-open mr-1"></i> Ders Kaydı</button><button onclick="openCockpitLesson('${id}', true)" class="btn-secondary min-h-[44px] px-3"><i class="fas fa-note-sticky mr-1"></i> Not Ekle</button><button onclick="showStudyPlanSetup('${id}')" class="btn-secondary min-h-[44px] px-3"><i class="fas fa-compass mr-1"></i> Çalışma Planı</button></div></div></section>
            <section class="grid grid-cols-2 lg:grid-cols-4 gap-3"><!-- 4 temel metrik -->${metrics.map(([icon, label, value, detail]) => `<article class="app-panel p-4"><div class="flex items-center gap-2 text-gray-400"><i class="fas ${icon} text-xs"></i><p class="text-[11px] font-black uppercase tracking-[.1em]">${label}</p></div><p class="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">${value}</p><p class="mt-1 text-xs text-gray-500">${detail}</p></article>`).join('')}</section>
            <section class="app-panel p-5"><div class="flex items-center justify-between gap-3"><div><h3 class="text-lg font-black">Kritik içgörüler</h3><p class="mt-1 text-sm text-gray-500">Mevcut deneme ve ödev verilerinden hesaplanır.</p></div><i class="fas fa-lightbulb text-slate-400"></i></div><div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">${insights.map(([icon, label, value]) => `<article class="rounded-xl border border-gray-200 p-3.5 dark:border-gray-700"><div class="flex items-center gap-2 text-xs font-black uppercase tracking-[.08em] text-gray-400"><i class="fas ${icon}"></i>${label}</div><p class="mt-2 text-sm font-bold leading-5 text-gray-800 dark:text-gray-100">${escapeHtml(value)}</p></article>`).join('')}</div></section>
            <section class="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,.8fr)]"><article class="app-panel p-5"><div class="flex items-start justify-between gap-3"><div><h3 class="text-lg font-black">Son 5 Deneme Eğilimi</h3><p class="mt-1 text-sm text-gray-500">Yalnız genel ve karşılaştırılabilir denemeler</p></div><button onclick="openCockpitExam('${id}')" class="text-sm font-bold text-indigo-600 dark:text-indigo-300">Deneme ekle</button></div><div class="mt-4 h-56">${cockpit.recentExams.length >= 2 ? '<canvas id="cockpitTrendChart" aria-label="Son beş genel deneme net eğilimi"></canvas>' : '<div class="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500 dark:border-gray-700">Trend için en az 2 genel deneme sonucu gerekli.</div>'}</div>${cockpit.trendDelta !== null ? `<p class="mt-3 text-sm font-semibold ${cockpit.trendDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}"><i class="fas ${cockpit.trendDelta >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} mr-1"></i>Son ${cockpit.recentExams.length} denemede ${formatCockpitNet(Math.abs(cockpit.trendDelta))} net ${cockpit.trendDelta >= 0 ? 'artış' : 'düşüş'} var.</p>` : ''}</article><aside class="app-panel p-5"><h3 class="text-lg font-black">Öğrenci durum özeti</h3><ul class="mt-3">${statusHtml}</ul></aside></section>
            ${examsSectionHtml}
            <section class="grid gap-4 xl:grid-cols-2"><article class="app-panel p-5"><div class="flex items-center justify-between gap-3"><div><h3 class="text-lg font-black">Son etkinlikler</h3><p class="mt-1 text-sm text-gray-500">En güncel 6 hareket</p></div><button onclick="renderOdevTakibi('${id}')" class="text-sm font-bold text-indigo-600 dark:text-indigo-300">Ödevlere git</button></div><div class="mt-5">${timelineHtml}</div></article><aside class="app-panel p-5"><h3 class="text-lg font-black">Yaklaşanlar</h3><div class="mt-4 space-y-3"><div class="rounded-xl border border-gray-200 p-3 dark:border-gray-700"><p class="text-xs font-black uppercase tracking-[.08em] text-gray-400">Sonraki ders</p><p class="mt-1 font-bold">${escapeHtml(upcomingLesson)}</p><p class="mt-1 text-sm text-gray-500">${escapeHtml(cockpit.upcomingLesson?.dersAdi || 'Planlanmadı')}</p></div><div class="rounded-xl border border-gray-200 p-3 dark:border-gray-700"><p class="text-xs font-black uppercase tracking-[.08em] text-gray-400">Ödev teslimi</p><p class="mt-1 font-bold">${escapeHtml(cockpit.pendingHomework ? formatDate(cockpit.pendingHomework.bitisTarihi) : 'Planlanmadı')}</p><p class="mt-1 text-sm text-gray-500">${escapeHtml(cockpit.pendingHomework?.konu || 'Aktif ödev yok')}</p></div><div class="rounded-xl border border-gray-200 p-3 dark:border-gray-700"><p class="text-xs font-black uppercase tracking-[.08em] text-gray-400">Sonraki deneme</p><p class="mt-1 font-bold">Planlanmadı</p><p class="mt-1 text-sm text-gray-500">Deneme atandığında burada görünür.</p></div></div></aside></section>
        </div>`;

    if (cockpit.recentExams.length >= 2 && window.Chart) {
        const canvas = document.getElementById('cockpitTrendChart');
        if (canvas) {
            window.cockpitTrendChartInstance?.destroy();
            window.cockpitTrendChartInstance = new window.Chart(canvas, { type: 'line', data: { labels: cockpit.recentExams.map(exam => exam.denemeAdi || formatDate(exam.tarih)), datasets: [{ data: cockpit.recentExams.map(exam => Number(exam.toplamNet)), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, .08)', borderWidth: 2, pointRadius: 3, pointHoverRadius: 4, tension: .32, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { displayColors: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 0 } }, y: { beginAtZero: false, grid: { color: 'rgba(148,163,184,.16)' }, ticks: { color: '#94a3b8' } } } } });
        }
    }
}

export function getSortedStudents(students, order) {
    if (order === 'default') return [...students];
    const withAvg = students.map(s => ({ ...s, ortalamaNet: getOrtalamaNet(s) }));
    if (order === 'net-desc') return withAvg.sort((a, b) => b.ortalamaNet - a.ortalamaNet);
    if (order === 'net-asc') return withAvg.sort((a, b) => a.ortalamaNet - b.ortalamaNet);
    return students;
}

export function setSortOrder(order) {
    store.currentSortOrder = order;
    if (store.currentPage === "reminderHome") {
        renderReminderHome();
    } else {
        renderHomeScreen();
    }
}

export function setFilter(sinif) {
    store.activeFilter = sinif;
    if (store.currentPage === "reminderHome") {
        renderReminderHome();
    } else {
        renderHomeScreen();
    }
}

export async function deleteStudent(id) {
    if (confirm("Öğrenciyi tamamen silmek istediğinize emin misiniz?")) {
        if (store.useFirestore && window.isFirebaseActive && window.db) {
            const user = window.auth?.currentUser;
            if (!user) {
                alert("Silme işlemi için yeniden giriş yapmanız gerekiyor.");
                return;
            }

            try {
                if (window.showSyncStatus) window.showSyncStatus("Öğrenci ve bağlı kayıtlar siliniyor...", false);
                const batch = window.db.batch();
                batch.delete(window.db.collection("students").doc(id));

                // Dependent documents are optional. Query only documents owned
                // by the current teacher so a missing schedule or lesson record
                // cannot cause Firestore to reject and roll back the whole batch.
                const dependentSnapshots = await Promise.all(
                    ["schedules", "lessons", "homeworks"].map(collectionName =>
                        window.db.collection(collectionName)
                            .where("userId", "==", user.uid)
                            .where("studentId", "==", id)
                            .get()
                    )
                );
                dependentSnapshots.forEach(snapshot => {
                    snapshot.forEach(doc => batch.delete(doc.ref));
                });

                const affectedGroups = (store.globalGroups || []).filter(group =>
                    Array.isArray(group.studentIds) && group.studentIds.includes(id)
                );
                affectedGroups.forEach(group => {
                    batch.update(window.db.collection("groups").doc(group.id), {
                        studentIds: group.studentIds.filter(studentId => studentId !== id)
                    });
                });

                await batch.commit();
                store.globalStudents = store.globalStudents.filter(student => student.id !== id);
                store.globalHomeworks = store.globalHomeworks.filter(homework => homework.studentId !== id);
                delete store.globalSchedules[id];
                delete store.globalLessons[id];
                store.globalGroups = store.globalGroups.map(group => ({
                    ...group,
                    studentIds: Array.isArray(group.studentIds)
                        ? group.studentIds.filter(studentId => studentId !== id)
                        : group.studentIds
                }));
                if (window.showSyncStatus) window.showSyncStatus("✅ Öğrenci ve bağlı kayıtlar silindi", false);
                renderHomeScreen();
            } catch (err) {
                console.error("deleteStudent error", err);
                if (window.handleFirebaseError) window.handleFirebaseError(err);
                if (window.showSyncStatus) window.showSyncStatus("⚠️ Öğrenci silinemedi; hiçbir kayıt değiştirilmedi", true);
                alert("Öğrenci silinemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.");
            }
            return;
        }

        const students = loadStudentsData().filter(s => s.id !== id);
        await saveStudentsData(students);
        renderHomeScreen();
    }
}

export function editStudent(id) {
    const s = loadStudentsData().find(s => s.id === id);
    if (!s) return;
    const sinifOptions = ['5', '6', '7', '8'].map(sinif => `<option value="${sinif}" ${s.sinif === sinif ? 'selected' : ''}>${sinif}. Sınıf</option>`).join('');
    const isPopular = POPULER_LISELER.some(l => l.ad === s.hedefLise);
    const selectedSchoolVal = isPopular ? s.hedefLise : (s.hedefLise ? "Diger" : "");
    const customSchoolStyle = isPopular || !s.hedefLise ? "display:none" : "display:block";
    
    const schoolDropdownOptions = POPULER_LISELER.map(l => `<option value="${l.ad}" data-net="${l.net}" ${s.hedefLise === l.ad ? 'selected' : ''}>${l.ad} (Taban: ${l.tabanPuan}, Net: ${l.net})</option>`).join('');
    
    const modal = document.createElement('div');
    modal.id = "editStudentModal";
    modal.className = "app-modal-backdrop";
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    modal.innerHTML = `
        <div class="app-modal max-w-md" onclick="event.stopPropagation()">
            <div class="app-modal-header"><div><h2 class="app-page-title text-xl">Öğrenci Bilgilerini Düzenle</h2><p class="app-page-subtitle">İletişim, hedef ve ders ücreti bilgilerini güncelleyin.</p></div><button onclick="this.closest('.app-modal-backdrop').remove()" class="app-modal-close" aria-label="Pencereyi kapat"><i class="fas fa-times"></i></button></div>
            <div class="app-modal-body space-y-3">
                <div>
                    <label class="block text-xs font-semibold mb-1">Ad Soyad</label>
                    <input id="editName" class="student-form-input min-h-[44px]" value="${escapeHtml(s.adSoyad)}" placeholder="Ad Soyad" required>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Okul</label>
                    <input id="editSchool" class="student-form-input min-h-[44px]" value="${escapeHtml(s.okul)}" placeholder="Okul" required>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Sınıf</label>
                    <select id="editSinif" class="student-form-input min-h-[44px]" required>
                        <option value="" disabled>Sınıf Seçin (zorunlu)</option>
                        ${sinifOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Hedef Lise</label>
                    <select id="editTargetSchool" class="student-form-input min-h-[44px]" onchange="onTargetSchoolChanged(this, 'editTargetNet', 'editCustomSchoolArea')" required>
                        <option value="" disabled ${!selectedSchoolVal ? 'selected' : ''}>Hedef Lise Seçin</option>
                        ${schoolDropdownOptions}
                        <option value="Diger" ${selectedSchoolVal === 'Diger' ? 'selected' : ''}>Diğer (Kendim Gireceğim)</option>
                    </select>
                </div>
                <div id="editCustomSchoolArea" style="${customSchoolStyle}">
                    <input type="text" id="editCustomSchool" placeholder="Hedef Lise Adı" class="student-form-input mt-1 min-h-[44px]" value="${!isPopular ? escapeHtml(s.hedefLise) : ''}">
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Hedef Net</label>
                    <input type="number" min="0.01" max="90" step="0.01" id="editTargetNet" class="student-form-input min-h-[44px]" value="${s.hedefNet}" placeholder="Hedef Net" ${isPopular ? 'readonly' : ''} required>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Bir Ders Ücreti (TL)</label>
                    <input type="number" min="0" step="0.01" id="editUcret" class="student-form-input min-h-[44px]" placeholder="Bir Ders Ücreti (TL)" value="${escapeHtml(s.dersUcreti || s.aylikUcret || s.ucret || '')}">
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Veli Telefonu</label>
                    <input type="tel" inputmode="tel" autocomplete="tel" id="editVeliTel" class="student-form-input min-h-[44px]" placeholder="05xx xxx xx xx" value="${escapeHtml(s.veliTel || '')}">
                </div>
                <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2"><button onclick="this.closest('.app-modal-backdrop').remove()" class="btn-secondary flex-1 py-2.5 min-h-[44px]">İptal</button><button onclick="saveStudentEdit('${id}')" class="btn-primary flex-1 py-2.5 min-h-[44px]"><i class="fas fa-save mr-1"></i> Değişiklikleri Kaydet</button></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export async function saveStudentEdit(id) {
    const name = document.getElementById('editName')?.value.trim();
    const school = document.getElementById('editSchool')?.value.trim();
    const sinif = document.getElementById('editSinif')?.value;
    let target = document.getElementById('editTargetSchool')?.value;
    if (target === "Diger") {
        target = document.getElementById('editCustomSchool')?.value.trim();
    }
    const net = document.getElementById('editTargetNet')?.value.trim();
    const ucret = document.getElementById('editUcret')?.value.trim();
    const veliTel = document.getElementById('editVeliTel')?.value.trim();
    const validation = validateStudentInput({ name, school, grade: sinif, target, net, fee: ucret, phone: veliTel });
    if (!validation.valid) return alert(validation.errors.join('\n'));

    const patch = {
        adSoyad: validation.values.name,
        okul: validation.values.school,
        sinif: validation.values.grade,
        hedefLise: validation.values.target,
        hedefNet: validation.values.net,
        dersUcreti: validation.values.fee,
        veliTel: validation.values.phone
    };

    const updatePromise = updateStudentProfile(id, patch);
    document.getElementById('editStudentModal')?.remove();
    renderHomeScreen();
    await updatePromise;
}

export function showAddStudentModal() {
    const sinifOptions = ['5', '6', '7', '8'].map(sinif => `<option value="${sinif}">${sinif}. Sınıf</option>`).join('');
    const schoolDropdownOptions = POPULER_LISELER.map(l => `<option value="${l.ad}" data-net="${l.net}">${l.ad} (Taban: ${l.tabanPuan}, Net: ${l.net})</option>`).join('');
    
    const modalHtml = `
        <div id="addStudentModal" class="app-modal-backdrop" onclick="if(event.target===this) closeAddStudentModal()">
            <div class="app-modal max-w-md" onclick="event.stopPropagation()">
                <div class="app-modal-header"><div><h2 class="app-page-title text-xl">Yeni Öğrenci</h2><p class="app-page-subtitle">Takip edilecek öğrenci ve hedef bilgilerini ekleyin.</p></div><button onclick="closeAddStudentModal()" class="app-modal-close" aria-label="Pencereyi kapat"><i class="fas fa-times"></i></button></div>
                <div class="app-modal-body space-y-3">
                    <div>
                        <label class="block text-xs font-semibold mb-1">Ad Soyad</label>
                        <input type="text" id="newName" placeholder="Ad Soyad" class="student-form-input min-h-[44px]" required>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Okul</label>
                        <input type="text" id="newSchool" placeholder="Okul" class="student-form-input min-h-[44px]" required>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Sınıf</label>
                        <select id="newSinif" class="student-form-input min-h-[44px]" required>
                            <option value="" disabled selected>Sınıf Seçin (zorunlu)</option>
                            ${sinifOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Hedef Lise</label>
                        <select id="newTargetSchool" class="student-form-input min-h-[44px]" onchange="onTargetSchoolChanged(this, 'newTargetNet', 'newCustomSchoolArea')" required>
                            <option value="" disabled selected>Hedef Lise Seçin (zorunlu)</option>
                            ${schoolDropdownOptions}
                            <option value="Diger">Diğer (Kendim Gireceğim)</option>
                        </select>
                    </div>
                    <div id="newCustomSchoolArea" style="display:none">
                        <input type="text" id="newCustomSchool" placeholder="Hedef Lise Adı" class="student-form-input mt-1 min-h-[44px]">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Hedef Net</label>
                        <input type="number" min="0.01" max="90" step="0.01" id="newTargetNet" placeholder="Hedef Net" class="student-form-input min-h-[44px]" required>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Bir Ders Ücreti (TL)</label>
                        <input type="number" min="0" step="0.01" id="newUcret" placeholder="Bir Ders Ücreti (TL)" class="student-form-input min-h-[44px]">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Veli Telefonu</label>
                        <input type="tel" inputmode="tel" autocomplete="tel" id="newVeliTel" placeholder="05xx xxx xx xx" class="student-form-input min-h-[44px]">
                    </div>
                    <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2"><button onclick="closeAddStudentModal()" class="btn-secondary flex-1 py-2.5 min-h-[44px]">İptal</button><button onclick="addStudentFromModal()" class="btn-primary flex-1 py-2.5 min-h-[44px]"><i class="fas fa-user-plus mr-1"></i> Öğrenciyi Kaydet</button></div>
                </div>
            </div>
        </div>
    `;
    const existing = document.getElementById('addStudentModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'addStudentModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

export function closeAddStudentModal() {
    document.getElementById('addStudentModal')?.remove();
}

export async function addStudentFromModal() {
    const name = document.getElementById('newName')?.value.trim();
    const school = document.getElementById('newSchool')?.value.trim();
    const sinif = document.getElementById('newSinif')?.value;
    let target = document.getElementById('newTargetSchool')?.value;
    if (target === "Diger") {
        target = document.getElementById('newCustomSchool')?.value.trim();
    }
    const net = document.getElementById('newTargetNet')?.value.trim();
    const ucret = document.getElementById('newUcret')?.value.trim();
    const veliTel = document.getElementById('newVeliTel')?.value.trim();
    const validation = validateStudentInput({ name, school, grade: sinif, target, net, fee: ucret, phone: veliTel });
    if (!validation.valid) return alert(validation.errors.join('\n'));

    const newStudent = {
        id: "std" + Date.now(),
        adSoyad: validation.values.name,
        sinif: validation.values.grade,
        okul: validation.values.school,
        hedefLise: validation.values.target,
        hedefNet: validation.values.net,
        dersUcreti: validation.values.fee,
        veliTel: validation.values.phone,
        denemeler: [],
        studyPlan: {},
        errorResets: {},
        growthPlan: {}
    };

    const createPromise = createStudentDocument(newStudent);
    closeAddStudentModal();
    renderHomeScreen();
    await createPromise;
}

export function toggleReportMenu() {
    const menu = document.getElementById('reportMenu');
    if (menu) menu.classList.toggle('hidden');
}

export function hideReportMenu() {
    const menu = document.getElementById('reportMenu');
    if (menu) menu.classList.add('hidden');
}

export function switchStudentTab(tabName) {
    const genelBtn = document.getElementById('tabStudentGenelBtn');
    const bransBtn = document.getElementById('tabStudentBransBtn');
    const calismaBtn = document.getElementById('tabStudentCalismaBtn');
    const genelContent = document.getElementById('studentGenelTabContent');
    const bransContent = document.getElementById('studentBransTabContent');
    const calismaContent = document.getElementById('studentCalismaTabContent');
    
    const setActiveButton = (button, active) => button?.classList.toggle('is-active', active);
    
    if (tabName === 'genel') {
        setActiveButton(genelBtn, true);
        setActiveButton(bransBtn, false);
        setActiveButton(calismaBtn, false);
        if (genelContent) genelContent.classList.remove('hidden');
        if (bransContent) bransContent.classList.add('hidden');
        if (calismaContent) calismaContent.classList.add('hidden');
    } else if (tabName === 'brans') {
        setActiveButton(genelBtn, false);
        setActiveButton(bransBtn, true);
        setActiveButton(calismaBtn, false);
        if (genelContent) genelContent.classList.add('hidden');
        if (bransContent) bransContent.classList.remove('hidden');
        if (calismaContent) calismaContent.classList.add('hidden');
    } else if (tabName === 'calisma') {
        setActiveButton(genelBtn, false);
        setActiveButton(bransBtn, false);
        setActiveButton(calismaBtn, true);
        if (genelContent) genelContent.classList.add('hidden');
        if (bransContent) bransContent.classList.add('hidden');
        if (calismaContent) calismaContent.classList.remove('hidden');
    }
}

// Backup & Recovery
export function exportBackup() {
    try {
        const readJson = (key, fallback) => {
            try {
                const value = JSON.parse(localStorage.getItem(localDataKey(key)));
                return value ?? fallback;
            } catch {
                return fallback;
            }
        };
        const isCloud = store.useFirestore && isFirebaseActive && !store.isGuestMode;
        const data = buildFullBackup({
            accountEmail: isCloud ? (auth.currentUser?.email || '') : '',
            mode: store.isGuestMode ? 'guest' : (isCloud ? 'cloud' : 'offline'),
            teacherProfile: {
                name: localStorage.getItem(localDataKey('teacher_name_v1')) || store.teacherName || '',
                school: localStorage.getItem(localDataKey('teacher_school_v1')) || store.teacherSchool || '',
                branches: readJson('teacher_branches_v1', store.teacherBranches || [])
            },
            students: loadStudentsData(),
            homeworks: isCloud ? (store.globalHomeworks || []) : loadStudentsData().flatMap(student => student.odevler || []),
            schedules: isCloud ? (store.globalSchedules || {}) : readJson('student_schedule', {}),
            lessons: isCloud ? (store.globalLessons || {}) : readJson('student_ders_kayitlari_v2', {}),
            groups: isCloud ? (store.globalGroups || []) : readJson('student_groups_v1', []),
            resourceBooks: loadResourceBooks(),
            reminderSettings: readJson('lesson_reminder_settings_v1', {}),
            reminderHistory: readJson('lesson_reminder_history_v1', {})
        });
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupFileName();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSyncStatus("✅ Tam veri yedeği indirildi", false);
    } catch (err) {
        console.error("Yedek hatası:", err);
        alert("Yedek alınamadı: " + err.message);
    }
}

export function showImportModal() {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    modal.innerHTML = `
        <div class="app-modal bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-xl border max-h-[92vh] overflow-y-auto">
            <h2 class="text-xl font-black mb-2">Tam Yedeği Geri Yükle</h2>
            <p class="text-xs text-gray-500 mb-3">Canfenci tam yedek JSON dosyasını seçin. Dosya doğrulanmadan hiçbir veri değiştirilmez.</p>
            <input type="file" id="restoreFile" accept="application/json,.json" onchange="previewBackupFile()" class="student-form-input w-full my-2 min-h-[44px]">
            <div id="restorePreview" class="hidden mt-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10 p-3 text-sm"></div>
            <fieldset id="restoreOptions" class="hidden mt-4 space-y-3">
                <legend class="text-sm font-black mb-2">Geri yükleme yöntemi</legend>
                <label class="flex gap-2 p-3 rounded-xl border"><input type="radio" name="restoreMode" value="merge" checked class="mt-1"><span><strong>Mevcut verilerle birleştir</strong><small class="block text-gray-500">Mevcut kayıtlar korunur; aynı kimlikli kayıtlar yedekteki sürümle güncellenir.</small></span></label>
                <label class="flex gap-2 p-3 rounded-xl border border-red-200 dark:border-red-900"><input type="radio" name="restoreMode" value="replace" class="mt-1"><span><strong>Mevcut verilerin yerine koy</strong><small class="block text-gray-500">Yedekte bulunmayan mevcut kayıtlar silinir. Önce otomatik güvenlik yedeği indirilir.</small></span></label>
                <label for="restoreAccountEmail" class="block text-xs font-bold">Onaylamak için açık hesabın e-posta adresini yazın</label>
                <input id="restoreAccountEmail" type="email" autocomplete="off" class="student-form-input" placeholder="${escapeHtml(auth.currentUser?.email || 'Yerel kullanım için YEREL yazın')}">
                <label class="flex gap-2 text-xs"><input id="restoreSensitiveData" type="checkbox" class="mt-0.5"><span>Yedek dosyasının kişisel öğrenci verileri içerdiğini ve doğru hesaba yüklediğimi onaylıyorum.</span></label>
            </fieldset>
            <p id="restoreFeedback" class="hidden mt-3 text-sm font-semibold" role="status"></p>
            <button id="restoreSubmitButton" onclick="importBackup()" disabled class="btn-primary disabled:opacity-50 w-full py-2.5 min-h-[44px] mt-4">Geri Yüklemeyi Başlat</button>
            <button onclick="this.closest('.fixed').remove()" class="mt-2 w-full border rounded-xl py-2.5 min-h-[44px]">İptal</button>
        </div>
    `;
    document.body.appendChild(modal);
}

let pendingRestoreBackup = null;

export function previewBackupFile() {
    const file = document.getElementById('restoreFile').files[0];
    if (!file) return;
    const feedback = document.getElementById('restoreFeedback');
    if (file.size > 10 * 1024 * 1024) {
        feedback.textContent = 'Yedek dosyası 10 MB sınırını aşıyor.';
        feedback.className = 'mt-3 text-sm font-semibold text-red-600';
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            const validation = validateFullBackup(data);
            if (!validation.ok) throw new Error(validation.error);
            pendingRestoreBackup = data;
            const summary = summarizeBackupData(data.data);
            document.getElementById('restorePreview').innerHTML = `<strong>Yedek doğrulandı</strong><div class="mt-1 text-xs">${summary.students} öğrenci · ${summary.homeworks} ödev · ${summary.lessonRecords} ders kaydı · ${summary.schedules} program · ${summary.groups} grup · ${summary.resourceBooks} kaynak kitap</div><div class="mt-2 text-xs">Kaynak hesap: ${escapeHtml(data.source?.accountEmail || 'Belirtilmemiş')} · Tarih: ${escapeHtml(new Date(data.exportedAt).toLocaleString('tr-TR'))}</div>`;
            document.getElementById('restorePreview').classList.remove('hidden');
            document.getElementById('restoreOptions').classList.remove('hidden');
            document.getElementById('restoreSubmitButton').disabled = false;
            feedback.className = 'hidden';
        } catch (err) {
            pendingRestoreBackup = null;
            feedback.textContent = 'Dosya doğrulanamadı: ' + err.message;
            feedback.className = 'mt-3 text-sm font-semibold text-red-600';
        }
    };
    reader.readAsText(file);
}

export async function importBackup() {
    const feedback = document.getElementById('restoreFeedback');
    const button = document.getElementById('restoreSubmitButton');
    if (!pendingRestoreBackup || !feedback || !button) return;
    const expected = auth.currentUser?.email || 'YEREL';
    const entered = document.getElementById('restoreAccountEmail')?.value.trim() || '';
    const confirmed = document.getElementById('restoreSensitiveData')?.checked;
    if (entered.toLocaleLowerCase('tr-TR') !== expected.toLocaleLowerCase('tr-TR') || !confirmed) {
        feedback.textContent = 'Açık hesabın e-posta adresini doğru yazın ve kişisel veri onay kutusunu işaretleyin.';
        feedback.className = 'mt-3 text-sm font-semibold text-red-600';
        return;
    }
    const mode = document.querySelector('input[name="restoreMode"]:checked')?.value || 'merge';
    button.disabled = true;
    feedback.textContent = 'Yedek güvenli biçimde geri yükleniyor. Bu pencereyi kapatmayın…';
    feedback.className = 'mt-3 text-sm font-semibold text-indigo-600';
    try {
        if (mode === 'replace') exportBackup();
        await window.restoreFullBackup(pendingRestoreBackup, mode);
        feedback.textContent = 'Geri yükleme tamamlandı. Veriler yenileniyor…';
        feedback.className = 'mt-3 text-sm font-semibold text-green-600';
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        console.error('Backup restore failed:', err);
        feedback.textContent = 'Geri yükleme tamamlanamadı: ' + err.message;
        feedback.className = 'mt-3 text-sm font-semibold text-red-600';
        button.disabled = false;
    }
}

export async function renderStudentPanel(id, origin = store.studentPanelOrigin || 'guidance') {
    // UX-04: Eski rehberlik dosyası yerine tek Öğrenci Kokpiti açılır.
    // Aşağıdaki eski detay üretimi geriye dönük kod bağımlılıkları için korunur,
    // ancak artık çalıştırılmaz; yeni görünüm ayrı insight modülünü kullanır.
    return renderStudentCockpit(id, origin);
    /* istanbul ignore next */
    try {
        store.currentPage = "student";
        if (window.currentPage) window.currentPage = "student";
        store.studentPanelOrigin = origin;
        updateMobileNavActive(origin === 'guidance' ? 'mobile-nav-guidance' : 'mobile-nav-home');
        const students = loadStudentsData();
        const student = students.find(s => s.id === id);
        if (!student) {
            renderHomeScreen();
            return;
        }
        store.currentStudentId = id;
        
        const denemeler = student.denemeler || [];
        const bransDenemeler = denemeler.filter(d => d.tip === "branş");
        const genelDenemeler = denemeler.filter(d => d.tip === "genel");
        const studentHomeworks = getStudentOdevler(student);
        const topicExamProgress = calculateTopicExamProgress(student, studentHomeworks);
        const konuList = getKonuListesiBySinif(student.sinif);
        const hataKonulari = {};
        konuList.forEach(k => hataKonulari[k] = 0);
        let toplamHataSoru = 0;
        
        for (let den of bransDenemeler) {
            for (let soru of den.sorular) {
                if (soru.durum !== "dogru" && soru.konuAdi && konuList.includes(soru.konuAdi)) {
                    hataKonulari[soru.konuAdi]++;
                    toplamHataSoru++;
                }
            }
        }
        const enCokHataYapilan = Object.entries(hataKonulari)
            .filter(([_, a]) => a > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
            
        const { hataSayilari, toplamHata } = getHataIstatistikleri(student);
        const genelOrtalamaNet = genelDenemeler.length 
            ? (genelDenemeler.reduce((sum, d) => sum + d.toplamNet, 0) / genelDenemeler.length).toFixed(2) 
            : 0;
        const lgsPuan = lgsPuanHesapla(genelDenemeler);
        
        const matchedSchool = POPULER_LISELER.find(l => l.ad === student.hedefLise);
        const targetPuan = matchedSchool ? matchedSchool.tabanPuan : Math.round(100 + (parseFloat(student.hedefNet) * 4.44) || 0);
        const matchPercent = targetPuan > 0 && lgsPuan !== null ? Math.min(100, Math.round((lgsPuan / targetPuan) * 100)) : 0;
        
        let targetMatchBadgeClass = "bg-gray-100 text-gray-805 dark:bg-gray-700/50 dark:text-gray-300 border-gray-200";
        let targetMatchBadgeText = "LGS hedef analizi için en az bir Genel Deneme girilmelidir.";
        if (lgsPuan !== null && targetPuan > 0) {
            if (lgsPuan >= targetPuan) {
                targetMatchBadgeClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200";
                targetMatchBadgeText = "🎉 Tebrikler, mevcut tahmin puanınız hedef puanın üzerinde!";
            } else if (targetPuan - lgsPuan <= 15) {
                targetMatchBadgeClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-450 border-yellow-200 animate-pulse";
                targetMatchBadgeText = `🚀 Hedefe çok yakınsın! Küçük bir gayret daha... (Hedef için son ${targetPuan - lgsPuan} puan)`;
            } else {
                targetMatchBadgeClass = "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200";
                targetMatchBadgeText = `📈 Çalışmaya devam! Hedefe ulaşmak için +${targetPuan - lgsPuan} puan daha gerekiyor.`;
            }
        }
        
        const dersBazliNetler = {};
        GENEL_DERSLER_KEY.forEach(d => dersBazliNetler[d] = { dogru: 0, yanlis: 0, bos: 0, toplamSoru: 0 });
        for (let den of genelDenemeler) {
            if (den.dersSonuclari) {
                for (let d in den.dersSonuclari) {
                    if (dersBazliNetler[d]) {
                        const s = den.dersSonuclari[d];
                        dersBazliNetler[d].dogru += s.dogru;
                        dersBazliNetler[d].yanlis += s.yanlis;
                        dersBazliNetler[d].bos += s.bos;
                        dersBazliNetler[d].toplamSoru += s.dogru + s.yanlis + s.bos;
                    }
                }
            }
        }
        
        const dersBazliYuzdeler = {};
        for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
            const d = GENEL_DERSLER_KEY[i];
            const t = dersBazliNetler[d].toplamSoru;
            dersBazliYuzdeler[d] = t ? ((dersBazliNetler[d].dogru / t) * 100).toFixed(1) : null;
        }
        
        const genelSorted = [...genelDenemeler].sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
        const netChartData = genelSorted.map(e => e.toplamNet);
        const netChartLabels = genelSorted.map(e => e.denemeAdi);
        const motivasyon = getMotivationMessage(student);
        const hedefSayi = parseFloat(student.hedefNet);
        const hedefGecerli = !isNaN(hedefSayi);
        
        const dersUcretiDegeri = student.dersUcreti || student.aylikUcret || student.ucret || '';
        const veliTelDegeri = student.veliTel || '';
        const ekstraBilgiHtml = (dersUcretiDegeri || veliTelDegeri)
            ? `<div class="flex flex-wrap gap-3 mt-2 text-sm">${dersUcretiDegeri ? `<span class="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full"><i class="fas fa-money-bill-wave"></i> Bir Ders Ücreti: ${escapeHtml(dersUcretiDegeri)} TL</span>` : ''}${veliTelDegeri ? `<span class="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full"><i class="fas fa-phone-alt"></i> Veli: ${escapeHtml(veliTelDegeri)}</span>` : ''}</div>`
            : '';

        const lessonRecords = loadDersKayitlari(id);
        const studentSchedule = loadSchedule(id);
        const studentSummary = calculateStudentSummary(student, studentHomeworks, lessonRecords, studentSchedule);
        const smartAnalysis = calculateSmartExamAnalysis(student, studentHomeworks);
        const timelineEvents = buildStudentTimeline(student, studentHomeworks, lessonRecords);
        const timelineToneClasses = {
            blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
            green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
            amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
            purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
            indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
        };
        const timelineHtml = timelineEvents.length
            ? timelineEvents.map((event, eventIndex) => `
                <div class="relative pl-11 pb-5 last:pb-0">
                    ${eventIndex < timelineEvents.length - 1 ? '<div class="absolute left-[15px] top-9 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></div>' : ''}
                    <div class="absolute left-0 top-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm ${timelineToneClasses[event.tone] || timelineToneClasses.indigo}">${event.icon}</div>
                    <div class="bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 rounded-xl p-3">
                        <div class="flex justify-between items-start gap-3 flex-wrap">
                            <h4 class="font-bold text-sm text-gray-800 dark:text-gray-100">${escapeHtml(event.title)}</h4>
                            <span class="text-xs font-semibold text-gray-400">${escapeHtml(formatTimelineDate(event.date))}</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">${escapeHtml(event.detail)}</p>
                    </div>
                </div>`).join('')
            : `<div class="text-center py-8 text-gray-400">
                    <div class="text-3xl mb-2">🕒</div>
                    <p class="font-semibold">Zaman çizelgesinde henüz hareket yok.</p>
                    <p class="text-xs mt-1">Deneme, ödev, ders veya soru kaydı eklendiğinde burada görünecek.</p>
               </div>`;
        const netChangeHtml = studentSummary.netChange === null
            ? '<span class="text-xs text-gray-400">Karşılaştırma için 2 deneme gerekli</span>'
            : `<span class="text-xs font-bold ${studentSummary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}">${studentSummary.netChange >= 0 ? '▲' : '▼'} ${Math.abs(studentSummary.netChange).toFixed(2)} net</span>`;
        const upcomingLessonHtml = studentSummary.upcomingLesson
            ? (() => {
                const upcoming = studentSummary.upcomingLesson;
                const dateLabel = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' }).format(upcoming.date);
                const timeLabel = String(upcoming.saat || '').padStart(5, '0');
                return `
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p class="text-xs uppercase tracking-wide font-black text-teal-600 dark:text-teal-400">Yaklaşan ders</p>
                            <h4 class="font-bold text-gray-800 dark:text-white mt-1">${escapeHtml(upcoming.dersAdi || 'Ders')}</h4>
                            <p class="text-sm text-gray-500 mt-0.5">${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</p>
                        </div>
                        <span class="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 px-3 py-1.5 rounded-full text-xs font-bold">⏰ Bildirim entegrasyonuna hazır</span>
                    </div>`;
            })()
            : '<p class="text-sm text-gray-400 font-semibold">Yaklaşan ders bulunmuyor. Ders Programı bölümünden haftalık ders ekleyebilirsiniz.</p>';
        const subjectDisplayNames = Object.fromEntries(GENEL_DERSLER_KEY.map((key, index) => [key, GENEL_DERSLER_GORUNUM[index] || key]));
        const subjectPerformanceHtml = smartAnalysis.subjectPerformance.length
            ? smartAnalysis.subjectPerformance.map(subject => {
                const trendText = subject.trend === null
                    ? '—'
                    : `${subject.trend >= 0 ? '▲' : '▼'} ${Math.abs(subject.trend).toFixed(2)}`;
                const trendClass = subject.trend === null
                    ? 'text-gray-400'
                    : (subject.trend >= 0 ? 'text-green-600' : 'text-red-600');
                return `
                    <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div class="min-w-0">
                            <p class="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">${escapeHtml(subjectDisplayNames[subject.subject] || subject.subject)}</p>
                            <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div class="h-full rounded-full ${subject.successRate >= 70 ? 'bg-green-500' : subject.successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${Math.min(100, Math.max(0, subject.successRate || 0))}%"></div>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-black text-sm text-indigo-600 dark:text-indigo-400">%${subject.successRate ?? 0}</p>
                            <p class="text-[11px] text-gray-400">Ort. ${subject.averageNet ?? 0} net</p>
                        </div>
                        <span class="text-xs font-black ${trendClass}" title="Son denemeye göre net değişimi">${trendText}</span>
                    </div>`;
            }).join('')
            : '<p class="text-sm text-gray-400 text-center py-6">Ders bazlı analiz için genel deneme sonucu ekleyin.</p>';
        const priorityTopicsHtml = smartAnalysis.priorityTopics.length
            ? smartAnalysis.priorityTopics.map((topic, index) => `
                <div class="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="w-7 h-7 shrink-0 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-black">${index + 1}</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">${escapeHtml(topic.topic)}</p>
                            <p class="text-xs text-gray-500">${topic.attempts} soruda ${topic.errors} hata</p>
                        </div>
                    </div>
                    <span class="text-xs font-black text-red-600 dark:text-red-400">%${topic.errorRate}</span>
                </div>`).join('')
            : '<p class="text-sm text-gray-400 text-center py-6">Konu önceliği için konu denemesi sonuçları gerekli.</p>';
        const recommendationsHtml = smartAnalysis.recommendations.length
            ? smartAnalysis.recommendations.map(recommendation => `
                <li class="flex gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <i class="fas fa-lightbulb text-amber-500 mt-0.5"></i>
                    <span>${escapeHtml(recommendation)}</span>
                </li>`).join('')
            : '<li class="text-sm text-gray-400">Yeni öneri oluşturmak için daha fazla deneme verisi gerekli.</li>';
        const warningsHtml = smartAnalysis.warnings.length
            ? `<div class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3">
                    <p class="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2"><i class="fas fa-exclamation-triangle"></i> Veri tutarlılığı uyarıları</p>
                    <ul class="space-y-1 list-disc pl-5 text-xs text-amber-800 dark:text-amber-300">${smartAnalysis.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
               </div>`
            : '<div class="text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-xl p-3"><i class="fas fa-check-circle"></i> Deneme kayıtlarında veri tutarsızlığı bulunmadı.</div>';
            
        const genelExamsHtml = genelDenemeler.length === 0 
            ? '<p class="text-center text-gray-500 py-3">Henüz genel deneme yok.</p>' 
            : genelDenemeler.slice().reverse().map(ex => `
                <div class="border rounded-xl p-3 flex justify-between flex-wrap mb-2 last:mb-0 bg-white dark:bg-gray-800">
                    <div>
                        <span class="font-bold text-gray-805 dark:text-white">${escapeHtml(ex.denemeAdi)}</span> 
                        <span class="text-xs text-gray-400">${ex.tarih}</span> 
                        <span class="text-xs exam-badge bg-blue-50 text-blue-600 dark:bg-gray-600 dark:text-white px-1.5 py-0.5 rounded">📘 Genel</span><br>
                        <span class="text-sm">Net: <strong class="text-blue-600">${ex.toplamNet}</strong> (${ex.toplamDogru}D ${ex.toplamYanlis}Y ${ex.toplamBos}B)</span>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="viewExam('${id}','${ex.id}')" class="text-blue-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-eye"></i></button>
                        <button onclick="editExam('${id}','${ex.id}')" class="text-green-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-edit"></i></button>
                        <button onclick="copyExamToOthers('${id}','${ex.id}')" class="text-purple-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-copy"></i></button>
                        <button onclick="deleteExam('${id}','${ex.id}')" class="text-red-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
            
        const linkedTopicExamHtml = topicExamProgress.records.filter(record => record.source === 'homework').slice().reverse().map(record => `
                <div class="border rounded-xl p-3 mb-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900">
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <span class="font-bold text-gray-800 dark:text-white">${escapeHtml(record.topic)}</span>
                            <span class="text-xs ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Ders bağlantılı</span>
                            <p class="text-xs text-gray-500 mt-1">${escapeHtml(record.subject || 'Ders belirtilmemiş')} · ${escapeHtml(record.name)} · ${escapeHtml(record.date)}</p>
                        </div>
                        <span class="text-sm font-black text-blue-600">${record.net.toFixed(2)} net</span>
                    </div>
                    <p class="text-sm mt-2"><span class="text-green-600 font-bold">${record.correct} doğru</span> · <span class="text-red-600 font-bold">${record.wrong} yanlış</span></p>
                </div>`).join('');
        const bransExamsHtml = bransDenemeler.length === 0 && !linkedTopicExamHtml
            ? '<p class="text-center text-gray-500 py-3">Henüz konu denemesi yok.</p>'
            : bransDenemeler.slice().reverse().map(ex => `
                <div class="border rounded-xl p-3 flex justify-between flex-wrap mb-2 last:mb-0 bg-white dark:bg-gray-800">
                    <div>
                        <span class="font-bold text-gray-805 dark:text-white">${escapeHtml(ex.denemeAdi)}</span> 
                        <span class="text-xs text-gray-400">${ex.tarih}</span> 
                        <span class="text-xs exam-badge bg-emerald-50 text-emerald-600 dark:bg-gray-600 dark:text-white px-1.5 py-0.5 rounded">🔬 Konu Denemesi</span><br>
                        <span class="text-sm">Net: <strong class="text-blue-600">${ex.toplamNet}</strong> (${ex.toplamDogru}D ${ex.toplamYanlis}Y ${ex.toplamBos}B)</span>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="viewExam('${id}','${ex.id}')" class="text-blue-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-eye"></i></button>
                        <button onclick="editExam('${id}','${ex.id}')" class="text-green-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-edit"></i></button>
                        <button onclick="copyExamToOthers('${id}','${ex.id}')" class="text-purple-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-copy"></i></button>
                        <button onclick="deleteExam('${id}','${ex.id}')" class="text-red-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('') + linkedTopicExamHtml;
            
        // 1. Tavsiye Edilen Ders Çalışma Programı
        const adviceList = [];
        for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
            const d = GENEL_DERSLER_KEY[i];
            const name = GENEL_DERSLER_GORUNUM[i];
            const pct = dersBazliYuzdeler[d];
            if (pct === null || pct === undefined) {
                adviceList.push(`
                    <div class="border-b dark:border-gray-700 pb-1.5 mb-1.5 last:border-b-0 text-sm">
                        <span class="font-bold text-gray-700 dark:text-gray-300">${name}:</span> <span class="text-gray-500">Veri yok. Haftalık 2-3 saat çalışma önerilir.</span>
                    </div>
                `);
            } else {
                const successVal = parseFloat(pct);
                let adviceText = '';
                if (successVal < 50) {
                    adviceText = `🔴 <strong class="text-red-650 dark:text-red-400">Kritik:</strong> Başarı oranı %${pct}. Konu anlatım videoları izlenmeli ve günlük 50+ soru ile eksikler kapatılmalı.`;
                } else if (successVal < 80) {
                    adviceText = `🟡 <strong class="text-amber-600 dark:text-amber-450">Orta:</strong> Başarı oranı %${pct}. Formül ve kural kartları hazırlanmalı, haftalık soru adedi arttırılmalı.`;
                } else {
                    adviceText = `🟢 <strong class="text-green-600 dark:text-green-400">Mükemmel:</strong> Başarı oranı %${pct}. Mevcut seviyeyi korumak adına konu denemelerine ve zor seviye sorulara odaklanılmalı.`;
                }
                adviceList.push(`
                    <div class="border-b dark:border-gray-700 pb-1.5 mb-1.5 last:border-b-0 text-sm">
                        <span class="font-bold text-gray-808 dark:text-gray-250">${name}:</span> <span class="text-gray-650 dark:text-gray-300">${adviceText}</span>
                    </div>
                `);
            }
        }
        const studyAdviceHtml = adviceList.join('');
        const studyPlanProfile = student.studyPlanProfile || null;
        const studyStageNames = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };
        const studyIntensityNames = { light: 'Hafif', balanced: 'Dengeli', intensive: 'Yoğun' };
        const studyPlanProfileHtml = studyPlanProfile ? `
            <div class="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><p class="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">Öğrencinin çalışma rozeti</p><p class="text-lg font-black mt-1">🏅 ${escapeHtml(studyPlanProfile.badge || 'Çalışma Kaşifi')}</p><p class="text-xs text-gray-500 mt-1">${escapeHtml(studyPlanProfile.subject || 'Genel çalışma')} · ${studyPlanProfile.durationWeeks || 1} haftalık program</p></div>
                <div class="flex flex-wrap gap-2"><span class="rounded-full bg-white dark:bg-gray-800 border px-3 py-1 text-xs font-black">${studyStageNames[studyPlanProfile.stage] || 'Başlangıç'}</span><span class="rounded-full bg-white dark:bg-gray-800 border px-3 py-1 text-xs font-black">${studyIntensityNames[studyPlanProfile.intensity] || 'Hafif'}</span><span class="rounded-full bg-white dark:bg-gray-800 border px-3 py-1 text-xs font-black">${studyPlanProfile.dailyMinutes || 30} dk/gün</span></div>
            </div>` : '';
        
        // 2. Haftalık Çalışma Takvimi
        const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
        const weeklyPlannerHtml = gunler.map(gun => {
            const tasks = student.studyPlan && student.studyPlan[gun] ? student.studyPlan[gun] : [];
            const tasksListHtml = tasks.map((task, idx) => `
                <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-700/60 p-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-600 mb-1 last:mb-0">
                    <span class="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[80%]" title="${escapeHtml(task)}">${escapeHtml(task)}</span>
                    <button onclick="deleteStudyTask('${id}', '${gun}', ${idx})" class="text-red-500 hover:text-red-750 transition p-1">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            `).join('') || '<p class="text-sm text-gray-405 text-center italic py-2">Çalışma planlanmamış.</p>';
            
            return `
                <div class="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-3 shadow-sm space-y-2">
                    <h5 class="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1 border-b dark:border-gray-750 pb-1">
                        <i class="far fa-calendar-check"></i> ${gun}
                    </h5>
                    <div class="space-y-1 max-h-24 overflow-y-auto">${tasksListHtml}</div>
                    <div class="flex gap-1 pt-1">
                        <input type="text" id="taskInput_${gun}" placeholder="Ders/ödev..." class="student-form-input text-sm flex-grow min-w-0" style="padding: 0.5rem 0.6rem; font-size: 14px; min-height: 44px;">
                        <button onclick="addStudyTask('${id}', '${gun}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center min-w-[44px] min-h-[44px]">
                            +
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 3. Hatalı Soru Sıfırlama Takibi
        const allMistakes = [];
        const denemelerList = student.denemeler || [];
        for (let den of denemelerList) {
            if (den.tip === "genel") continue;
            const sorular = den.sorular || [];
            for (let soru of sorular) {
                if (soru.durum === "yanlis" || soru.durum === "bos") {
                    const key = `${den.id}_${soru.soruNo}`;
                    const status = student.errorResets && student.errorResets[key] ? student.errorResets[key].status : 'pending';
                    allMistakes.push({
                        key,
                        examName: den.denemeAdi,
                        date: den.tarih,
                        topic: soru.konuAdi,
                        errorType: soru.hataKodu || 'Belirtilmemiş',
                        status,
                        solvedAt: student.errorResets && student.errorResets[key] ? student.errorResets[key].solvedAt : null
                    });
                }
            }
        }
        
        const totalErrorsCount = allMistakes.length;
        const solvedErrorsCount = allMistakes.filter(m => m.status === 'solved').length;
        const pendingErrorsCount = totalErrorsCount - solvedErrorsCount;
        const errorResetPercent = totalErrorsCount > 0 ? Math.round((solvedErrorsCount / totalErrorsCount) * 100) : 100;
        
        if (!window.currentErrorFilter) window.currentErrorFilter = 'all';
        const filteredMistakes = allMistakes.filter(m => {
            if (window.currentErrorFilter === 'pending') return m.status === 'pending';
            if (window.currentErrorFilter === 'solved') return m.status === 'solved';
            return true;
        });
        
        let errorsRowsHtml = '';
        if (filteredMistakes.length === 0) {
            errorsRowsHtml = `<tr><td colspan="5" class="text-center p-4 text-gray-500">Kayıtlı hatalı soru bulunmuyor.</td></tr>`;
        } else {
            errorsRowsHtml = filteredMistakes.map(m => {
                const statusBadge = m.status === 'solved'
                    ? `<span class="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-0.5 rounded-full font-bold text-xs">✅ Sıfırlandı</span>`
                    : `<span class="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 rounded-full font-bold text-xs">❌ Bekliyor</span>`;
                    
                const actionBtn = m.status === 'pending'
                    ? `<button onclick="resetStudentError('${id}', '${m.key}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 mx-auto shadow-sm min-h-[44px]">
                           <i class="fas fa-check"></i> Sıfırla
                       </button>`
                    : `<span class="text-gray-500 dark:text-gray-400 text-xs font-semibold">${m.solvedAt || '—'}</span>`;
                    
                return `
                    <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-750/10 transition text-base">
                        <td class="p-4 border font-medium">${escapeHtml(m.examName)}<br><span class="text-xs text-gray-400">${m.date}</span></td>
                        <td class="p-4 border font-semibold text-indigo-600 dark:text-indigo-400">${escapeHtml(m.topic)}</td>
                        <td class="p-4 border text-center text-gray-600 dark:text-gray-300">${escapeHtml(m.errorType)}</td>
                        <td class="p-4 border text-center">${statusBadge}</td>
                        <td class="p-4 border text-center">${actionBtn}</td>
                    </tr>
                `;
            }).join('');
        }
        
        // 4. Soru Sayısı Gelişim Takip Verileri
        const growthPlan = student.growthPlan || { weeklyTarget: 500, logs: [] };
        const weeklyTarget = growthPlan.weeklyTarget || 500;
        const growthLogs = growthPlan.logs || [];
        
        let weeksSolvedCount = 0;
        const todayObj = new Date();
        const dayOfWeek = todayObj.getDay();
        const difference = todayObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const mondayDate = new Date(todayObj.setDate(difference));
        mondayDate.setHours(0, 0, 0, 0);
        
        for (let log of growthLogs) {
            const logDate = new Date(log.date);
            if (logDate >= mondayDate) {
                weeksSolvedCount += parseInt(log.count) || 0;
            }
        }
        
        const weeklyGrowthPercent = weeklyTarget > 0 ? Math.min(100, Math.round((weeksSolvedCount / weeklyTarget) * 100)) : 0;
        const todayDateStr = new Date().toISOString().split('T')[0];
        
        const sortedLogsForList = [...growthLogs].sort((a, b) => b.date.localeCompare(a.date));
        let growthLogsListHtml = '';
        if (sortedLogsForList.length === 0) {
            growthLogsListHtml = '<p class="text-sm text-gray-400 italic text-center py-2">Soru girişi yapılmamış.</p>';
        } else {
            growthLogsListHtml = sortedLogsForList.slice(0, 5).map(log => {
                const origIdx = growthLogs.findIndex(l => l.date === log.date && l.count === log.count);
                return `
                    <div class="flex justify-between items-center bg-white dark:bg-gray-800 p-1.5 rounded border dark:border-gray-700 mb-1 last:mb-0 text-sm">
                        <span>📅 ${log.date}: <strong class="text-indigo-600 dark:text-indigo-400 font-semibold">${log.count} Soru</strong></span>
                        <button onclick="deleteGrowthLog('${id}', ${origIdx})" class="text-red-500 hover:text-red-750 transition p-1">
                            <i class="fas fa-trash-alt text-sm"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div class="app-page pb-28 sm:pb-8">
                <header class="app-page-header">
                <div><button onclick="${origin === 'guidance' ? 'renderGuidancePage()' : 'renderHomeScreen()'}" class="btn-secondary px-4 py-2.5 min-h-[44px] mb-3"><i class="fas fa-arrow-left mr-1"></i> ${origin === 'guidance' ? 'Rehberlik' : 'Öğrenci Listesi'}</button><h2 class="app-page-title">${escapeHtml(student.adSoyad)}</h2><p class="app-page-subtitle">Gelişim özeti, deneme analizi ve rehberlik planı</p></div>
                <div class="flex gap-2">
                    <button onclick="shareReportWhatsApp('${id}')" class="btn-secondary px-4 py-2.5 flex items-center gap-2 min-h-[44px]"><i class="fab fa-whatsapp text-lg"></i> Veli Raporu</button>
                    <div class="relative inline-block">
                        <button onclick="toggleReportMenu()" class="btn-primary px-4 py-2.5 min-h-[44px]"><i class="fas fa-file-alt mr-1"></i> Rapor Al</button>
                        <div id="reportMenu" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 hidden border border-gray-150 dark:border-gray-700">
                            <button onclick="exportReport('pdf'); hideReportMenu()" class="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold"><i class="fas fa-file-pdf mr-1"></i> PDF Kaydet</button>
                            <button onclick="exportReport('word'); hideReportMenu()" class="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold"><i class="fas fa-file-word mr-1"></i> Word Kaydet</button>
                        </div>
                    </div>
                </div>
            </header>
            
            <div class="app-panel p-5">
                <div class="flex justify-between flex-wrap items-start">
                    <div>
                        <p class="text-sm text-gray-500 mt-0.5">${escapeHtml(student.okul)} · ${escapeHtml(student.hedefLise)} · ${student.sinif ? student.sinif + '. Sınıf' : 'Sınıf belirtilmemiş'}</p>
                        ${ekstraBilgiHtml}
                    </div>
                    <div class="text-right">
                        <span class="status-pill bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Hedef: ${student.hedefNet} Net</span><br>
                        <span class="text-sm font-semibold text-gray-500 mt-1 block">Genel ortalama: ${genelOrtalamaNet}</span>
                    </div>
                </div>
                <div class="mt-4 p-3 rounded-xl text-center font-bold border motivation-card text-base bg-white dark:bg-gray-700 shadow-sm">${motivasyon}</div>
            </div>

            <!-- Öğrenci Gelişim Özeti -->
            <section class="space-y-4" aria-labelledby="studentProgressHeading">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h3 id="studentProgressHeading" class="section-heading text-xl font-black text-gray-800 dark:text-white"><i class="fas fa-chart-line text-indigo-500"></i> Öğrenci Gelişim Merkezi</h3>
                        <p class="text-sm text-gray-500 mt-1">Deneme, ödev ve ders hareketlerinin tek görünümü</p>
                    </div>
                    <span class="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-3 py-1.5 rounded-full font-bold">${timelineEvents.length} hareket</span>
                </div>

                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="app-panel p-4">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">Son genel net</p>
                        <p class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">${studentSummary.latestNet === null ? '—' : studentSummary.latestNet.toFixed(2)}</p>
                        <div class="mt-1">${netChangeHtml}</div>
                    </div>
                    <div class="app-panel p-4">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">Ödev tamamlama</p>
                        <p class="text-2xl font-black text-green-600 dark:text-green-400 mt-1">${studentSummary.homeworkCompletionRate === null ? '—' : `%${studentSummary.homeworkCompletionRate}`}</p>
                        <p class="text-xs text-gray-400 mt-1">${studentSummary.completedHomeworkCount} / ${studentSummary.homeworkCount} ödev</p>
                    </div>
                    <div class="app-panel p-4">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">Son ders</p>
                        <p class="text-base font-black text-indigo-600 dark:text-indigo-400 mt-2">${studentSummary.lastLesson ? escapeHtml(formatTimelineDate(studentSummary.lastLesson.tarih)) : '—'}</p>
                        <p class="text-xs text-gray-400 mt-1">${studentSummary.lastLesson ? escapeHtml(studentSummary.lastLesson.konu || studentSummary.lastLesson.ders || 'Konu belirtilmemiş') : 'Ders kaydı yok'}</p>
                    </div>
                    <div class="app-panel p-4">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">Toplam hareket</p>
                        <p class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">${timelineEvents.length}</p>
                        <p class="text-xs text-gray-400 mt-1">Tek zaman çizelgesinde</p>
                    </div>
                </div>

                <div class="bg-teal-50 dark:bg-teal-950/20 rounded-2xl border border-teal-100 dark:border-teal-900/40 shadow-sm p-4">
                    ${upcomingLessonHtml}
                </div>

                <details class="app-panel app-disclosure">
                    <summary class="app-panel-header flex items-center justify-between gap-3">
                        <div><h3 class="font-black text-base text-gray-800 dark:text-white"><i class="fas fa-stream text-indigo-500 mr-1"></i> Zaman Çizelgesi</h3><p class="text-xs text-gray-500 mt-1">${timelineEvents.length} hareket · En yeni kayıt üstte</p></div>
                        <i class="fas fa-chevron-down disclosure-chevron text-indigo-500"></i>
                    </summary>
                    <div class="max-h-[560px] overflow-y-auto p-5 pt-3">
                        ${timelineHtml}
                    </div>
                </details>
            </section>

            <!-- Akıllı Deneme Analizi -->
            <details class="app-panel app-disclosure" aria-labelledby="smartExamAnalysisHeading">
                <summary class="app-panel-header flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h3 id="smartExamAnalysisHeading" class="font-black text-base text-gray-800 dark:text-white"><i class="fas fa-brain text-indigo-500 mr-1"></i> Akıllı Deneme Analizi</h3>
                        <p class="text-xs text-gray-500 mt-1">${smartAnalysis.generalExamCount} genel deneme · Ders, konu ve sonraki adım önerileri</p>
                    </div>
                    <i class="fas fa-chevron-down disclosure-chevron text-indigo-500"></i>
                </summary>
                <div class="app-modal-body space-y-5">

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4">
                        <p class="text-xs font-bold text-indigo-500 uppercase tracking-wide">Son 3 ortalama</p>
                        <p class="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">${smartAnalysis.recentThreeAverage === null ? '—' : smartAnalysis.recentThreeAverage.toFixed(2)}</p>
                    </div>
                    <div class="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4">
                        <p class="text-xs font-bold text-blue-500 uppercase tracking-wide">Son 5 ortalama</p>
                        <p class="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">${smartAnalysis.recentFiveAverage === null ? '—' : smartAnalysis.recentFiveAverage.toFixed(2)}</p>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Son deneme değişimi</p>
                        <p class="text-2xl font-black mt-1 ${smartAnalysis.latestChange === null ? 'text-gray-400' : smartAnalysis.latestChange >= 0 ? 'text-green-600' : 'text-red-600'}">${smartAnalysis.latestChange === null ? '—' : `${smartAnalysis.latestChange >= 0 ? '+' : ''}${smartAnalysis.latestChange.toFixed(2)}`}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div class="bg-gray-50 dark:bg-gray-900/20 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                        <h4 class="font-black text-sm text-gray-800 dark:text-white mb-2"><i class="fas fa-chart-bar text-blue-500"></i> Ders Bazlı Son 5 Deneme</h4>
                        ${subjectPerformanceHtml}
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-900/20 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                        <h4 class="font-black text-sm text-gray-800 dark:text-white mb-3"><i class="fas fa-crosshairs text-red-500"></i> Öncelikli Konular</h4>
                        <div class="space-y-2">${priorityTopicsHtml}</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
                    <div class="bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4">
                        <h4 class="font-black text-sm text-gray-800 dark:text-white mb-3"><i class="fas fa-route text-amber-500"></i> Önerilen Sonraki Adımlar</h4>
                        <ul class="space-y-2">${recommendationsHtml}</ul>
                    </div>
                    ${warningsHtml}
                </div>
                </div>
            </details>
            
            <!-- LGS Hedef Uyum Analizi -->
            <details class="app-panel app-disclosure">
                <summary class="app-panel-header flex items-center justify-between gap-3">
                    <div><h3 class="font-black text-base text-gray-800 dark:text-white"><i class="fas fa-graduation-cap text-indigo-500 mr-1"></i> LGS Hedef Uyum Analizi</h3><p class="text-xs text-gray-500 mt-1">Hedef okul, puan ve net uyumunu görüntüleyin</p></div>
                    <i class="fas fa-chevron-down disclosure-chevron text-indigo-500"></i>
                </summary>
                <div class="app-modal-body space-y-3">
                    <div class="flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <span class="text-sm font-semibold text-gray-500 dark:text-gray-400">Hedef Okul:</span> 
                            <span class="font-bold text-gray-800 dark:text-white text-base">${escapeHtml(student.hedefLise)}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold">Hedef: ${targetPuan} Puan / ${student.hedefNet} Net</span>
                        </div>
                    </div>
                    ${lgsPuan === null ? `
                        <p class="text-xs text-gray-500 text-center py-3 bg-gray-50 dark:bg-gray-900/20 rounded-xl border border-dashed">${targetMatchBadgeText}</p>
                    ` : `
                        <div class="space-y-1.5">
                            <div class="flex justify-between text-xs font-bold text-gray-500">
                                <span>Mevcut Ortalama Puan: ${lgsPuan}</span>
                                <span>Uyum: %${matchPercent}</span>
                            </div>
                            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div class="bg-indigo-650 h-full rounded-full transition-all duration-500" style="width: ${matchPercent}%"></div>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-xl border text-xs font-semibold text-center ${targetMatchBadgeClass}">${targetMatchBadgeText}</div>
                    `}
                </div>
            </details>
            
            <!-- TAB SEGMENT -->
            <div class="app-segmented">
                <button onclick="switchStudentTab('genel')" id="tabStudentGenelBtn" class="is-active text-sm sm:text-base">
                    Genel Denemeler
                </button>
                <button onclick="switchStudentTab('brans')" id="tabStudentBransBtn" class="text-sm sm:text-base">
                    Konu Denemeleri
                </button>
                <button onclick="switchStudentTab('calisma')" id="tabStudentCalismaBtn" class="text-sm sm:text-base">
                    Rehberlik Planı
                </button>
            </div>
            
            <!-- GENEL TAB CONTENT -->
            <div id="studentGenelTabContent" class="space-y-4">
                <div class="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow border"><canvas id="netChart" height="150"></canvas></div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">📘 Genel Sınav İstatistikleri</h3>
                    ${genelDenemeler.length === 0 ? '<p class="text-gray-500 text-sm">Henüz genel deneme eklenmemiş.</p>' : `
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Toplam Deneme</span> <strong class="text-base">${genelDenemeler.length}</strong></div>
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Ortalama Net</span> <strong class="text-base text-blue-600">${genelOrtalamaNet}</strong></div>
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Tahmini LGS Puanı</span> <strong class="text-base text-indigo-605">${lgsPuan !== null ? lgsPuan : '—'}</strong></div>
                        </div>
                        <div class="mt-4">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Ders Bazlı Ortalama Başarı (%)</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                ${GENEL_DERSLER_KEY.map((d, i) => `
                                    <div class="flex justify-between text-base border-b dark:border-gray-700 pb-1">
                                        <span class="text-gray-600 dark:text-gray-400 font-semibold">${GENEL_DERSLER_GORUNUM[i]}</span>
                                        <span class="font-bold text-indigo-600 dark:text-indigo-400">${dersBazliYuzdeler[d] !== null ? dersBazliYuzdeler[d] + '%' : '—'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `}
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">📝 Genel Denemeler</h3>
                    <div class="space-y-2 md:max-h-80 md:overflow-y-auto mt-2">${genelExamsHtml}</div>
                </div>
            </div>
            
            <!-- BRANS TAB CONTENT (HIDDEN BY DEFAULT) -->
            <div id="studentBransTabContent" class="hidden space-y-4">
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">🔬 Konu Denemesi İstatistikleri</h3>
                    ${topicExamProgress.count === 0 ? '<p class="text-gray-500 text-sm">Henüz sonuçlandırılmış konu denemesi yok.</p>' : `
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-xs text-gray-500 dark:text-gray-400 block">Toplam Deneme</span> <strong class="text-base">${topicExamProgress.count}</strong></div>
                            <div class="border rounded-xl p-3 bg-green-50 dark:bg-green-950/20"><span class="font-bold text-xs text-gray-500 dark:text-gray-400 block">Ort. Doğru</span> <strong class="text-base text-green-600">${topicExamProgress.averageCorrect?.toFixed(2)}</strong></div>
                            <div class="border rounded-xl p-3 bg-red-50 dark:bg-red-950/20"><span class="font-bold text-xs text-gray-500 dark:text-gray-400 block">Ort. Yanlış</span> <strong class="text-base text-red-600">${topicExamProgress.averageWrong?.toFixed(2)}</strong></div>
                            <div class="border rounded-xl p-3 bg-blue-50 dark:bg-blue-950/20"><span class="font-bold text-xs text-gray-500 dark:text-gray-400 block">Ort. Net</span> <strong class="text-base text-blue-600">${topicExamProgress.averageNet?.toFixed(2)}</strong></div>
                        </div>
                        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            ${topicExamProgress.topics.map(topic => `<div class="border rounded-xl p-3 bg-white dark:bg-gray-900/20"><div class="flex justify-between gap-2"><span class="font-bold text-sm">${escapeHtml(topic.topic)}</span><span class="text-xs font-black text-blue-600">Ort. ${topic.averageNet.toFixed(2)} net</span></div><p class="text-xs text-gray-500 mt-1">${topic.count} deneme · ${topic.averageCorrect.toFixed(2)}D · ${topic.averageWrong.toFixed(2)}Y</p></div>`).join('')}
                        </div>
                        ${topicExamProgress.subtopics.length ? `<div class="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 p-3"><h4 class="font-bold text-sm mb-2">Alt Konu Hataları</h4><div class="flex flex-wrap gap-2">${topicExamProgress.subtopics.map(item => `<span class="rounded-full bg-white dark:bg-gray-800 border px-3 py-1 text-xs"><strong>${escapeHtml(item.subtopic)}</strong> · ${item.errors} yanlış <span class="text-gray-400">(${escapeHtml(item.topic)})</span></span>`).join('')}</div></div>` : ''}
                        <div class="mt-4 border-t pt-3">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">📉 En Çok Hata Yapılan Konular</h4>
                            <div class="space-y-1.5">
                                ${enCokHataYapilan.length === 0 ? '<p class="text-gray-500 text-sm">Henüz hata kaydı bulunmuyor.</p>' : enCokHataYapilan.map(([konu, adet]) => `
                                    <div class="flex justify-between border-b dark:border-gray-700 py-1.5 text-base">
                                        <span class="font-medium text-gray-700 dark:text-gray-300">${konu}</span>
                                        <span class="font-bold text-red-600">${adet} hata (${toplamHataSoru ? ((adet / toplamHataSoru) * 100).toFixed(1) : 0}%)</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${toplamHata > 0 ? `
                            <div class="mt-4 border-t pt-3">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">⚠️ Hata Kodu Dağılımı</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                                    <div class="max-h-[140px] flex justify-center">
                                        <canvas id="errorChart"></canvas>
                                    </div>
                                    <div class="space-y-1">
                                        ${HATA_KODLARI.map(h => {
                                            const adet = hataSayilari[h.kod] || 0;
                                            const yuzde = toplamHata ? ((adet / toplamHata) * 100).toFixed(1) : 0;
                                            return `
                                                <div class="flex justify-between text-xs border-b dark:border-gray-700 pb-1">
                                                    <span class="text-gray-650 dark:text-gray-400 font-semibold">
                                                        <span class="inline-block w-2.5 h-2.5 rounded-full mr-1" style="background-color:${getErrorColor(h.kod)}"></span>
                                                        ${h.kod} - ${h.aciklama}
                                                    </span>
                                                    <span class="font-bold text-gray-808 dark:text-white">${adet} adet (%${yuzde})</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    `}
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">📝 Konu Denemeleri</h3>
                    <div class="space-y-2 md:max-h-80 md:overflow-y-auto mt-2">${bransExamsHtml}</div>
                </div>
            </div>
            
            <!-- CALISMA TAB CONTENT (HIDDEN BY DEFAULT) -->
            <div id="studentCalismaTabContent" class="hidden space-y-6">
                <!-- SECTION 1: Ders Çalışma Programı -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                    <div class="flex justify-between items-center mb-4 flex-wrap gap-2 border-b dark:border-gray-750 pb-2">
                        <div>
                            <h3 class="section-heading text-indigo-650 dark:text-indigo-400 font-bold text-lg">
                                <i class="fas fa-calendar-alt"></i> Ders Çalışma Programı
                            </h3>
                            <p class="text-sm text-gray-500">Ayarlar'da seçtiğiniz derslere göre branş veya genel çalışma programı oluşturun.</p>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                            <button onclick="exportStudyPlanToPdf('${id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-1.5 shadow min-h-[44px]">
                                <i class="fas fa-file-pdf text-base"></i> Programı PDF Kaydet
                            </button>
                            <button onclick="showStudyPlanSetup('${id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-1.5 shadow min-h-[44px]">
                                <i class="fas fa-magic text-base"></i> Programı Otomatik Doldur
                            </button>
                        </div>
                    </div>
                    ${studyPlanProfileHtml}
                    
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <!-- Performans Önerileri -->
                        <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border dark:border-gray-700 lg:col-span-1">
                            <h4 class="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <i class="fas fa-lightbulb text-amber-500"></i> Performans Önerileri
                            </h4>
                            <div class="space-y-2.5">
                                ${studyAdviceHtml}
                            </div>
                        </div>
                        
                        <!-- Haftalık Takvim -->
                        <div class="lg:col-span-2 space-y-3">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <i class="fas fa-tasks text-indigo-550"></i> Haftalık Çalışma Takvimi
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:max-h-[350px] md:overflow-y-auto pr-1">
                                ${weeklyPlannerHtml}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- SECTION 2: Hatalı Soru Sıfırlama Takibi -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                    <div class="mb-4 border-b dark:border-gray-750 pb-2">
                        <h3 class="section-heading text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                            <i class="fas fa-check-double"></i> Hatalı Soru Sıfırlama Takibi
                        </h3>
                        <p class="text-sm text-gray-500">Denemelerde yapılan yanlış ve boş bırakılan soruların analiz edilip sıfırlanma (çözülme) durumu.</p>
                    </div>
                    
                    <!-- İlerleme Özeti -->
                    <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-4 flex-wrap mb-4">
                        <div class="flex-grow min-w-[200px] space-y-1.5">
                            <div class="flex justify-between text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                <span>Hata Sıfırlama Gelişimi: %${errorResetPercent}</span>
                                <span>${solvedErrorsCount} / ${totalErrorsCount} Çözüldü</span>
                            </div>
                            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div class="bg-emerald-600 h-full rounded-full transition-all duration-500" style="width: ${errorResetPercent}%"></div>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="setErrorFilter('all')" class="px-3.5 py-2.5 rounded-xl text-sm font-bold border transition ${window.currentErrorFilter === 'all' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'} min-h-[44px]">Tümü (${totalErrorsCount})</button>
                            <button onclick="setErrorFilter('pending')" class="px-3.5 py-2.5 rounded-xl text-sm font-bold border transition ${window.currentErrorFilter === 'pending' ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-red-650'} min-h-[44px]">Bekleyen (${pendingErrorsCount})</button>
                            <button onclick="setErrorFilter('solved')" class="px-3.5 py-2.5 rounded-xl text-sm font-bold border transition ${window.currentErrorFilter === 'solved' ? 'bg-green-600 border-green-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-green-650'} min-h-[44px]">Sıfırlanan (${solvedErrorsCount})</button>
                        </div>
                    </div>
                    
                    <!-- Hata Tablosu -->
                    <div class="overflow-x-auto md:max-h-[300px] md:overflow-y-auto border rounded-xl">
                        <table class="w-full border-collapse text-left">
                            <thead class="bg-gray-850 dark:bg-gray-900 text-white sticky top-0 z-10">
                                <tr>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-base font-bold bg-gray-800 text-white">Sınav / Tarih</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-base font-bold bg-gray-800 text-white">Ders / Konu</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-center text-base font-bold bg-gray-800 text-white">Hata Türü</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-center text-base font-bold bg-gray-800 text-white">Durum</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-center text-base font-bold bg-gray-800 text-white">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${errorsRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- SECTION 3: Soru Sayısı Gelişim Planı -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                    <div class="flex justify-between items-center mb-4 flex-wrap gap-2 border-b dark:border-gray-750 pb-2">
                        <div>
                            <h3 class="section-heading text-indigo-650 dark:text-indigo-400 font-bold text-lg">
                                <i class="fas fa-chart-line"></i> Soru Sayısı Gelişim Planı
                            </h3>
                            <p class="text-sm text-gray-500">Çözülen günlük soru adedi grafiği ve hedefler.</p>
                        </div>
                        <div class="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 p-1.5 rounded-xl border dark:border-gray-600 text-sm">
                            <span class="font-bold text-gray-600 dark:text-gray-400">Haftalık Hedef:</span>
                            <input type="number" id="weeklyTargetInput" value="${weeklyTarget}" onchange="changeGrowthTarget('${id}', this.value)" class="student-form-input text-sm font-bold text-center w-20 min-h-[30px]" style="padding: 2px 4px; display: inline-block;">
                            <span class="font-bold text-gray-500">Soru</span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <!-- Günlük Soru Kaydet -->
                        <div class="space-y-4">
                            <div class="bg-gray-50 dark:bg-gray-900/30 p-3.5 rounded-xl border dark:border-gray-700 space-y-2.5">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300"><i class="fas fa-plus"></i> Günlük Çözülen Soru Kaydet</h4>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-xs font-semibold mb-0.5 text-gray-550">Tarih</label>
                                        <input type="date" id="growthLogDate" value="${todayDateStr}" class="student-form-input text-sm min-h-[44px]" style="padding: 4px;">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold mb-0.5 text-gray-550">Soru Sayısı</label>
                                        <input type="number" id="growthLogCount" placeholder="Örn: 80" class="student-form-input text-sm min-h-[44px]" style="padding: 4px;">
                                    </div>
                                </div>
                                <button onclick="addGrowthLog('${id}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-bold transition min-h-[44px]">Kaydet</button>
                            </div>
                            
                            <div class="bg-gray-50 dark:bg-gray-900/30 p-3.5 rounded-xl border dark:border-gray-700">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2"><i class="fas fa-list"></i> Son Soru Kayıtları</h4>
                                <div class="space-y-1.5 md:max-h-[140px] md:overflow-y-auto pr-1 text-sm">
                                    ${growthLogsListHtml}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Günlük Dağılım Grafiği -->
                        <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border dark:border-gray-700 flex flex-col justify-between">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2"><i class="fas fa-chart-bar text-indigo-500"></i> Günlük Dağılım Grafiği (Son 7 Giriş)</h4>
                            <div class="max-h-[180px] min-h-[150px] flex justify-center flex-grow">
                                <canvas id="growthChart"></canvas>
                            </div>
                        </div>
                        
                        <!-- Hedef İlerlemesi -->
                        <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border dark:border-gray-700 flex flex-col justify-between space-y-4">
                            <div>
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2"><i class="fas fa-bullseye text-red-500"></i> Bu Haftaki Hedef İlerlemesi</h4>
                                <div class="space-y-1.5 mt-3">
                                    <div class="flex justify-between text-sm font-bold text-indigo-905 dark:text-indigo-300">
                                        <span>Haftalık Uyum: %${weeklyGrowthPercent}</span>
                                        <span>${weeksSolvedCount} / ${weeklyTarget} Soru</span>
                                    </div>
                                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div class="bg-indigo-600 h-full rounded-full transition-all duration-500" style="width: ${weeklyGrowthPercent}%"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="border-t dark:border-gray-700 pt-3 space-y-2">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300"><i class="fas fa-rocket text-indigo-500"></i> Kademe Gelişim Hedefleri</h4>
                                <div class="grid grid-cols-2 gap-2 text-sm text-gray-650 dark:text-gray-450">
                                    <div class="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                        <span class="font-semibold block text-[11px]">Gelecek Hafta (+%10)</span>
                                        <strong class="text-sm text-indigo-650 dark:text-indigo-400">${Math.round(weeklyTarget * 1.1)} Soru</strong>
                                    </div>
                                    <div class="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                        <span class="font-semibold block text-[11px]">Sonraki Hafta (+%20)</span>
                                        <strong class="text-sm text-indigo-650 dark:text-indigo-400">${Math.round(weeklyTarget * 1.2)} Soru</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        document.getElementById("dynamic-content").innerHTML = html;
        
        setTimeout(() => {
            const ctx = document.getElementById("netChart")?.getContext("2d");
            if (ctx && genelSorted.length) {
                if (store.chartInstance) store.chartInstance.destroy();
                const datasets = [{
                    label: 'Genel Deneme Netleri',
                    data: netChartData,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    tension: 0.25,
                    fill: true
                }];
                if (hedefGecerli) {
                    datasets.push({
                        label: `Hedef Net (${hedefSayi})`,
                        data: Array(genelSorted.length).fill(hedefSayi),
                        borderColor: '#10B981',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 2
                    });
                }
                const ChartClass = window.Chart || Chart;
                store.chartInstance = new ChartClass(ctx, {
                    type: 'line',
                    data: { labels: netChartLabels, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    font: { family: 'Outfit, sans-serif', weight: 'bold' }
                                }
                            }
                        }
                    }
                });
            }
            
            const errCtx = document.getElementById("errorChart")?.getContext("2d");
            if (errCtx && toplamHata > 0) {
                if (window.errorChartInstance) window.errorChartInstance.destroy();
                const ChartClass = window.Chart || Chart;
                window.errorChartInstance = new ChartClass(errCtx, {
                    type: 'doughnut',
                    data: {
                        labels: HATA_KODLARI.map(h => h.kod),
                        datasets: [{
                            data: HATA_KODLARI.map(h => hataSayilari[h.kod] || 0),
                            backgroundColor: HATA_KODLARI.map(h => getErrorColor(h.kod)),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }
            
            const growthCtx = document.getElementById("growthChart")?.getContext("2d");
            if (growthCtx && growthLogs.length > 0) {
                if (window.growthChartInstance) window.growthChartInstance.destroy();
                const sortedLogsForChart = [...growthLogs]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(-7);
                    
                const labels = sortedLogsForChart.map(l => {
                    const parts = l.date.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : l.date;
                });
                const data = sortedLogsForChart.map(l => l.count);
                const ChartClass = window.Chart || Chart;
                window.growthChartInstance = new ChartClass(growthCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Çözülen Soru',
                            data: data,
                            backgroundColor: '#7C3AED',
                            borderRadius: 6,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }
        }, 50);
        
    } catch (err) {
        console.error(err);
        alert("Öğrenci paneli açılamadı: " + err.message);
        renderHomeScreen();
    }
}

// ==================== DASHBOARD HELPERS & CALCULATORS ====================

function getInitials(name) {
    if (!name) return 'Ö';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export function getDashboardMetrics(now = new Date()) {
    const students = loadStudentsData();
    const todayStr = now.toISOString().slice(0, 10);
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const todayName = dayNames[now.getDay()];

    let todayLessonsCount = 0;
    let pendingHomeworkCount = 0;
    let overdueHomeworkCount = 0;
    let recentExamsCount = 0;
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    students.forEach(student => {
        const schedule = loadSchedule(student.id) || [];
        const todayLessons = schedule.filter(l => l.aktif !== false && l.gun === todayName);
        todayLessonsCount += todayLessons.length;

        const homeworks = getStudentOdevler(student) || [];
        homeworks.forEach(hw => {
            if (hw.durum === 'verildi') {
                pendingHomeworkCount++;
                if (hw.bitisTarihi && todayStr > hw.bitisTarihi) {
                    overdueHomeworkCount++;
                }
            }
        });

        const exams = student.denemeler || [];
        exams.forEach(ex => {
            if (ex.tarih && ex.tarih >= fourteenDaysAgo) {
                recentExamsCount++;
            }
        });
    });

    return {
        todayLessonsCount,
        pendingHomeworkCount,
        overdueHomeworkCount,
        recentExamsCount,
        studentCount: students.length
    };
}

export function getDashboardPriorityItems(now = new Date()) {
    const students = loadStudentsData();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const todayName = dayNames[now.getDay()];

    const items = [];

    students.forEach(student => {
        const homeworks = getStudentOdevler(student) || [];
        const schedule = loadSchedule(student.id) || [];
        const exams = student.denemeler || [];

        // Check 1: Overdue homework (Kritik)
        const overdue = homeworks.filter(hw => hw.durum === 'verildi' && hw.bitisTarihi && todayStr > hw.bitisTarihi);
        if (overdue.length > 0) {
            items.push({
                studentId: student.id,
                studentName: student.adSoyad,
                grade: student.sinif,
                type: 'critical',
                badgeText: 'Kritik',
                badgeClass: 'cf-badge-danger',
                icon: 'fa-exclamation-circle',
                message: `${overdue.length} gecikmiş ödev (${escapeHtml(overdue[0].konu || 'Ödev')})`,
                weight: 100 + overdue.length
            });
            return;
        }

        // Check 2: Today's lesson (Bugün)
        const todayLessons = schedule.filter(l => l.aktif !== false && l.gun === todayName);
        if (todayLessons.length > 0) {
            const firstLesson = todayLessons[0];
            items.push({
                studentId: student.id,
                studentName: student.adSoyad,
                grade: student.sinif,
                type: 'today',
                badgeText: 'Bugün',
                badgeClass: 'cf-badge-primary',
                icon: 'fa-calendar-check',
                message: `Bugün saat ${escapeHtml(firstLesson.saat || '')}'de ders (${escapeHtml(firstLesson.dersAdi || 'Özel Ders')})`,
                weight: 80
            });
            return;
        }

        // Check 3: Homework due today/tomorrow (Dikkat)
        const dueSoon = homeworks.filter(hw => hw.durum === 'verildi' && (hw.bitisTarihi === todayStr || hw.bitisTarihi === tomorrowStr));
        if (dueSoon.length > 0) {
            items.push({
                studentId: student.id,
                studentName: student.adSoyad,
                grade: student.sinif,
                type: 'warning',
                badgeText: 'Dikkat',
                badgeClass: 'cf-badge-warning',
                icon: 'fa-clock',
                message: `Ödev teslimi yaklaşıyor (${escapeHtml(dueSoon[0].konu || 'Ödev')})`,
                weight: 60
            });
            return;
        }

        // Check 4: General Exam Drop or Rise (Dikkat / Gelişim)
        const generalExams = exams.filter(e => e.tip === 'genel').sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));
        if (generalExams.length >= 2) {
            const latest = generalExams.at(-1);
            const prev = generalExams.at(-2);
            const diff = (Number(latest.toplamNet) || 0) - (Number(prev.toplamNet) || 0);
            if (diff <= -3) {
                items.push({
                    studentId: student.id,
                    studentName: student.adSoyad,
                    grade: student.sinif,
                    type: 'warning',
                    badgeText: 'Dikkat',
                    badgeClass: 'cf-badge-warning',
                    icon: 'fa-chart-line-down',
                    message: `Son denemede ${Math.abs(diff).toFixed(1)} net gerileme`,
                    weight: 50 + Math.abs(diff)
                });
                return;
            } else if (diff >= 3) {
                items.push({
                    studentId: student.id,
                    studentName: student.adSoyad,
                    grade: student.sinif,
                    type: 'growth',
                    badgeText: 'Gelişim',
                    badgeClass: 'cf-badge-success',
                    icon: 'fa-arrow-trend-up',
                    message: `Son denemede +${diff.toFixed(1)} net artış`,
                    weight: 30 + diff
                });
                return;
            }
        }
    });

    return items.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

export function getStudentCardSummary(student) {
    const exams = (student.denemeler || []).filter(e => e.tip === 'genel').sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));
    const latestExam = exams.at(-1) || null;
    const previousExam = exams.at(-2) || null;

    const latestNet = latestExam && Number.isFinite(Number(latestExam.toplamNet)) ? Number(latestExam.toplamNet).toFixed(1) : null;
    const targetNet = student.hedefNet && Number.isFinite(Number(student.hedefNet)) ? Number(student.hedefNet).toFixed(0) : null;

    const homeworks = getStudentOdevler(student) || [];
    const activeHwCount = homeworks.filter(hw => hw.durum === 'verildi').length;

    let trend = null;
    if (latestExam && previousExam) {
        const diff = (Number(latestExam.toplamNet) || 0) - (Number(previousExam.toplamNet) || 0);
        if (diff >= 1) trend = { type: 'up', label: '↑ Yükseliyor', color: 'text-green-600 dark:text-green-400' };
        else if (diff <= -1) trend = { type: 'down', label: '↓ Düşüyor', color: 'text-red-500 dark:text-red-400' };
        else trend = { type: 'stable', label: '→ Stabil', color: 'text-blue-600 dark:text-blue-400' };
    }

    return {
        latestNet,
        targetNet,
        activeHwCount,
        trend
    };
}

export function filterDashboardStudents(query) {
    store.dashboardSearchQuery = (query || '').toLowerCase().trim();
    const studentCards = document.querySelectorAll('.cf-student-card-item');
    let visibleCount = 0;
    studentCards.forEach(card => {
        const name = card.getAttribute('data-name') || '';
        const match = !store.dashboardSearchQuery || name.toLowerCase().includes(store.dashboardSearchQuery);
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });
    const emptyNotice = document.getElementById('dashboardStudentsEmptySearch');
    if (emptyNotice) {
        emptyNotice.style.display = (visibleCount === 0 && studentCards.length > 0) ? 'block' : 'none';
    }
}

export function renderReminderHome() {
    store.currentPage = "reminderHome";
    if (window.currentPage) window.currentPage = "reminderHome";
    updateMobileNavActive('mobile-nav-reminders');

    const students = loadStudentsData();
    const metrics = getDashboardMetrics();
    const priorityItems = getDashboardPriorityItems();

    let filtered = students;
    if (store.activeFilter !== "all") {
        filtered = students.filter(s => s.sinif === store.activeFilter);
    }
    const sorted = getSortedStudents(filtered, store.currentSortOrder);

    // 1. Metric Cards HTML
    const metricCardsHtml = `
        <div class="cf-dashboard-grid mb-6">
            <div class="cf-card p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="cf-metric-label">Bugünkü Dersler</span>
                    <div class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold"><i class="fas fa-calendar-check"></i></div>
                </div>
                <div class="cf-metric-value text-2xl mt-2">${metrics.todayLessonsCount}</div>
                <div class="text-xs text-gray-500 mt-1">${metrics.todayLessonsCount > 0 ? metrics.todayLessonsCount + ' ders planlandı' : 'Bugün ders yok'}</div>
            </div>

            <div class="cf-card p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="cf-metric-label">Bekleyen Ödev</span>
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold"><i class="fas fa-tasks"></i></div>
                </div>
                <div class="cf-metric-value text-2xl mt-2">${metrics.pendingHomeworkCount}</div>
                <div class="text-xs text-gray-500 mt-1">${metrics.pendingHomeworkCount > 0 ? 'Öğrenci teslimi bekliyor' : 'Bekleyen ödev yok'}</div>
            </div>

            <div class="cf-card p-4 flex flex-col justify-between ${metrics.overdueHomeworkCount > 0 ? 'border-red-300 dark:border-red-800/60 bg-red-50/20 dark:bg-red-950/10' : ''}">
                <div class="flex items-center justify-between">
                    <span class="cf-metric-label">Geciken Ödev</span>
                    <div class="w-8 h-8 rounded-lg ${metrics.overdueHomeworkCount > 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'} flex items-center justify-center text-sm font-bold"><i class="fas fa-triangle-exclamation"></i></div>
                </div>
                <div class="cf-metric-value text-2xl mt-2 ${metrics.overdueHomeworkCount > 0 ? 'text-red-600 dark:text-red-400' : ''}">${metrics.overdueHomeworkCount}</div>
                <div class="text-xs ${metrics.overdueHomeworkCount > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500'} mt-1">${metrics.overdueHomeworkCount > 0 ? 'Acil kontrol gerekiyor' : 'Geciken ödev yok'}</div>
            </div>

            <div class="cf-card p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="cf-metric-label">Son Denemeler</span>
                    <div class="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-bold"><i class="fas fa-file-signature"></i></div>
                </div>
                <div class="cf-metric-value text-2xl mt-2">${metrics.recentExamsCount}</div>
                <div class="text-xs text-gray-500 mt-1">${metrics.recentExamsCount > 0 ? 'Son 14 günde kaydedildi' : 'Kayıt bulunmuyor'}</div>
            </div>
        </div>
    `;

    // 2. Priority List HTML
    const prioritySectionHtml = `
        <div class="cf-card p-5 mb-6">
            <div class="flex items-center justify-between mb-3.5">
                <div class="flex items-center gap-2">
                    <div class="w-2.5 h-2.5 rounded-full bg-[#FF9F1C]"></div>
                    <h3 class="font-black text-base text-gray-900 dark:text-white">Bugün İlgilenmeniz Gerekenler</h3>
                </div>
                <span class="text-xs font-semibold text-gray-500">${priorityItems.length} konu</span>
            </div>

            ${priorityItems.length > 0 ? `
                <div class="flex flex-col gap-2.5">
                    ${priorityItems.map(item => `
                        <div onclick="selectStudent('${item.studentId}')" class="cf-priority-item">
                            <div class="flex items-center gap-3 min-w-0">
                                <span class="cf-badge ${item.badgeClass} shrink-0"><i class="fas ${item.icon}"></i> ${item.badgeText}</span>
                                <div class="min-w-0 truncate">
                                    <span class="font-bold text-sm text-gray-900 dark:text-white mr-1">${escapeHtml(item.studentName)}:</span>
                                    <span class="text-xs text-gray-600 dark:text-gray-300">${item.message}</span>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400 text-xs shrink-0"></i>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="cf-panel-soft text-center py-5">
                    <i class="fas fa-check-circle text-green-500 text-2xl mb-1.5"></i>
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-200">Bugün acil ilgi gerektiren bir durum bulunmuyor.</p>
                    <p class="text-xs text-gray-500 mt-0.5">Tüm ders ve ödev süreçleri planlanan akışında devam ediyor.</p>
                </div>
            `}
        </div>
    `;

    // 3. Students Section Filters & Cards
    const filterChipsHtml = `
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button onclick="setFilter('all')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] whitespace-nowrap ${store.activeFilter === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}">Tümü (${students.length})</button>
            <button onclick="setFilter('5')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] whitespace-nowrap ${store.activeFilter === '5' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}">5. Sınıf</button>
            <button onclick="setFilter('6')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] whitespace-nowrap ${store.activeFilter === '6' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}">6. Sınıf</button>
            <button onclick="setFilter('7')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] whitespace-nowrap ${store.activeFilter === '7' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}">7. Sınıf</button>
            <button onclick="setFilter('8')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] whitespace-nowrap ${store.activeFilter === '8' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}">8. Sınıf</button>
        </div>
    `;

    const sortButtonsHtml = `
        <div class="flex items-center gap-1.5">
            <button onclick="setSortOrder('default')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] ${store.currentSortOrder === 'default' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}">Varsayılan</button>
            <button onclick="setSortOrder('net-desc')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] ${store.currentSortOrder === 'net-desc' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}">Net (Yüksek↓)</button>
            <button onclick="setSortOrder('net-asc')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition border min-h-[34px] ${store.currentSortOrder === 'net-asc' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}">Net (Düşük↑)</button>
        </div>
    `;

    const studentCardsHtml = sorted.length === 0
        ? '<div class="cf-panel-soft text-center py-8 col-span-full text-gray-500">Bu filtreye uygun öğrenci bulunamadı.</div>'
        : sorted.map(s => {
            const sinifGoster = s.sinif ? `${escapeHtml(s.sinif)}. Sınıf` : "Sınıf yok";
            const okulGoster = s.okul ? escapeHtml(s.okul) : "Okul belirtilmemiş";
            const initials = getInitials(s.adSoyad);
            const summary = getStudentCardSummary(s);

            const netText = summary.latestNet !== null ? summary.latestNet : '—';
            const targetText = summary.targetNet !== null ? summary.targetNet : '—';
            const hwText = summary.activeHwCount > 0 ? `${summary.activeHwCount} aktif` : '0';
            const trendHtml = summary.trend
                ? `<span class="font-bold ${summary.trend.color}">${summary.trend.label}</span>`
                : '<span class="text-gray-400 dark:text-gray-500">—</span>';

            return `
                <div onclick="selectStudent('${s.id}')" data-name="${escapeHtml(s.adSoyad || '')}" class="cf-student-card cf-student-card-item p-4 gap-3.5">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="cf-avatar">${initials}</div>
                            <div class="min-w-0">
                                <h4 class="font-black text-base text-gray-900 dark:text-white truncate">${escapeHtml(s.adSoyad)}</h4>
                                <p class="text-xs text-gray-500 truncate">${sinifGoster} · ${okulGoster}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
                            <button onclick="editStudent('${s.id}')" class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center transition" title="Düzenle" aria-label="Öğrenciyi düzenle"><i class="fas fa-pen text-sm"></i></button>
                            <button onclick="deleteStudent('${s.id}')" class="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center transition" title="Sil" aria-label="Öğrenciyi sil"><i class="fas fa-trash text-sm"></i></button>
                        </div>
                    </div>

                    <div class="grid grid-cols-4 gap-2 pt-2 border-t border-gray-150/40 dark:border-gray-800 text-center">
                        <div class="cf-stat-box">
                            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Son Net</div>
                            <div class="text-sm font-black text-gray-800 dark:text-white mt-0.5">${netText}</div>
                        </div>
                        <div class="cf-stat-box">
                            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Hedef</div>
                            <div class="text-sm font-black text-gray-800 dark:text-white mt-0.5">${targetText}</div>
                        </div>
                        <div class="cf-stat-box">
                            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Ödev</div>
                            <div class="text-sm font-black ${summary.activeHwCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-white'} mt-0.5">${hwText}</div>
                        </div>
                        <div class="cf-stat-box">
                            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Trend</div>
                            <div class="text-xs font-black mt-0.5 truncate">${trendHtml}</div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 pt-1">
                        <span><i class="fas fa-chart-line mr-1"></i> Öğrenci Kokpiti</span>
                        <i class="fas fa-arrow-right text-xs"></i>
                    </div>
                </div>
            `;
        }).join('');

    const studentsSectionHtml = `
        <div class="cf-card p-5 mb-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                    <h3 class="font-black text-base text-gray-900 dark:text-white">Öğrenciler</h3>
                    <p class="text-xs text-gray-500">${sorted.length} kayıtlı öğrenci · Hızlı arama ve gelişim takibi</p>
                </div>
                <div class="flex items-center gap-2">
                    <div class="relative w-full md:w-64">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                        <input type="text" id="dashboardStudentSearch" oninput="filterDashboardStudents(this.value)" placeholder="Öğrenci ara..." class="cf-input pl-8 py-1.5 text-xs w-full min-h-[44px]">
                    </div>
                    <button onclick="showAddStudentModal()" class="cf-btn-primary py-2 px-3.5 text-xs min-h-[44px] whitespace-nowrap"><i class="fas fa-plus mr-1"></i> Ekle</button>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pt-3 border-t border-gray-150/40 dark:border-gray-800">
                ${filterChipsHtml}
                ${sortButtonsHtml}
            </div>

            <div id="dashboardStudentsEmptySearch" class="cf-panel-soft text-center py-6 text-gray-500 hidden mb-3">
                Aramanızla eşleşen öğrenci bulunamadı.
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                ${studentCardsHtml}
            </div>
        </div>
    `;

    // 4. Lesson Reminder Section
    const reminderCenterHtml = `
        <div class="mb-6">
            ${renderLessonReminderCenter()}
        </div>
    `;

    // Final Assembly
    const teacherGreeting = store.teacherName ? `, ${escapeHtml(store.teacherName)}` : '';
    document.getElementById("dynamic-content").innerHTML = `
        <div class="cf-page">
            <header class="cf-page-header">
                <div>
                    <h2 class="cf-page-title">Hoş Geldiniz${teacherGreeting}</h2>
                    <p class="cf-page-subtitle">Bugünkü özel ders durumunuz ve öğrenci gelişim özetleriniz.</p>
                </div>
            </header>

            ${metricCardsHtml}
            ${prioritySectionHtml}
            ${studentsSectionHtml}
            ${reminderCenterHtml}
        </div>
    `;
}

export function renderGenelIslemler() {
    store.currentPage = "general";
    if (window.currentPage) window.currentPage = "general";
    updateMobileNavActive('mobile-nav-general');
    
    const themeText = store.darkMode ? 'Açık Mod' : 'Koyu Mod';
    const themeIcon = store.darkMode ? 'fa-sun' : 'fa-moon';
    const cloudUser = window.auth?.currentUser;
    const localMigrationSummary = window.getLocalMigrationSummary?.() || { students: 0, groups: 0, schedules: 0, lessons: 0 };
    const recoveryHtml = cloudUser && (localMigrationSummary.students > 0 || localMigrationSummary.groups > 0) ? `
        <div class="app-panel p-5 border-amber-200 dark:border-amber-800">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0"><i class="fas fa-cloud-upload-alt"></i></div>
                <div>
                    <h3 class="font-black text-gray-800 dark:text-white">Yerel Kayıt Kurtarma</h3>
                    <p class="text-xs text-gray-500 mt-1">Bu Chrome profilinde <strong>${localMigrationSummary.students} öğrenci</strong>, ${localMigrationSummary.lessons} ders kaydı ve ${localMigrationSummary.groups} grup bulundu. Aktarım yalnızca açık ve boş bulut hesabına yapılır; yerel kayıtlar silinmez.</p>
                </div>
            </div>
            <div class="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200">Açık hesap: ${escapeHtml(cloudUser.email || '')}</div>
            <label for="migrationAccountEmail" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mt-4 mb-1.5">Onaylamak için açık hesabın e-posta adresini yazın</label>
            <input id="migrationAccountEmail" type="email" autocomplete="off" class="student-form-input min-h-[44px]" placeholder="${escapeHtml(cloudUser.email || '')}">
            <button id="localMigrationButton" type="button" onclick="startLocalDataRecovery()" class="btn-primary mt-3 w-full min-h-[44px]"><i class="fas fa-cloud-upload-alt mr-1"></i> Yerel Kayıtları Bu Hesaba Aktar</button>
            <p id="localMigrationFeedback" class="text-xs font-semibold mt-3 hidden" role="status"></p>
        </div>` : '';
    
    const logoutHtml = (window.isFirebaseActive && window.auth && window.auth.currentUser) ? `
        <button onclick="handleLogout()" class="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-xl transition font-medium text-left">
            <i class="fas fa-sign-out-alt text-red-500 text-xl w-8 text-center"></i>
            <div>
                <div class="text-sm text-red-600 dark:text-red-400">Oturumu Kapat</div>
                <div class="text-xs text-red-400">Bulut oturumundan çıkış yap</div>
            </div>
        </button>
    ` : '';
    
    const resourceBooks = loadResourceBooks();
    const selectedResourceBooks = selectedSettingsResourceGrade
        ? resourceBooks.filter(book => String(book.grade) === selectedSettingsResourceGrade)
        : [];
    const resourceBookRows = !selectedSettingsResourceGrade
        ? '<p class="text-sm text-gray-500">Kaynak kitapları görmek için önce sınıf düzeyi seçin.</p>'
        : selectedResourceBooks.length ? selectedResourceBooks.map(book => `
            <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 px-3 py-2">
                <div><span class="font-bold text-sm">${escapeHtml(book.name)}</span><p class="text-xs text-gray-500">${escapeHtml(book.grade)}. Sınıf · ${escapeHtml(book.subject)}</p></div>
                <button type="button" onclick="removeResourceBook('${book.id}')" class="min-w-[44px] min-h-[44px] text-red-500" aria-label="${escapeHtml(book.name)} kaynağını sil"><i class="fas fa-trash"></i></button>
            </div>`).join('')
        : `<p class="text-sm text-gray-500">${escapeHtml(selectedSettingsResourceGrade)}. sınıf için henüz kaynak kitap eklenmedi.</p>`;
    const html = `
        <div class="app-page max-w-3xl">
            <header class="app-page-header"><div><h2 class="app-page-title">Ayarlar</h2><p class="app-page-subtitle">
                Uygulama genel özelliklerini, finans durumunu, veri yedeklerini ve toplu işlemlerinizi buradan yönetebilirsiniz.
            </p></div></header>

            <!-- Öğretmen Bilgi Kartı & Branş Seçimi -->
            <div class="app-panel p-5 flex flex-col gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black">
                        <i class="fas fa-chalkboard-teacher"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <input type="text" id="teacherNameInput" value="${escapeHtml(store.teacherName || '')}" maxlength="80" placeholder="Adınız Soyadınız" class="bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-indigo-500 focus:outline-none text-base font-bold text-gray-800 dark:text-gray-150 py-0.5 px-1 rounded transition w-full">
                        <input type="text" id="teacherSchoolInput" value="${escapeHtml(store.teacherSchool || '')}" maxlength="120" placeholder="Çalıştığınız Okul / Kurum" class="bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-indigo-500 focus:outline-none text-xs font-semibold text-gray-500 dark:text-gray-400 py-0.5 px-1 rounded transition w-full mt-0.5">
                        <div class="text-xs text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5 mt-1 px-1">
                            <i class="fas fa-envelope"></i> ${window.auth && window.auth.currentUser ? window.auth.currentUser.email : 'Yerel Çevrimdışı Hesap'}
                        </div>
                    </div>
                </div>

                <!-- Branş / Ders Seçimi -->
                <div class="pt-3 border-t border-indigo-150/10 dark:border-indigo-900/25">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2.5 uppercase tracking-wider">📚 Vereceğiniz Dersler (Çoklu Seçim)</label>
                    <div class="flex flex-wrap gap-2">
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" name="settingsTeacherBranch" id="settingsBranchTur" value="Türkçe" ${store.teacherBranches.includes("Türkçe") ? "checked" : ""} class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Türkçe</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" name="settingsTeacherBranch" id="settingsBranchMath" value="Matematik" ${store.teacherBranches.includes("Matematik") ? "checked" : ""} class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Matematik</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" name="settingsTeacherBranch" id="settingsBranchScience" value="Fen Bilimleri" ${store.teacherBranches.includes("Fen Bilimleri") ? "checked" : ""} class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Fen</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" name="settingsTeacherBranch" id="settingsBranchSoc" value="Sosyal Bilgiler" ${store.teacherBranches.includes("Sosyal Bilgiler") ? "checked" : ""} class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Sosyal Bilgiler</span>
                        </label>
                    </div>
                    <div id="branchSettingsFeedback" class="text-xs text-green-600 dark:text-green-400 mt-2 font-semibold hidden flex items-center gap-1">
                        <i class="fas fa-check-circle"></i> Branş ayarlarınız güncellendi.
                    </div>
                    <button type="button" onclick="saveTeacherProfileFromSettings()" class="btn-primary mt-3 w-full sm:w-auto px-5 min-h-[44px] text-sm">
                        <i class="fas fa-save mr-1"></i> Öğretmen Profilini Kaydet
                    </button>
                </div>
            </div>

            ${recoveryHtml}

            <div class="app-panel p-5">
                <h3 class="font-black text-gray-800 dark:text-white"><i class="fas fa-database text-indigo-600 mr-1"></i> Veri Yedekleme ve Geri Yükleme</h3>
                <p class="text-xs text-gray-500 mt-1">Tüm hesap verilerinizi JSON dosyası olarak indirin veya daha önce alınmış tam yedeği güvenli biçimde geri yükleyin.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <button type="button" onclick="exportBackup()" class="btn-primary min-h-[44px]"><i class="fas fa-download mr-1"></i> Tam Yedeği İndir</button>
                    <button type="button" onclick="showImportModal()" class="btn-secondary min-h-[44px]"><i class="fas fa-upload mr-1"></i> Tam Yedeği Geri Yükle</button>
                </div>
                <p class="text-xs text-amber-700 dark:text-amber-300 mt-3"><i class="fas fa-lock mr-1"></i> Yedek dosyası kişisel öğrenci verileri içerir; güvenli bir yerde saklayın.</p>
            </div>

            <div class="app-panel p-5">
                <h3 class="font-black text-gray-800 dark:text-white"><i class="fas fa-book text-indigo-600"></i> Kaynak Kitaplar</h3>
                <p class="text-xs text-gray-500 mt-1 mb-3">Kaynakları sınıf ve ders düzeyine göre tanımlayın; ödev, ders kaydı ve konu denemelerinde listeden seçin.</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select id="resourceGrade" onchange="filterSettingsResourceBooks(this.value)" class="student-form-input min-h-[44px]"><option value="">Sınıf seçin</option>${['5','6','7','8'].map(grade => `<option value="${grade}" ${selectedSettingsResourceGrade === grade ? 'selected' : ''}>${grade}. Sınıf</option>`).join('')}</select>
                    <select id="resourceSubject" class="student-form-input min-h-[44px]"><option value="">Ders seçin</option>${(store.teacherBranches || []).map(subject => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('')}</select>
                    <input id="resourceName" maxlength="120" class="student-form-input min-h-[44px]" placeholder="Kitap / yayın adı">
                </div>
                <button type="button" onclick="saveNewResourceBook()" class="btn-primary mt-3 w-full min-h-[44px]"><i class="fas fa-plus mr-1"></i> Kaynak Kitap Ekle</button>
                <div class="mt-4 space-y-2">${resourceBookRows}</div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onclick="toggleTheme()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas ${themeIcon} text-indigo-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Görünüm Teması</div>
                        <div class="text-sm text-gray-450">${themeText}'a Geç</div>
                    </div>
                </button>
                <button onclick="renderFinanceReport()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas fa-wallet text-indigo-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Finans / Ödeme Raporu</div>
                        <div class="text-sm text-gray-450">Genel Muhasebe Takibi</div>
                    </div>
                </button>
                <button onclick="showDenemeAtaModal()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas fa-copy text-indigo-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Toplu Deneme Ata</div>
                        <div class="text-sm text-gray-450">Çoklu Öğrenci Seçimi</div>
                    </div>
                </button>
                <button onclick="renderGroupsPage()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas fa-users-cog text-indigo-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Sınıf & Grup Yönetimi</div>
                        <div class="text-sm text-gray-450">Gruplar, Ödevler ve Liderlik</div>
                    </div>
                </button>
                ${logoutHtml}
            </div>

            ${cloudUser && !store.isGuestMode ? `
            <div class="app-panel p-5 border-red-200 dark:border-red-900">
                <h3 class="font-black text-red-700 dark:text-red-300"><i class="fas fa-exclamation-triangle mr-1"></i> Hesap ve Veri Yönetimi</h3>
                <p class="text-xs text-gray-500 mt-1">Hesabınızı kapatmak isterseniz tüm bulut kayıtlarını kalıcı olarak silebilirsiniz. Bu işlem geri alınamaz ve yeniden kimlik doğrulaması gerektirir.</p>
                <button type="button" onclick="showAccountDeletionDialog()" class="mt-3 w-full min-h-[44px] rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-black hover:bg-red-50 dark:hover:bg-red-900/20"><i class="fas fa-user-times mr-1"></i> Hesabımı ve Verilerimi Sil</button>
            </div>` : ''}

            <div class="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-400">
                <i class="fas fa-flask"></i> Canfenci Öğrenci Takip Sistemi PWA v1.0
                <button type="button" onclick="showPrivacyNotice()" class="block mx-auto mt-2 min-h-[44px] text-xs font-bold underline hover:text-indigo-600">Gizlilik ve KVKK Aydınlatma Metni</button>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export async function startLocalDataRecovery() {
    const feedback = document.getElementById('localMigrationFeedback');
    const button = document.getElementById('localMigrationButton');
    if (!window.migrateLocalDataToCurrentAccount) return;
    if (button) button.disabled = true;
    if (feedback) {
        feedback.textContent = 'Aktarım güvenli biçimde hazırlanıyor…';
        feedback.className = 'text-xs font-semibold mt-3 text-indigo-600 dark:text-indigo-300';
    }
    try {
        const result = await window.migrateLocalDataToCurrentAccount(document.getElementById('migrationAccountEmail')?.value);
        if (feedback) {
            feedback.textContent = result.message;
            feedback.className = `text-xs font-semibold mt-3 ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`;
        }
        if (result.ok && button) button.classList.add('hidden');
    } catch (err) {
        console.error('Local data recovery failed:', err);
        if (feedback) {
            feedback.textContent = 'Aktarım sırasında bağlantı hatası oluştu. Yerel kayıtlar korunuyor.';
            feedback.className = 'text-xs font-semibold mt-3 text-red-600 dark:text-red-400';
        }
    } finally {
        if (button && !button.classList.contains('hidden')) button.disabled = false;
    }
}

export function saveNewResourceBook() {
    const result = addResourceBook({
        grade: document.getElementById('resourceGrade')?.value,
        subject: document.getElementById('resourceSubject')?.value,
        name: document.getElementById('resourceName')?.value
    });
    if (!result.ok) return alert(result.error);
    renderGenelIslemler();
}

export function filterSettingsResourceBooks(grade) {
    selectedSettingsResourceGrade = String(grade || '');
    renderGenelIslemler();
}

export function removeResourceBook(id) {
    if (!confirm('Bu kaynak kitabı silmek istediğinize emin misiniz?')) return;
    deleteResourceBook(id);
    renderGenelIslemler();
}

export async function updateTeacherName() {
    const newName = document.getElementById("teacherNameInput")?.value.trim() || "Öğretmen Adı";
    store.teacherName = newName;
    localStorage.setItem(localDataKey('teacher_name_v1'), newName);
    
    if (window.isFirebaseActive && window.auth && window.auth.currentUser && window.db) {
        try {
            const uid = window.auth.currentUser.uid;
            await window.db.collection("users").doc(uid).set({
                name: newName,
                email: window.auth.currentUser.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Firestore teacher name update failed:", err);
        }
    }
    
    const fb = document.getElementById("branchSettingsFeedback");
    if (fb) {
        fb.innerHTML = `<i class="fas fa-check-circle"></i> Öğretmen ismi güncellendi.`;
        fb.classList.remove("hidden");
        setTimeout(() => fb.classList.add("hidden"), 3000);
    }
}

export async function updateTeacherBranches() {
    const isTurChecked = document.getElementById("settingsBranchTur")?.checked;
    const isMathChecked = document.getElementById("settingsBranchMath")?.checked;
    const isScienceChecked = document.getElementById("settingsBranchScience")?.checked;
    const isSocChecked = document.getElementById("settingsBranchSoc")?.checked;
    
    const branches = [];
    if (isTurChecked) branches.push("Türkçe");
    if (isMathChecked) branches.push("Matematik");
    if (isScienceChecked) branches.push("Fen Bilimleri");
    if (isSocChecked) branches.push("Sosyal Bilgiler");
    
    if (branches.length === 0) {
        alert("Lütfen en az bir branş seçiniz.");
        const current = store.teacherBranches || ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"];
        if (document.getElementById("settingsBranchTur")) {
            document.getElementById("settingsBranchTur").checked = current.includes("Türkçe");
        }
        if (document.getElementById("settingsBranchMath")) {
            document.getElementById("settingsBranchMath").checked = current.includes("Matematik");
        }
        if (document.getElementById("settingsBranchScience")) {
            document.getElementById("settingsBranchScience").checked = current.includes("Fen Bilimleri");
        }
        if (document.getElementById("settingsBranchSoc")) {
            document.getElementById("settingsBranchSoc").checked = current.includes("Sosyal Bilgiler");
        }
        return;
    }
    
    localStorage.setItem(localDataKey('teacher_branches_v1'), JSON.stringify(branches));
    store.teacherBranches = branches;
    
    if (window.isFirebaseActive && window.auth && window.auth.currentUser && window.db) {
        try {
            const uid = window.auth.currentUser.uid;
            await window.db.collection("users").doc(uid).set({
                branches: branches,
                email: window.auth.currentUser.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Firestore settings update failed:", err);
        }
    }
    
    const fb = document.getElementById("branchSettingsFeedback");
    if (fb) {
        fb.innerHTML = `<i class="fas fa-check-circle"></i> Branş ayarlarınız güncellendi.`;
        fb.classList.remove("hidden");
        setTimeout(() => fb.classList.add("hidden"), 3000);
    }
}

export async function updateTeacherSchool() {
    const newSchool = document.getElementById("teacherSchoolInput")?.value.trim() || "";
    store.teacherSchool = newSchool;
    localStorage.setItem(localDataKey('teacher_school_v1'), newSchool);
    
    if (window.isFirebaseActive && window.auth && window.auth.currentUser && window.db) {
        try {
            const uid = window.auth.currentUser.uid;
            await window.db.collection("users").doc(uid).set({
                school: newSchool,
                email: window.auth.currentUser.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Firestore school update failed:", err);
        }
    }
    
    const fb = document.getElementById("branchSettingsFeedback");
    if (fb) {
        fb.innerHTML = `<i class="fas fa-check-circle"></i> Okul bilginiz güncellendi.`;
        fb.classList.remove("hidden");
        setTimeout(() => fb.classList.add("hidden"), 3000);
    }
}

// Global window mappings for compatibility
window.onTargetSchoolChanged = onTargetSchoolChanged;
window.renderHomeScreen = renderHomeScreen;
window.setSortOrder = setSortOrder;
window.setFilter = setFilter;
window.deleteStudent = deleteStudent;
window.editStudent = editStudent;
window.saveStudentEdit = saveStudentEdit;
window.showAddStudentModal = showAddStudentModal;
window.closeAddStudentModal = closeAddStudentModal;
window.addStudentFromModal = addStudentFromModal;
window.toggleReportMenu = toggleReportMenu;
window.hideReportMenu = hideReportMenu;
window.switchStudentTab = switchStudentTab;
window.exportBackup = exportBackup;
window.showImportModal = showImportModal;
window.previewBackupFile = previewBackupFile;
window.importBackup = importBackup;
window.renderStudentSummaryPanel = renderStudentSummaryPanel;
window.selectStudent = (id) => renderStudentCockpit(id, 'home');
window.renderStudentPanel = renderStudentPanel;
window.renderStudentCockpit = renderStudentCockpit;
window.openCockpitHomework = (studentId) => {
    store.currentStudentId = studentId;
    store.studentPanelOrigin = store.studentPanelOrigin || 'home';
    window._homeworkReturnToCockpit = studentId;
    window._homeworkReturnOrigin = store.studentPanelOrigin;
    window._geciciOdevListesi = [];
    window.renderOdevAtaModal?.([studentId], null);
};
window.openCockpitExam = (studentId) => {
    store.currentStudentId = studentId;
    store.studentPanelOrigin = store.studentPanelOrigin || 'home';
    window.showDenemeAtaModal?.(studentId);
};
window.openCockpitLesson = (studentId, focusNote = false) => {
    store.currentStudentId = studentId;
    store.studentPanelOrigin = store.studentPanelOrigin || 'home';
    window._cockpitReturnOrigin = store.studentPanelOrigin;
    window.renderDersDetay?.(studentId, 'cockpit');
    if (focusNote) {
        requestAnimationFrame(() => {
            const form = document.querySelector('details.app-disclosure');
            if (form) form.open = true;
            document.getElementById('kayitIcerik')?.focus();
        });
    }
};
window.renderGenelIslemler = renderGenelIslemler;
window.startLocalDataRecovery = startLocalDataRecovery;
window.renderReminderHome = renderReminderHome;
window.filterDashboardStudents = filterDashboardStudents;
window.updateTeacherBranches = updateTeacherBranches;
window.updateTeacherName = updateTeacherName;
window.updateTeacherSchool = updateTeacherSchool;
window.saveNewResourceBook = saveNewResourceBook;
window.removeResourceBook = removeResourceBook;
window.filterSettingsResourceBooks = filterSettingsResourceBooks;
