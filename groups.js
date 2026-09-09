// ==================== CLASS & GROUP MANAGEMENT MODULE ====================

console.log("DEBUG: groups.js is loading...");

import { store, loadGroupsData, saveGroupsData, deleteGroupData, loadStudentsData, getStudentOdevler, escapeHtml } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { updateMobileNavActive } from './auth.js';
import { getOrtalamaNet, lgsPuanHesapla } from './exams.js';
import { renderStudentsTabBarHtml } from './students.js';

export function renderGroupsPage() {
    try {
        console.log("DEBUG: renderGroupsPage() called");
        store.currentPage = "groups";
        if (window.currentPage) window.currentPage = "groups";
        
        // Set navbar title and highlight the active nav button under Students
        const titleEl = document.getElementById("appBarTitle");
        if (titleEl) titleEl.innerText = "Sınıf & Gruplar";
        updateMobileNavActive("mobile-nav-home");

        const groups = loadGroupsData() || [];
        const students = loadStudentsData() || [];

        let groupsHtml = '';
        if (groups.length === 0) {
            groupsHtml = `
                <div class="app-panel col-span-full flex flex-col items-center justify-center p-8 text-center">
                    <div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                        <i class="fas fa-users text-2xl"></i>
                    </div>
                    <h3 class="text-base font-bold text-gray-850 dark:text-white mb-1">Henüz Sınıf veya Grup Bulunmuyor</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-450 max-w-sm mb-4">
                        Öğrencilerinizi toplu olarak yönetmek, ortak ödev atamak ve grup içi başarı sıralamasını görmek için ilk grubunuzu oluşturun.
                    </p>
                    <button onclick="showCreateGroupModal()" class="btn-primary px-5 py-2.5 text-xs flex items-center gap-1.5 min-h-[44px]">
                        <i class="fas fa-plus"></i> Yeni Grup Oluştur
                    </button>
                </div>
            `;
        } else {
            groupsHtml = groups.map(group => {
                const memberIds = group.studentIds || [];
                const members = students.filter(s => s && memberIds.includes(s.id));
                
                // Calculate group LGS average (if LGS class)
                const lgsScores = members.map(s => {
                    const genelExams = (s.denemeler || []).filter(d => d && d.tip === "genel");
                    return lgsPuanHesapla(genelExams);
                }).filter(score => score !== null);
                const avgLgs = lgsScores.length > 0 ? Math.round(lgsScores.reduce((a, b) => a + b, 0) / lgsScores.length) : null;

                // Generate initials badges for members preview (limit to 5)
                const badgesHtml = members.slice(0, 5).map(m => {
                    const name = m.adSoyad || "";
                    const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return `
                        <div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs font-bold border border-white dark:border-gray-800 shadow-sm" title="${escapeHtml(m.adSoyad)}">
                            ${initials}
                        </div>
                    `;
                }).join('');

                const extraCount = members.length > 5 ? `
                    <div class="w-8 h-8 rounded-full bg-gray-150 dark:bg-gray-700 text-gray-650 dark:text-gray-300 flex items-center justify-center text-xs font-bold border border-white dark:border-gray-800 shadow-sm">
                        +${members.length - 5}
                    </div>
                ` : '';

                return `
                    <div class="bg-white dark:bg-gray-805 rounded-2xl p-5 border border-gray-150 dark:border-gray-700/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
                        <div>
                            <div class="flex justify-between items-start mb-3 pl-2">
                                <div>
                                    <h3 class="text-base font-bold text-gray-850 dark:text-white group-hover:text-purple-605 dark:group-hover:text-purple-400 transition-colors">${escapeHtml(group.name)}</h3>
                                    <span class="text-xs text-gray-500 mt-0.5 block font-medium"><i class="fas fa-user-friends mr-1"></i> ${members.length} Öğrenci</span>
                                </div>
                                <div class="flex gap-1.5">
                                    <button onclick="showCreateGroupModal('${group.id}')" class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition" title="Grubu Düzenle">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteGroup('${group.id}')" class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition" title="Grubu Sil">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="flex items-center gap-1 mb-4 pl-2">
                                ${badgesHtml}
                                ${extraCount}
                                ${members.length === 0 ? '<span class="text-xs text-gray-400 italic">Üye bulunmuyor</span>' : ''}
                            </div>

                            ${avgLgs ? `
                                <div class="bg-indigo-50/50 dark:bg-indigo-950/10 rounded-xl p-3 mb-4 flex items-center justify-between border border-indigo-100/30">
                                    <span class="text-xs font-semibold text-gray-550 dark:text-gray-400"><i class="fas fa-graduation-cap text-indigo-500 mr-1"></i> Grup LGS Puan Ortalaması</span>
                                    <span class="text-sm font-bold text-indigo-650 dark:text-indigo-400">${avgLgs} / 500</span>
                                </div>
                            ` : ''}
                        </div>

                        <div class="grid grid-cols-2 gap-2 mt-2">
                            <button onclick="showGroupLeaderboard('${group.id}')" class="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1 min-h-[40px]">
                                <i class="fas fa-trophy"></i> Liderlik Tablosu
                            </button>
                            <button onclick="showGroupOdevAtaModal('${group.id}')" class="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1 min-h-[40px]">
                                <i class="fas fa-tasks"></i> Ödev Ata
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const html = `
            <div class="app-page">
                <header class="app-page-header">
                    <div>
                        <h2 class="app-page-title">Sınıf & Gruplar</h2>
                        <p class="app-page-subtitle">
                            Grup oluşturup üyeleri ekleyebilir, liderlik panosunu izleyebilir ve tüm gruba tek tıklamayla ödev tanımlayabilirsiniz.
                        </p>
                    </div>
                    <div>
                        <button onclick="showCreateGroupModal()" class="btn-primary w-full sm:w-auto px-5 py-2.5 text-xs flex items-center justify-center gap-1.5 min-h-[44px]">
                            <i class="fas fa-plus"></i> Yeni Grup Oluştur
                        </button>
                    </div>
                </header>
                ${renderStudentsTabBarHtml('groups')}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${groupsHtml}
                </div>
            </div>
        `;

        document.getElementById("dynamic-content").innerHTML = html;
    } catch (err) {
        console.error("DEBUG ERROR inside renderGroupsPage:", err);
        alert("Sınıf & Gruplar sayfası yüklenirken bir hata oluştu: " + err.message);
    }
}

export function showCreateGroupModal(groupId = null) {
    try {
        console.log("DEBUG: showCreateGroupModal() called, groupId:", groupId);
        const students = loadStudentsData() || [];
        const groups = loadGroupsData() || [];
        const targetGroup = groupId ? groups.find(g => g.id === groupId) : null;
        
        // Sort students by name
        const sortedStudents = [...students].sort((a, b) => (a.adSoyad || "").localeCompare(b.adSoyad || ""));

        const selectedIds = targetGroup ? (targetGroup.studentIds || []) : [];

        // Group students by sinif level
        const studentsByGrade = { "5": [], "6": [], "7": [], "8": [] };
        sortedStudents.forEach(s => {
            if (!s) return;
            const gr = s.sinif || "8";
            if (studentsByGrade[gr]) studentsByGrade[gr].push(s);
            else studentsByGrade["8"].push(s);
        });

        let gradesHtml = '';
        Object.keys(studentsByGrade).forEach(grade => {
            const list = studentsByGrade[grade];
            if (list.length === 0) return;
            
            const checkboxesHtml = list.map(s => {
                if (!s) return '';
                const isChecked = selectedIds.includes(s.id) ? 'checked' : '';
                return `
                    <label class="flex items-center gap-2.5 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition border border-gray-100 dark:border-gray-800 text-sm group-search-item" data-name="${escapeHtml(s.adSoyad).toLowerCase()}">
                        <input type="checkbox" value="${s.id}" ${isChecked} class="groupStudentCheck rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 w-4 h-4">
                        <span class="font-medium text-gray-800 dark:text-gray-255">${escapeHtml(s.adSoyad)}</span>
                    </label>
                `;
            }).join('');

            gradesHtml += `
                <div class="space-y-2">
                    <h4 class="text-xs font-bold text-purple-650 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                        <i class="fas fa-graduation-cap"></i> ${grade}. Sınıf Öğrencileri
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${checkboxesHtml}
                    </div>
                </div>
            `;
        });

        if (!gradesHtml) {
            gradesHtml = `<p class="text-xs text-gray-500 italic text-center py-4">Kayıtlı öğrenci bulunmuyor. Öncelikle öğrenci ekleyin.</p>`;
        }

        const modalHtml = `
            <div id="createGroupModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onclick="if(event.target===this) closeCreateGroupModal()">
                <div class="bg-white dark:bg-gray-855 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col justify-between" onclick="event.stopPropagation()">
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-extrabold text-gray-850 dark:text-white flex items-center gap-2">
                                <i class="fas fa-users-cog text-purple-500"></i> ${targetGroup ? 'Grubu Düzenle' : 'Yeni Grup & Sınıf Oluştur'}
                            </h2>
                            <button onclick="closeCreateGroupModal()" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"><i class="fas fa-times text-xl"></i></button>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Grup Adı</label>
                                <input type="text" id="groupNameInput" value="${targetGroup ? escapeHtml(targetGroup.name) : ''}" placeholder="Örn: A Grubu, LGS Sözel Sınıfı" class="student-form-input min-h-[44px]">
                            </div>

                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Öğrenci Seçimi</label>
                                    <div class="relative w-44">
                                        <input type="text" id="groupStudentSearch" oninput="filterGroupStudents(this.value)" placeholder="Öğrenci Ara..." class="w-full text-xs px-2.5 py-1.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500">
                                        <i class="fas fa-search absolute right-2.5 top-2.5 text-gray-400 text-[10px]"></i>
                                    </div>
                                </div>

                                <div class="space-y-4 max-h-[40vh] overflow-y-auto border border-gray-150 dark:border-gray-750 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/10">
                                    ${gradesHtml}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-150 dark:border-gray-750">
                        <button onclick="closeCreateGroupModal()" class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-355 rounded-xl font-semibold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition min-h-[40px]">
                            İptal
                        </button>
                        <button onclick="saveGroup(${targetGroup ? `'${targetGroup.id}'` : 'null'})" class="px-5 py-2 bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-750 hover:to-indigo-750 text-white rounded-xl font-bold text-xs shadow-md transition min-h-[40px]">
                            💾 Kaydet
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('createGroupModal')?.remove();
        const div = document.createElement('div');
        div.id = 'createGroupModal';
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
    } catch (err) {
        console.error("DEBUG ERROR inside showCreateGroupModal:", err);
        alert("Grup oluşturma penceresi açılırken hata oluştu: " + err.message);
    }
}

export function closeCreateGroupModal() {
    document.getElementById('createGroupModal')?.remove();
}

window.filterGroupStudents = function(query) {
    const q = (query || "").toLowerCase().trim();
    document.querySelectorAll('.group-search-item').forEach(item => {
        const name = item.getAttribute('data-name') || '';
        if (!q || name.includes(q)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
};

export function saveGroup(groupId = null) {
    try {
        console.log("DEBUG: saveGroup() called, groupId:", groupId);
        const name = document.getElementById('groupNameInput').value.trim();
        if (!name) {
            alert("Lütfen bir grup adı girin.");
            return;
        }

        const checkboxes = document.querySelectorAll('.groupStudentCheck:checked');
        const studentIds = Array.from(checkboxes).map(cb => cb.value);

        const groups = loadGroupsData() || [];

        if (groupId) {
            // Edit mode
            const idx = groups.findIndex(g => g.id === groupId);
            if (idx !== -1) {
                groups[idx].name = name;
                groups[idx].studentIds = studentIds;
            }
        } else {
            // Create mode
            const newGroup = {
                id: "group_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                name: name,
                studentIds: studentIds
            };
            groups.push(newGroup);
        }

        saveGroupsData(groups);
        closeCreateGroupModal();
        renderGroupsPage();
        showSyncStatus("✅ Grup başarıyla kaydedildi", false);
    } catch (err) {
        console.error("DEBUG ERROR inside saveGroup:", err);
        alert("Grup kaydedilirken hata oluştu: " + err.message);
    }
}

export function deleteGroup(groupId) {
    try {
        console.log("DEBUG: deleteGroup() called, groupId:", groupId);
        if (!confirm("Bu sınıf/grubu silmek istediğinize emin misiniz? Öğrencileriniz silinmez, sadece grup dağıtılır.")) return;
        deleteGroupData(groupId);
        renderGroupsPage();
        showSyncStatus("🗑️ Grup silindi", false);
    } catch (err) {
        console.error("DEBUG ERROR inside deleteGroup:", err);
        alert("Grup silinirken hata oluştu: " + err.message);
    }
}

export function showGroupLeaderboard(groupId, sortBy = 'lgs') {
    try {
        console.log("DEBUG: showGroupLeaderboard() called, groupId:", groupId, "sortBy:", sortBy);
        const groups = loadGroupsData() || [];
        const students = loadStudentsData() || [];
        const targetGroup = groups.find(g => g.id === groupId);
        if (!targetGroup) return;

        const memberIds = targetGroup.studentIds || [];
        const members = students.filter(s => s && memberIds.includes(s.id));

        if (members.length === 0) {
            alert("Liderlik tablosunu görmek için bu gruba öğrenci eklemeniz gerekir.");
            return;
        }

        // Compile leaderboard stats for each member
        const leaderboardData = members.map(s => {
            const totalSolved = (s.growthPlan?.logs || []).reduce((sum, l) => sum + (parseInt(l.count) || 0), 0);
            const homeworks = getStudentOdevler(s) || [];
            const completedHw = homeworks.filter(o => o && o.durum === 'tamamlandi').length;
            const totalHw = homeworks.length;
            const avgNet = getOrtalamaNet(s) || 0;
            
            const genelExams = (s.denemeler || []).filter(d => d && d.tip === "genel");
            const lgsScore = lgsPuanHesapla(genelExams);

            return {
                id: s.id,
                name: s.adSoyad || "",
                lgsScore: lgsScore !== null ? lgsScore : 0,
                avgNet: avgNet,
                totalSolved: totalSolved,
                completedHw: completedHw,
                totalHw: totalHw,
                hwRatio: totalHw > 0 ? parseFloat((completedHw / totalHw).toFixed(2)) : 0
            };
        });

        // Sort accordingly
        if (sortBy === 'lgs') {
            leaderboardData.sort((a, b) => b.lgsScore - a.lgsScore);
        } else if (sortBy === 'net') {
            leaderboardData.sort((a, b) => b.avgNet - a.avgNet);
        } else if (sortBy === 'questions') {
            leaderboardData.sort((a, b) => b.totalSolved - a.totalSolved);
        } else if (sortBy === 'homework') {
            leaderboardData.sort((a, b) => b.hwRatio - a.hwRatio);
        }

        const tableRows = leaderboardData.map((data, index) => {
            let rankBadge = '';
            if (index === 0) {
                rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-xs font-extrabold animate-pulse">👑 1</span>`;
            } else if (index === 1) {
                rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-extrabold">🥈 2</span>`;
            } else if (index === 2) {
                rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-extrabold">🥉 3</span>`;
            } else {
                rankBadge = `<span class="text-sm font-bold text-gray-500">${index + 1}</span>`;
            }

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition border-b dark:border-gray-800 text-sm">
                    <td class="px-4 py-3 text-center">${rankBadge}</td>
                    <td class="px-4 py-3 font-bold text-gray-850 dark:text-gray-205">${escapeHtml(data.name)}</td>
                    <td class="px-4 py-3 text-center text-indigo-655 dark:text-indigo-400 font-extrabold">${data.lgsScore > 0 ? data.lgsScore : '—'}</td>
                    <td class="px-4 py-3 text-center font-bold text-blue-605 dark:text-blue-400">${data.avgNet}</td>
                    <td class="px-4 py-3 text-center text-emerald-650 dark:text-emerald-450 font-bold">${data.totalSolved}</td>
                    <td class="px-4 py-3 text-center text-purple-650 dark:text-purple-400 font-bold">${data.completedHw} / ${data.totalHw}</td>
                </tr>
            `;
        }).join('');

        const modalHtml = `
            <div id="leaderboardModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onclick="if(event.target===this) closeLeaderboardModal()">
                <div class="bg-white dark:bg-gray-850 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col justify-between" onclick="event.stopPropagation()">
                    <div>
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-lg font-extrabold text-gray-850 dark:text-white flex items-center gap-2">
                                    <i class="fas fa-trophy text-amber-500"></i> Liderlik Tablosu
                                </h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">
                                    "${escapeHtml(targetGroup.name)}" grubunun üyeleri arasında sıralamaları inceleyin.
                                </p>
                            </div>
                            <button onclick="closeLeaderboardModal()" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"><i class="fas fa-times text-xl"></i></button>
                        </div>

                        <!-- Sort Toggles -->
                        <div class="flex flex-wrap gap-2 mb-4 bg-gray-50 dark:bg-gray-900/30 p-1.5 rounded-2xl border dark:border-gray-800">
                            <button onclick="showGroupLeaderboard('${groupId}', 'lgs')" class="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${sortBy === 'lgs' ? 'bg-gradient-to-r from-purple-650 to-indigo-650 text-white shadow-md' : 'text-gray-600 dark:text-gray-350 hover:bg-gray-100 dark:hover:bg-gray-800'}">
                                <i class="fas fa-graduation-cap"></i> LGS Puanı
                            </button>
                            <button onclick="showGroupLeaderboard('${groupId}', 'net')" class="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${sortBy === 'net' ? 'bg-gradient-to-r from-purple-650 to-indigo-650 text-white shadow-md' : 'text-gray-600 dark:text-gray-350 hover:bg-gray-100 dark:hover:bg-gray-800'}">
                                <i class="fas fa-chart-line"></i> Ortalama Net
                            </button>
                            <button onclick="showGroupLeaderboard('${groupId}', 'questions')" class="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${sortBy === 'questions' ? 'bg-gradient-to-r from-purple-650 to-indigo-650 text-white shadow-md' : 'text-gray-600 dark:text-gray-350 hover:bg-gray-100 dark:hover:bg-gray-800'}">
                                <i class="fas fa-pencil-alt"></i> Çözülen Soru
                            </button>
                            <button onclick="showGroupLeaderboard('${groupId}', 'homework')" class="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${sortBy === 'homework' ? 'bg-gradient-to-r from-purple-650 to-indigo-650 text-white shadow-md' : 'text-gray-600 dark:text-gray-355 hover:bg-gray-100 dark:hover:bg-gray-800'}">
                                <i class="fas fa-tasks"></i> Ödev Performansı
                            </button>
                        </div>

                        <!-- Leaderboard Table -->
                        <div class="overflow-x-auto border dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900/10">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="bg-gray-50/50 dark:bg-gray-800/30 text-xs font-bold text-gray-550 dark:text-gray-400 border-b dark:border-gray-800 uppercase tracking-wider">
                                        <th class="px-4 py-3 text-center w-16">Sıra</th>
                                        <th class="px-4 py-3">Öğrenci</th>
                                        <th class="px-4 py-3 text-center w-24">Tahmini LGS</th>
                                        <th class="px-4 py-3 text-center w-24">Ort. Net</th>
                                        <th class="px-4 py-3 text-center w-28">Çözülen Soru</th>
                                        <th class="px-4 py-3 text-center w-32">Ödev Tamamlama</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="flex justify-end mt-6 pt-4 border-t border-gray-150 dark:border-gray-750">
                        <button onclick="closeLeaderboardModal()" class="px-5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition min-h-[40px]">
                            Kapat
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('leaderboardModal')?.remove();
        const div = document.createElement('div');
        div.id = 'leaderboardModal';
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
    } catch (err) {
        console.error("DEBUG ERROR inside showGroupLeaderboard:", err);
        alert("Liderlik tablosu açılırken hata oluştu: " + err.message);
    }
}

export function closeLeaderboardModal() {
    document.getElementById('leaderboardModal')?.remove();
}

export function showGroupOdevAtaModal(groupId) {
    try {
        console.log("DEBUG: showGroupOdevAtaModal() called, groupId:", groupId);
        const groups = loadGroupsData() || [];
        const targetGroup = groups.find(g => g.id === groupId);
        if (!targetGroup) return;

        const studentIds = targetGroup.studentIds || [];
        if (studentIds.length === 0) {
            alert("Ödev atamak için bu gruba öğrenci eklemeniz gerekir.");
            return;
        }

        if (window.renderOdevAtaModal) {
            // Initialize active homework temporary list
            window._geciciOdevListesi = [];
            window.renderOdevAtaModal(studentIds);
        } else {
            alert("Ödev modülü yüklenemedi.");
        }
    } catch (err) {
        console.error("DEBUG ERROR inside showGroupOdevAtaModal:", err);
        alert("Grup ödev atama modalı açılırken hata oluştu: " + err.message);
    }
}

// Bind functions to window for global templates accessibility
window.renderGroupsPage = renderGroupsPage;
window.showCreateGroupModal = showCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.saveGroup = saveGroup;
window.deleteGroup = deleteGroup;
window.showGroupLeaderboard = showGroupLeaderboard;
window.closeLeaderboardModal = closeLeaderboardModal;
window.showGroupOdevAtaModal = showGroupOdevAtaModal;

console.log("DEBUG: groups.js finished loading successfully.");
