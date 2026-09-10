import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCockpitStatusItems, getCockpitData, getStudentInitials } from '../student-cockpit-insights.js';

test('cockpit derives only supported metrics and priorities from existing records', () => {
  const student = {
    sinif: '8',
    hedefNet: 70,
    denemeler: [
      { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-01', toplamNet: 55 },
      { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-08', toplamNet: 61 },
      { tip: 'branş', sorular: [{ konuAdi: 'Basınç', durum: 'yanlis', hataKodu: 'Dikkatsizlik' }] }
    ]
  };
  const summary = { latestNet: 61, upcomingLesson: null, homeworkCompletionRate: 50, homeworkCount: 2, completedHomeworkCount: 1 };
  const analysis = { strongestSubject: null, weakestSubject: null, priorityTopics: [{ topic: 'Basınç', errors: 1, attempts: 1 }] };
  const data = getCockpitData({ student, homeworks: [{ bitisTarihi: '2026-08-12', durum: 'verildi', konu: 'Basınç' }, { durum: 'tamamlandi' }], summary, analysis });

  assert.equal(data.averageNet, 58);
  assert.equal(data.targetGap, 9);
  assert.equal(data.priority, 'Basınç tekrarı + 2 konu testi');
  assert.equal(data.mostFrequentError.label, 'Dikkatsizlik');
  assert.equal(data.pendingHomework.konu, 'Basınç');
});

test('cockpit uses neutral empty states instead of fabricating analysis', () => {
  const data = getCockpitData({
    student: { denemeler: [] }, homeworks: [],
    summary: { latestNet: null, upcomingLesson: null, homeworkCompletionRate: null, homeworkCount: 0, completedHomeworkCount: 0 },
    analysis: { strongestSubject: null, weakestSubject: null, priorityTopics: [] }
  });
  assert.equal(data.averageNet, null);
  assert.equal(data.priority, null);
  assert.equal(data.targetGap, null);
  assert.deepEqual(buildCockpitStatusItems(data), []);
  assert.equal(getStudentInitials('Yağmur Aydın'), 'YA');
});
