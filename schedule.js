// ==================== WEEKLY LESSON SCHEDULE MODÜLÜ ====================

import { store, loadStudentsData, loadSchedule, saveSchedule, escapeHtml } from './store.js';
import { updateMobileNavActive } from './auth.js';
import { buildScheduleConflictMessage, findScheduleConflict } from './schedule-conflicts.js';
import { renderDerslerTabBarHtml } from './finance.js';

export function getAllSchedulesByStudent(students) {
    return Object.fromEntries(students.map(student => [student.id, loadSchedule(student.id)]));
}

function getTurkishTodayName() {
    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    return days[new Date().getDay()];
}

function normalizeBranchText(str) {
    return String(str || '')
        .trim()
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .toLowerCase()
        .replace(/i̇/g, 'i');
}

export function getScheduleBranchTagClasses(branchName) {
    const b = normalizeBranchText(branchName);
    if (b.includes('fen')) {
        return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/80';
    }
    if (b.includes('mat')) {
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80';
    }
    if (b.includes('türk') || b.includes('turk')) {
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80';
    }
    if (b.includes('ing')) {
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80';
    }
    if (b.includes('sos') || b.includes('inkılap') || b.includes('inkilap')) {
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80';
    }
    if (b.includes('din')) {
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80';
    }
    return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
}

export function getScheduleGradeBadgeClasses(sinif) {
    const s = String(sinif || '').trim();
    if (s === '5' || s.startsWith('5')) {
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80';
    }
    if (s === '6' || s.startsWith('6')) {
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80';
    }
    if (s === '7' || s.startsWith('7')) {
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80';
    }
    if (s === '8' || s.startsWith('8')) {
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80';
    }
    return 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
}

export function getScheduleBranchShortLabel(branchName) {
    const b = String(branchName || '').trim();
    const lower = normalizeBranchText(b);
    if (lower === 'fen bilimleri') return 'Fen';
    if (lower === 'sosyal bilgiler') return 'Sosyal';
    if (lower.includes('inkılap') || lower.includes('inkilap')) return 'İnkılap';
    if (lower === 'din kültürü ve ahlak bilgisi') return 'Din Kültürü';
    return b || 'Ders';
}

