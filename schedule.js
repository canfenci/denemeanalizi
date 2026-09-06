// ==================== WEEKLY LESSON SCHEDULE MODÜLÜ ====================

import { store, loadStudentsData, loadSchedule, saveSchedule, escapeHtml } from './store.js';
import { updateMobileNavActive } from './auth.js';
import { buildScheduleConflictMessage, findScheduleConflict } from './schedule-conflicts.js';

export function getAllSchedulesByStudent(students) {
    return Object.fromEntries(students.map(student => [student.id, loadSchedule(student.id)]));
}

function getTurkishTodayName() {
    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    return days[new Date().getDay()];
}

export function renderSchedulePage() {
    store.currentPage = "schedule";
    updateMobileNavActive('mobile-nav-schedule');
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
                <div class="flex-1 flex flex-col items-center justify-center py-8 text-center text-gray-400 dark:text-gray-500">
                    <i class="fas fa-calendar-minus text-lg opacity-40 mb-1.5"></i>
                    <span class="text-xs font-medium">Ders planlanmadı</span>
                </div>
            `;
        } else {
            dayCardsHtml = dayLessons.map(les => {
                return `
                    <div onclick="editScheduleLesson('${les.studentId}', ${les.idx})" class="group cursor-pointer bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition border-l-4 border-l-blue-600 relative">
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-xs font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                                ${escapeHtml(les.saat)}
                            </span>
                            <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition" onclick="event.stopPropagation()">
                                <button onclick="editScheduleLesson('${les.studentId}', ${les.idx})" class="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition" title="Düzenle" aria-label="Düzenle">
                                    <i class="fas fa-edit text-xs"></i>
                                </button>
                                <button onclick="deleteScheduleLesson('${les.studentId}', ${les.idx})" class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition" title="Sil" aria-label="Sil">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                </button>
                            </div>
                        </div>
                        <div class="font-bold text-sm text-gray-900 dark:text-gray-100 truncate mt-1">
                            ${escapeHtml(les.studentName)}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between mt-1 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                            <span class="truncate font-medium">${escapeHtml(les.dersAdi)}</span>
                            ${les.sinif ? `<span class="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1 whitespace-nowrap">${escapeHtml(les.sinif)}. Sınıf</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="cf-day-column flex flex-col rounded-2xl border transition min-w-0 ${isToday ? 'border-blue-400/80 dark:border-blue-500/80 bg-blue-50/20 dark:bg-blue-950/15 shadow-sm ring-1 ring-blue-300 dark:ring-blue-700' : 'border-gray-200 dark:border-gray-700/80 bg-gray-50/40 dark:bg-gray-850/40'}">
                <div class="flex items-center justify-between p-3 border-b ${isToday ? 'border-blue-100 dark:border-blue-900/50 bg-blue-100/50 dark:bg-blue-900/30 rounded-t-2xl' : 'border-gray-200/80 dark:border-gray-700/60'}">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="font-black text-sm text-gray-850 dark:text-gray-100 truncate">${gun}</span>
                        ${isToday ? '<span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white flex-shrink-0">Bugün</span>' : ''}
                    </div>
                    <span class="text-xs font-bold text-gray-500 dark:text-gray-400 flex-shrink-0 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded-md border border-gray-200/60 dark:border-gray-700/60">${dayLessons.length}</span>
                </div>
                <div class="p-2.5 flex-1 flex flex-col gap-2 min-h-[140px]">
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
            <div class="py-10 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <i class="fas fa-calendar-day text-2xl opacity-40 mb-2"></i>
                <p class="font-bold text-sm text-gray-700 dark:text-gray-300">${activeDay} günü planlı ders yok</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Yeni bir ders eklemek için yukarıdaki Ders Ekle butonunu kullanabilirsiniz.</p>
            </div>
        `;
    } else {
        mobileDayCardsHtml = activeDayLessons.map(les => {
            return `
                <div onclick="editScheduleLesson('${les.studentId}', ${les.idx})" class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs active:scale-[0.99] transition border-l-4 border-l-blue-600">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg">
                            ${escapeHtml(les.saat)}
                        </span>
                        <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                            <button onclick="editScheduleLesson('${les.studentId}', ${les.idx})" class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Düzenle" aria-label="Düzenle">
                                <i class="fas fa-edit text-sm"></i>
                            </button>
                            <button onclick="deleteScheduleLesson('${les.studentId}', ${les.idx})" class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Sil" aria-label="Sil">
                                <i class="fas fa-trash-alt text-sm"></i>
                            </button>
                        </div>
                    </div>
                    <div class="font-black text-base text-gray-900 dark:text-gray-100">
                        ${escapeHtml(les.studentName)}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 font-semibold">
                        <span>${escapeHtml(les.dersAdi)}</span>
                        ${les.sinif ? `<span>${escapeHtml(les.sinif)}. Sınıf</span>` : ''}
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

            <!-- Headline Metrics Summary -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
                <div class="app-panel p-4 flex flex-col justify-between">
                    <span class="text-xs font-bold text-gray-500 dark:text-gray-400">Toplam Haftalık Ders</span>
                    <div class="flex items-baseline gap-2 mt-2">
                        <span class="text-2xl font-black text-blue-600 dark:text-blue-400">${totalWeeklyLessons}</span>
                        <span class="text-xs font-bold text-gray-400">Ders</span>
                    </div>
                </div>
                <div class="app-panel p-4 flex flex-col justify-between">
                    <span class="text-xs font-bold text-gray-500 dark:text-gray-400">Bugünkü Dersler</span>
                    <div class="flex items-baseline gap-2 mt-2">
                        <span class="text-2xl font-black text-blue-600 dark:text-blue-400">${todayLessonsCount}</span>
                        <span class="text-xs font-bold text-gray-400">${todayName}</span>
                    </div>
                </div>
                <div class="app-panel p-4 flex flex-col justify-between">
                    <span class="text-xs font-bold text-gray-500 dark:text-gray-400">Programlı Öğrenci</span>
                    <div class="flex items-baseline gap-2 mt-2">
                        <span class="text-2xl font-black text-blue-600 dark:text-blue-400">${scheduledStudentsCount}</span>
                        <span class="text-xs font-bold text-gray-400">Öğrenci</span>
                    </div>
                </div>
                <div class="app-panel p-4 flex flex-col justify-between">
                    <span class="text-xs font-bold text-gray-500 dark:text-gray-400">Boş Gün Sayısı</span>
                    <div class="flex items-baseline gap-2 mt-2">
                        <span class="text-2xl font-black text-blue-600 dark:text-blue-400">${emptyDaysCount}</span>
                        <span class="text-xs font-bold text-gray-400">Gün</span>
                    </div>
                </div>
            </div>

            <!-- Schedule Board Main Panel -->
            <div class="app-panel p-4 md:p-6">
                <!-- Toolbar & Filters -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-gray-200/80 dark:border-gray-700/80 pb-4">
                    <div>
                        <h3 class="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Haftalık Çizelge</span>
                            <span class="text-xs font-bold text-gray-400 dark:text-gray-500">(${selectedStudentId === 'all' ? 'Tüm Öğrenciler' : (students.find(s => s.id === selectedStudentId)?.adSoyad || '')})</span>
                        </h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Haftalık ders dağılımını gün kolonlarında inceleyin.</p>
                    </div>
                    <div class="flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto min-w-0">
                        <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 w-full lg:w-auto min-w-0">
                            <label class="text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap pl-1">Filtre:</label>
                            <select id="scheduleStudentSelect" class="student-form-input text-xs font-bold py-1 px-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg min-w-0" style="padding: 4px 10px !important;">
                                <option value="all" ${selectedStudentId === 'all' ? 'selected' : ''}>Tüm Öğrenciler (${allSchedules.length} Ders)</option>
                                ${students.map(s => {
                                    const c = allSchedules.filter(l => l.studentId === s.id).length;
                                    return `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>${escapeHtml(s.adSoyad)} (${c} Ders)</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <button onclick="showAddScheduleModal('${selectedStudentId === 'all' ? (students[0]?.id || '') : selectedStudentId}')" class="btn-primary px-4 py-2 text-xs flex items-center justify-center gap-1.5 min-h-[44px] w-full lg:w-auto shadow-sm">
                            <i class="fas fa-plus-circle"></i> Ders Ekle
                        </button>
                    </div>
                </div>

                <!-- Desktop / Tablet Day Columns Board -->
                <div class="hidden md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 items-start">
                    ${dayColumnsHtml}
                </div>

                <!-- Mobile View (Day Tabs & Cards) -->
                <div class="block md:hidden">
                    <div class="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 scrollbar-none">
                        ${mobileTabsHtml}
                    </div>
                    <div class="flex items-center justify-between mb-3 px-1">
                        <span class="font-black text-sm text-gray-800 dark:text-gray-200">${activeDay}</span>
                        <span class="text-xs font-bold text-blue-600 dark:text-blue-400">${activeDayLessons.length} Ders</span>
                    </div>
                    <div class="space-y-3">
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