export function renderSchedulePage() {
    store.currentPage = "schedule";
    updateMobileNavActive('mobile-nav-lessons');
    const students = loadStudentsData();
    if (students.length === 0) { 
        document.getElementById("dynamic-content").innerHTML = `
            <div class="app-page">
                <header class="app-page-header">
                    <div>
                        <h2 class="app-page-title">Ders Programı</h2>
                        <p class="app-page-subtitle">Haftalık ders çizelgesi ve program yoğunluğu.</p>
                    </div>
                </header>
                ${renderDerslerTabBarHtml('schedule')}
                <div class="app-panel p-8 text-center text-gray-500 dark:text-gray-400">
                    <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 text-xl">
                        <i class="fas fa-calendar-times"></i>
                    </div>
                    <p class="font-bold text-gray-700 dark:text-gray-200">Henüz öğrenci eklenmemiş</p>
                    <p class="text-sm mt-1">Ders programı oluşturmak için önce öğrenci ekleyin.</p>
                </div>
            </div>`; 
        return; 
    }
    
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    const todayName = getTurkishTodayName();
    
    let selectedStudentId = window._scheduleSelectedStudentId || 'all';
    let activeDay = window._activeScheduleDay || (gunler.includes(todayName) ? todayName : "Pazartesi");

    // Gather all schedules across all students
    const allSchedules = [];
    for (const s of students) {
        const sch = loadSchedule(s.id);
        const is8th = String(s.sinif).trim() === "8" || (s.adSoyad && s.adSoyad.includes("(8)"));
        sch.forEach((item, idx) => {
            const rawLesson = item.dersAdi || item.ders || "Ders";
            const displayName = (is8th && rawLesson === "Sosyal Bilgiler") ? "İnkılap Tarihi" : rawLesson;
            allSchedules.push({
                studentId: s.id,
                studentName: s.adSoyad,
                sinif: is8th ? "8" : (s.sinif || ""),
                gun: item.gun,
                saat: item.saat,
                dersAdi: displayName,
                rawDers: rawLesson,
                aktif: item.aktif !== false,
                idx: idx
            });
        });
    }

    // Filter by student if selected
    const displaySchedules = selectedStudentId === 'all'
        ? allSchedules
        : allSchedules.filter(s => s.studentId === selectedStudentId);

    // Summary Metrics
    const totalWeeklyLessons = displaySchedules.length;
    const todayLessonsCount = displaySchedules.filter(s => s.gun === todayName).length;
    const scheduledStudentsCount = new Set(displaySchedules.map(s => s.studentId)).size;
    const emptyDaysCount = gunler.filter(g => displaySchedules.filter(s => s.gun === g).length === 0).length;

    // Build Desktop / Tablet Day Columns
    const dayColumnsHtml = gunler.map(gun => {
        const isToday = gun === todayName;
        const dayLessons = displaySchedules
            .filter(l => l.gun === gun)
            .sort((a, b) => (a.saat || "").localeCompare(b.saat || ""));

        let dayCardsHtml = '';
        if (dayLessons.length === 0) {
            dayCardsHtml = `
                <div class="flex-1 flex items-center justify-center py-3 text-center text-gray-400 dark:text-gray-500">
                    <span class="text-[11px] font-medium">0 ders</span>
                </div>
            `;
        } else {
            dayCardsHtml = dayLessons.map(les => {
                const branchTagClasses = getScheduleBranchTagClasses(les.rawDers || les.dersAdi);
                const gradeBadgeClasses = getScheduleGradeBadgeClasses(les.sinif);
                const branchLabel = getScheduleBranchShortLabel(les.dersAdi);
                return `
                    <div onclick="editScheduleLesson('${les.studentId}', ${les.idx})" class="group cursor-pointer bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200/90 dark:border-gray-700/80 shadow-2xs hover:shadow-xs hover:border-blue-300 dark:hover:border-blue-500 transition relative">
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-[11px] font-black text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-750 px-1.5 py-0.5 rounded">
                                ${escapeHtml(les.saat)}
                            </span>
                            <div class="flex items-center -mr-1" onclick="event.stopPropagation()">
                                <button onclick="event.stopPropagation(); editScheduleLesson('${les.studentId}', ${les.idx})" class="p-1 min-w-[32px] min-h-[32px] sm:min-w-[28px] sm:min-h-[28px] inline-flex items-center justify-center text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition" title="Düzenle" aria-label="Düzenle">
                                    <i class="fas fa-edit text-xs"></i>
                                </button>
                                <button onclick="event.stopPropagation(); deleteScheduleLesson('${les.studentId}', ${les.idx})" class="p-1 min-w-[32px] min-h-[32px] sm:min-w-[28px] sm:min-h-[28px] inline-flex items-center justify-center text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition" title="Sil" aria-label="Sil">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                </button>
                            </div>
                        </div>
                        <div class="font-bold text-xs text-gray-900 dark:text-gray-100 truncate mt-0.5" title="${escapeHtml(les.studentName)}">
                            ${escapeHtml(les.studentName)}
                        </div>
                        <div class="flex flex-wrap items-center gap-1 mt-1.5">
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${branchTagClasses}">
                                ${escapeHtml(branchLabel)}
                            </span>
                            ${les.sinif ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeBadgeClasses}">${escapeHtml(les.sinif)}. Sınıf</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="cf-day-column flex flex-col rounded-xl border transition min-w-0 ${isToday ? 'border-blue-400/80 dark:border-blue-500/80 bg-blue-50/15 dark:bg-blue-950/15 shadow-xs ring-1 ring-blue-300 dark:ring-blue-700' : 'border-gray-200 dark:border-gray-700/80 bg-gray-50/40 dark:bg-gray-850/40'}">
                <div class="flex items-center justify-between px-2.5 py-2 border-b ${isToday ? 'border-blue-100 dark:border-blue-900/50 bg-blue-100/50 dark:bg-blue-900/30 rounded-t-xl' : 'border-gray-200/80 dark:border-gray-700/60'}">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="font-black text-xs text-gray-850 dark:text-gray-100 truncate">${gun}</span>
                        ${isToday ? '<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-600 text-white flex-shrink-0">Bugün</span>' : ''}
                    </div>
                    <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex-shrink-0 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200/60 dark:border-gray-700/60">${dayLessons.length}</span>
                </div>
                <div class="p-2 flex-1 flex flex-col gap-1.5 min-h-[52px]">
                    ${dayCardsHtml}
                </div>
            </div>
        `;
    }).join('');

    // Build Mobile Day Tabs & Selected Day Cards (390px Viewport)
    const mobileTabsHtml = gunler.map(g => {
        const count = displaySchedules.filter(l => l.gun === g).length;
        const isAct = g === activeDay;
        const isTod = g === todayName;
        return `
            <button onclick="setScheduleActiveDay('${g}')" class="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 min-h-[44px] ${isAct ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}">
                <span>${g.slice(0, 3)}</span>
                ${isTod ? '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>' : ''}
                ${count > 0 ? `<span class="px-1.5 py-0.5 rounded-full text-xs ${isAct ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'} font-bold">${count}</span>` : ''}
            </button>
        `;
    }).join('');

    const activeDayLessons = displaySchedules
        .filter(l => l.gun === activeDay)
        .sort((a, b) => (a.saat || "").localeCompare(b.saat || ""));

    let mobileDayCardsHtml = '';
    if (activeDayLessons.length === 0) {
        mobileDayCardsHtml = `
            <div class="py-6 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4">
                <p class="font-bold text-xs text-gray-700 dark:text-gray-300">${activeDay} günü planlı ders yok</p>
            </div>
        `;
    } else {
        mobileDayCardsHtml = activeDayLessons.map(les => {
            const branchTagClasses = getScheduleBranchTagClasses(les.rawDers || les.dersAdi);
            const gradeBadgeClasses = getScheduleGradeBadgeClasses(les.sinif);
            const branchLabel = getScheduleBranchShortLabel(les.dersAdi);
            return `
                <div onclick="editScheduleLesson('${les.studentId}', ${les.idx})" class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200/90 dark:border-gray-700/80 shadow-2xs active:scale-[0.99] transition">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-xs font-black text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-750 px-2 py-0.5 rounded">
                            ${escapeHtml(les.saat)}
                        </span>
                        <div class="flex items-center gap-1 -mr-1" onclick="event.stopPropagation()">
                            <button onclick="event.stopPropagation(); editScheduleLesson('${les.studentId}', ${les.idx})" class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Düzenle" aria-label="Düzenle">
                                <i class="fas fa-edit text-sm"></i>
                            </button>
                            <button onclick="event.stopPropagation(); deleteScheduleLesson('${les.studentId}', ${les.idx})" class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Sil" aria-label="Sil">
                                <i class="fas fa-trash-alt text-sm"></i>
                            </button>
                        </div>
                    </div>
                    <div class="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                        ${escapeHtml(les.studentName)}
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 mt-2">
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded ${branchTagClasses}">
                            ${escapeHtml(branchLabel)}
                        </span>
                        ${les.sinif ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded ${gradeBadgeClasses}">${escapeHtml(les.sinif)}. Sınıf</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    const html = `
        <div class="app-page">
            <!-- Page Header -->
            <header class="app-page-header">
                <div>
                    <h2 class="app-page-title">Ders Programı</h2>
                    <p class="app-page-subtitle">Haftalık ders çizelgesi ve program yoğunluğu</p>
                </div>
            </header>
            ${renderDerslerTabBarHtml('schedule')}

            <!-- Compact Summary Bar -->
            <div id="schedule-compact-summary" class="app-panel py-2.5 px-4 mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span class="inline-flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                        <span class="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                        <span><strong class="font-black text-blue-600 dark:text-blue-400 text-sm">${totalWeeklyLessons}</strong> Ders</span>
                    </span>
                    <span class="text-gray-300 dark:text-gray-600">·</span>
                    <span class="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        <strong class="font-black text-gray-900 dark:text-gray-100 text-sm">${scheduledStudentsCount}</strong> Öğrenci
                    </span>
                    <span class="text-gray-300 dark:text-gray-600">·</span>
                    <span class="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        Bugün <strong class="font-black ${todayLessonsCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'} text-sm">${todayLessonsCount}</strong> Ders
                    </span>
                    <span class="text-gray-300 dark:text-gray-600">·</span>
                    <span class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
                        ${emptyDaysCount} Boş Gün
                    </span>
                </div>
            </div>

            <!-- Schedule Board Main Panel -->
            <div class="app-panel p-4 md:p-5">
                <!-- Toolbar & Filters -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-200/80 dark:border-gray-700/80">
                    <div class="min-w-0">
                        <h3 class="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Haftalık Çizelge</span>
                            ${selectedStudentId !== 'all' ? `<span class="text-xs font-bold text-gray-400 dark:text-gray-500 truncate">(${escapeHtml(students.find(s => s.id === selectedStudentId)?.adSoyad || '')})</span>` : ''}
                        </h3>
                    </div>
                    <div class="flex items-center gap-2.5 w-full lg:w-auto min-w-0">
                        <div class="flex-1 lg:flex-initial min-w-0">
                            <select id="scheduleStudentSelect" class="student-form-input text-xs font-bold py-2 px-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-xl w-full lg:w-auto min-h-[44px]">
                                <option value="all" ${selectedStudentId === 'all' ? 'selected' : ''}>Tüm Öğrenciler</option>
                                ${students.map(s => `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>${escapeHtml(s.adSoyad)}</option>`).join('')}
                            </select>
                        </div>
                        <button onclick="showAddScheduleModal('${selectedStudentId === 'all' ? (students[0]?.id || '') : selectedStudentId}')" class="btn-primary px-3.5 py-2 text-xs flex items-center justify-center gap-1.5 min-h-[44px] flex-shrink-0 shadow-sm rounded-xl">
                            <i class="fas fa-plus-circle"></i> <span>Ders Ekle</span>
                        </button>
                    </div>
                </div>

                ${totalWeeklyLessons === 0 ? `
                    <div class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-850/80 border border-gray-200 dark:border-gray-700/80 rounded-xl p-3 mb-3 text-center">
                        Bu hafta planlanmış ders yok.
                    </div>
                ` : ''}

                <!-- Desktop / Tablet Day Columns Board -->
                <div class="hidden md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-start">
                    ${dayColumnsHtml}
                </div>

                <!-- Mobile View (Day Tabs & Cards) -->
                <div class="block md:hidden">
                    <div class="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3 scrollbar-none">
                        ${mobileTabsHtml}
                    </div>
                    <div class="flex items-center justify-between mb-2.5 px-1">
                        <span class="font-black text-sm text-gray-800 dark:text-gray-200">${activeDay}</span>
                        <span class="text-xs font-bold text-blue-600 dark:text-blue-400">${activeDayLessons.length} Ders</span>
                    </div>
                    <div class="space-y-2.5">
                        ${mobileDayCardsHtml}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById("dynamic-content").innerHTML = html;

    const selectEl = document.getElementById("scheduleStudentSelect");
    if (selectEl) {
        selectEl.addEventListener("change", (e) => {
            window._scheduleSelectedStudentId = e.target.value;
            renderSchedulePage();
        });
    }
}

export function setScheduleActiveDay(day) {
    window._activeScheduleDay = day;
    renderSchedulePage();
}

export function showAddScheduleModal(studentId, defaultDay = "Pazartesi") {
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    const students = loadStudentsData();
    const activeStudentId = studentId || (students[0]?.id || "");
    const student = students.find(s => s.id === activeStudentId) || students[0];
    const is8thGrade = student && (String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)")));
    const saatler = [];
    for (let h = 7; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            saatler.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }

    const modalHtml = `
        <div id="addScheduleModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onclick="if(event.target===this) closeAddScheduleModal()">
            <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between border-b dark:border-gray-700 pb-3 mb-4">
                    <h2 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <i class="fas fa-calendar-plus text-blue-600 dark:text-blue-400"></i> Yeni Ders Ekle
                    </h2>
                    <button onclick="closeAddScheduleModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Öğrenci</label>
                        <select id="modalScheduleStudentId" class="student-form-input min-h-[44px]">
                            ${students.map(s => `<option value="${s.id}" ${s.id === activeStudentId ? 'selected' : ''}>${escapeHtml(s.adSoyad)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Gün</label>
                            <select id="modalScheduleDay" class="student-form-input min-h-[44px]">
                                ${gunler.map(g => `<option value="${g}" ${g === defaultDay ? 'selected' : ''}>${g}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Saat</label>
                            <select id="modalScheduleTime" class="student-form-input min-h-[44px]">
                                ${saatler.map(s => `<option value="${s}">${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ders / Branş</label>
                        <select id="modalScheduleLessonName" class="student-form-input min-h-[44px]">
                            ${(store.teacherBranches || ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"]).map(b => {
                                const displayName = (is8thGrade && b === "Sosyal Bilgiler") ? "İnkılap Tarihi" : b;
                                return `<option value="${b}">${displayName}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="flex gap-2 pt-2">
                        <button onclick="addScheduleFromModal()" class="btn-primary flex-1 py-3 min-h-[44px] text-xs font-bold shadow-md">Dersi Programa Ekle</button>
                        <button onclick="closeAddScheduleModal()" class="border border-gray-300 dark:border-gray-600 px-4 py-3 rounded-xl font-bold text-xs min-h-[44px] text-gray-700 dark:text-gray-300">İptal</button>
                    </div>
                </div>
            </div>
        </div>`;
    const existing = document.getElementById('addScheduleModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'addScheduleModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

export function closeAddScheduleModal() {
    document.getElementById('addScheduleModal')?.remove();
}

export function addScheduleFromModal(explicitStudentId) {
    const studentSelect = document.getElementById('modalScheduleStudentId');
    const studentId = explicitStudentId || (studentSelect ? studentSelect.value : (loadStudentsData()[0]?.id || ""));
    const gun = document.getElementById('modalScheduleDay')?.value;
    const saat = document.getElementById('modalScheduleTime')?.value;
    const dersAdi = document.getElementById('modalScheduleLessonName')?.value.trim();
    if (!dersAdi) {
        alert("Ders adı giriniz");
        return;
    }
    const lessons = loadSchedule(studentId);
    const students = loadStudentsData();
    const conflict = findScheduleConflict({
        studentId,
        day: gun,
        time: saat,
        students,
        schedulesByStudent: getAllSchedulesByStudent(students)
    });
    if (conflict) {
        alert(buildScheduleConflictMessage(conflict, gun, saat));
        return;
    }
    lessons.push({ gun, saat, dersAdi });
    saveSchedule(studentId, lessons);
    closeAddScheduleModal();
    renderSchedulePage();
}

export function showEditScheduleModal(studentId, lessonIdx) {
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const lessons = loadSchedule(studentId);
    const les = lessons[lessonIdx];
    if (!les) return;
    const is8thGrade = String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)"));

    const saatler = [];
    for (let h = 7; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            saatler.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }

    const modalHtml = `
        <div id="editScheduleModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onclick="if(event.target===this) closeEditScheduleModal()">
            <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between border-b dark:border-gray-700 pb-3 mb-4">
                    <div>
                        <h2 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <i class="fas fa-edit text-blue-600 dark:text-blue-400"></i> Dersi Düzenle
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400 font-bold">${escapeHtml(student.adSoyad)}</p>
                    </div>
                    <button onclick="closeEditScheduleModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Gün</label>
                            <select id="editModalScheduleDay" class="student-form-input min-h-[44px]">
                                ${gunler.map(g => `<option value="${g}" ${g === les.gun ? 'selected' : ''}>${g}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Saat</label>
                            <select id="editModalScheduleTime" class="student-form-input min-h-[44px]">
                                ${saatler.map(s => `<option value="${s}">${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ders / Branş</label>
                        <select id="editModalScheduleLessonName" class="student-form-input min-h-[44px]">
                            ${(store.teacherBranches || ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"]).map(b => {
                                const displayName = (is8thGrade && b === "Sosyal Bilgiler") ? "İnkılap Tarihi" : b;
                                return `<option value="${b}" ${(b === les.dersAdi || displayName === les.dersAdi) ? 'selected' : ''}>${displayName}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="flex gap-2 pt-2">
                        <button onclick="saveEditedScheduleLesson('${studentId}', ${lessonIdx})" class="btn-primary flex-1 py-3 min-h-[44px] text-xs font-bold shadow-md">Kaydet</button>
                        <button onclick="deleteScheduleLesson('${studentId}', ${lessonIdx}); closeEditScheduleModal();" class="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl font-bold text-xs min-h-[44px] hover:bg-red-50 dark:hover:bg-red-950/30">Dersi Sil</button>
                        <button onclick="closeEditScheduleModal()" class="border border-gray-300 dark:border-gray-600 px-4 py-3 rounded-xl font-bold text-xs min-h-[44px] text-gray-700 dark:text-gray-300">İptal</button>
                    </div>
                </div>
            </div>
        </div>`;
    const existing = document.getElementById('editScheduleModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'editScheduleModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

export function closeEditScheduleModal() {
    document.getElementById('editScheduleModal')?.remove();
}

export function saveEditedScheduleLesson(studentId, idx) {
    const gun = document.getElementById('editModalScheduleDay')?.value;
    const saat = document.getElementById('editModalScheduleTime')?.value;
    const dersAdi = document.getElementById('editModalScheduleLessonName')?.value.trim();
    if (!gun || !saat || !dersAdi) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }
    const students = loadStudentsData();
    const lessons = loadSchedule(studentId);
    const conflict = findScheduleConflict({
        studentId,
        day: gun,
        time: saat,
        students,
        schedulesByStudent: getAllSchedulesByStudent(students),
        ignoreLessonIndex: idx
    });
    if (conflict) {
        alert(buildScheduleConflictMessage(conflict, gun, saat));
        return;
    }
    lessons[idx] = { ...lessons[idx], gun, saat, dersAdi };
    saveSchedule(studentId, lessons);
    closeEditScheduleModal();
    renderSchedulePage();
}

export function editScheduleLesson(studentIdOrIdx, maybeIdx) {
    if (typeof studentIdOrIdx === 'number') {
        const students = loadStudentsData();
        const studentId = window._scheduleSelectedStudentId && window._scheduleSelectedStudentId !== 'all'
            ? window._scheduleSelectedStudentId
            : (students[0]?.id || "");
        showEditScheduleModal(studentId, studentIdOrIdx);
    } else {
        showEditScheduleModal(studentIdOrIdx, maybeIdx);
    }
}

export function deleteScheduleLesson(studentIdOrIdx, maybeIdx) {
    let studentId;
    let idx;
    if (typeof studentIdOrIdx === 'number') {
        const students = loadStudentsData();
        studentId = window._scheduleSelectedStudentId && window._scheduleSelectedStudentId !== 'all'
            ? window._scheduleSelectedStudentId
            : (students[0]?.id || "");
        idx = studentIdOrIdx;
    } else {
        studentId = studentIdOrIdx;
        idx = maybeIdx;
    }
    if (confirm("Bu dersi programdan silmek istediğinize emin misiniz?")) {
        const lessons = loadSchedule(studentId);
        lessons.splice(idx, 1);
        saveSchedule(studentId, lessons);
        renderSchedulePage();
    }
}

export function setScheduleViewMode() {
    renderSchedulePage();
}

// Bind to window for global accessibility
window.renderSchedulePage = renderSchedulePage;
window.showAddScheduleModal = showAddScheduleModal;
window.closeAddScheduleModal = closeAddScheduleModal;
window.addScheduleFromModal = addScheduleFromModal;
window.showEditScheduleModal = showEditScheduleModal;
window.closeEditScheduleModal = closeEditScheduleModal;
window.saveEditedScheduleLesson = saveEditedScheduleLesson;
window.editScheduleLesson = editScheduleLesson;
window.deleteScheduleLesson = deleteScheduleLesson;
window.setScheduleActiveDay = setScheduleActiveDay;
window.setScheduleViewMode = setScheduleViewMode;
window.getScheduleBranchTagClasses = getScheduleBranchTagClasses;
window.getScheduleGradeBadgeClasses = getScheduleGradeBadgeClasses;
window.getScheduleBranchShortLabel = getScheduleBranchShortLabel;
