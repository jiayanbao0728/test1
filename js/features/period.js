(function () {
    const STORAGE_RECORDS = 'periodRecords';
    const STORAGE_SETTINGS = 'periodSettings';

    let periodRecords = [];
    let periodSettings = {
        cycleLength: 28,
        periodLength: 5
    };
    let currentMonth = new Date();
    let selectedDate = toDateKey(new Date());

    function storageKey(key) {
        return typeof getStorageKey === 'function' ? getStorageKey(key) : key;
    }

    function startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function toDateKey(date) {
        const d = startOfDay(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function fromDateKey(key) {
        const parts = String(key || '').split('-').map(Number);
        return startOfDay(new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
    }

    function addDays(date, days) {
        const d = startOfDay(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function dayDiff(a, b) {
        return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
    }

    function escapeHtml(text) {
        return String(text || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    async function loadPeriodData() {
        try {
            const savedRecords = await localforage.getItem(storageKey(STORAGE_RECORDS));
            const savedSettings = await localforage.getItem(storageKey(STORAGE_SETTINGS));
            periodRecords = Array.isArray(savedRecords) ? savedRecords.map(normalizeRecord).filter(Boolean) : [];
            periodSettings = Object.assign({}, periodSettings, savedSettings || {});
        } catch (e) {
            console.warn('[period] load failed:', e);
        }
    }

    function normalizeRecord(record) {
        if (!record || !record.startDate) return null;
        return {
            id: record.id || `period_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            startDate: toDateKey(record.startDate),
            endDate: record.endDate ? toDateKey(record.endDate) : null,
            note: record.note || ''
        };
    }

    function savePeriodData() {
        try {
            localforage.setItem(storageKey(STORAGE_RECORDS), periodRecords);
            localforage.setItem(storageKey(STORAGE_SETTINGS), periodSettings);
        } catch (e) {
            console.warn('[period] save failed:', e);
            if (typeof showNotification === 'function') showNotification('月经记录保存失败', 'error');
        }
    }

    function getSortedRecords() {
        return [...periodRecords].sort((a, b) => fromDateKey(b.startDate) - fromDateKey(a.startDate));
    }

    function getRecordDuration(record) {
        const end = record.endDate || toDateKey(new Date());
        return dayDiff(fromDateKey(end), fromDateKey(record.startDate)) + 1;
    }

    function getRecordForDate(dateKey) {
        const target = fromDateKey(dateKey);
        return periodRecords.find(record => {
            const start = fromDateKey(record.startDate);
            const end = record.endDate ? fromDateKey(record.endDate) : new Date();
            return startOfDay(target) >= startOfDay(start) && startOfDay(target) <= startOfDay(end);
        }) || null;
    }

    function getLatestRecord() {
        return getSortedRecords()[0] || null;
    }

    function getAverageCycleLength() {
        const completed = getSortedRecords().filter(r => r.endDate).reverse();
        if (completed.length < 2) return Number(periodSettings.cycleLength) || 28;
        const gaps = [];
        for (let i = 1; i < completed.length; i++) {
            const gap = dayDiff(fromDateKey(completed[i].startDate), fromDateKey(completed[i - 1].startDate));
            if (gap >= 20 && gap <= 45) gaps.push(gap);
        }
        if (!gaps.length) return Number(periodSettings.cycleLength) || 28;
        const avg = Math.round(gaps.reduce((sum, n) => sum + n, 0) / gaps.length);
        return avg || Number(periodSettings.cycleLength) || 28;
    }

    function getNextPeriodDate() {
        const latest = getLatestRecord();
        if (!latest || !latest.endDate) return null;
        return addDays(fromDateKey(latest.startDate), getAverageCycleLength());
    }

    function getPredictedWindow() {
        const next = getNextPeriodDate();
        if (!next) return [];
        const len = Math.max(1, Number(periodSettings.periodLength) || 5);
        return Array.from({ length: len }, (_, i) => toDateKey(addDays(next, i)));
    }

    function getOvulationWindow() {
        const next = getNextPeriodDate();
        if (!next) return [];
        return [-16, -15, -14, -13, -12].map(offset => toDateKey(addDays(next, offset)));
    }

    function getStatusText() {
        const active = getSortedRecords().find(r => !r.endDate);
        if (active) {
            return {
                title: `经期第 ${getRecordDuration(active)} 天`,
                detail: '记得多休息，今天也慢一点。',
                tone: 'period'
            };
        }

        const next = getNextPeriodDate();
        if (!next) {
            return {
                title: '还没有记录',
                detail: '记录一次开始和结束后，就能看到预测。',
                tone: 'empty'
            };
        }

        const diff = dayDiff(next, new Date());
        if (diff > 0) {
            return {
                title: `预计 ${diff} 天后`,
                detail: `${toDateKey(next)} 左右可能开始。`,
                tone: 'normal'
            };
        }
        if (diff === 0) {
            return {
                title: '预计今天',
                detail: '如果已经开始，可以点下方记录。',
                tone: 'period'
            };
        }
        return {
            title: `已推迟 ${Math.abs(diff)} 天`,
            detail: '预测只作参考，身体感受更重要。',
            tone: 'late'
        };
    }

    function ensurePeriodEntry() {
        if (document.getElementById('period-function')) return;
        const list = document.querySelector('#advanced-modal .settings-item-list');
        if (!list) return;
        const item = document.createElement('div');
        item.className = 'settings-item';
        item.id = 'period-function';
        item.innerHTML = '<i class="fas fa-droplet"></i><span>月经记录</span>';
        const mood = document.getElementById('mood-function');
        if (mood && mood.parentNode === list) {
            list.insertBefore(item, mood.nextSibling);
        } else {
            list.appendChild(item);
        }
    }

    function ensurePeriodModal() {
        if (document.getElementById('period-modal')) return;
        const modal = document.createElement('div');
        modal.className = 'modal period-modal';
        modal.id = 'period-modal';
        modal.innerHTML = `
            <div class="modal-content period-modal-content">
                <div class="modal-title period-compact-title">
                    <i class="fas fa-droplet"></i><span>月经记录</span>
                </div>

                <div class="period-section">
                    <div class="period-status-card" id="period-status-card"></div>
                </div>

                <div class="period-section">
                    <div class="period-section-title"><i class="fas fa-heart"></i><span>今日提醒</span></div>
                    <div class="period-care-card" id="period-care-card">预测只是参考，身体感受更重要。</div>
                </div>

                <div class="period-section">
                    <div class="period-section-title"><i class="fas fa-pen"></i><span>记录月经</span></div>
                    <div class="period-input-group">
                        <div class="period-input-row">
                            <label class="period-input-item">开始日期<input type="date" id="period-start-date" class="period-date-input"></label>
                            <label class="period-input-item">结束日期<input type="date" id="period-end-date" class="period-date-input"></label>
                        </div>
                        <textarea id="period-note-input" class="period-note-input" rows="2" placeholder="备注，比如身体状态、情绪、疼痛程度..."></textarea>
                        <div class="period-actions">
                            <button class="period-btn period-btn-primary" id="period-start-btn"><i class="fas fa-play"></i>记录开始</button>
                            <button class="period-btn period-btn-secondary" id="period-end-btn"><i class="fas fa-stop"></i>记录结束</button>
                            <button class="period-btn period-btn-secondary" id="period-delete-btn"><i class="fas fa-trash"></i>删除</button>
                        </div>
                    </div>
                </div>

                <div class="period-section">
                    <div class="period-section-title"><i class="fas fa-chart-simple"></i><span>周期统计</span></div>
                    <div class="period-stats-grid">
                        <div><strong id="period-stat-length">-</strong><span>平均经期</span></div>
                        <div><strong id="period-stat-cycle">-</strong><span>平均周期</span></div>
                        <div><strong id="period-stat-next">-</strong><span>距离下次</span></div>
                    </div>
                    <div class="period-settings-card">
                        <label>默认周期 <input id="period-cycle-input" type="number" min="20" max="45"> 天</label>
                        <label>默认经期 <input id="period-length-input" type="number" min="2" max="10"> 天</label>
                    </div>
                </div>

                <div class="period-section">
                    <div class="period-section-title"><i class="fas fa-clock-rotate-left"></i><span>历史记录</span></div>
                    <div class="period-history" id="period-history"></div>
                </div>

                <div class="modal-buttons period-footer">
                    <button class="modal-btn modal-btn-secondary" id="period-back-btn"><i class="fas fa-arrow-left"></i>返回</button>
                    <button class="modal-btn modal-btn-secondary" id="period-close-bottom-btn">关闭</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    function renderPeriodUI() {
        renderSidePanel();
    }

    function renderCalendar() {
        const grid = document.getElementById('period-calendar');
        const label = document.getElementById('period-month-label');
        if (!grid || !label) return;

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        label.textContent = `${year}年${month + 1}月`;

        const first = new Date(year, month, 1);
        const offset = (first.getDay() + 6) % 7;
        const start = addDays(first, -offset);
        const todayKey = toDateKey(new Date());
        const predicted = new Set(getPredictedWindow());
        const ovulation = new Set(getOvulationWindow());

        grid.innerHTML = '';
        for (let i = 0; i < 42; i++) {
            const day = addDays(start, i);
            const key = toDateKey(day);
            const record = getRecordForDate(key);
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'period-day';
            if (day.getMonth() !== month) cell.classList.add('muted');
            if (key === todayKey) cell.classList.add('today');
            if (key === selectedDate) cell.classList.add('selected');
            if (record) cell.classList.add('real');
            else if (predicted.has(key)) cell.classList.add('predicted');
            if (!record && ovulation.has(key)) cell.classList.add('ovulation');
            cell.dataset.date = key;
            cell.innerHTML = `<span>${day.getDate()}</span>${record && record.note ? '<em></em>' : ''}`;
            cell.addEventListener('click', () => {
                selectedDate = key;
                renderPeriodUI();
            });
            grid.appendChild(cell);
        }
    }

    function renderSidePanel() {
        const status = getStatusText();
        const statusCard = document.getElementById('period-status-card');
        if (statusCard) {
            statusCard.className = `period-status-card ${status.tone}`;
            statusCard.innerHTML = `<span>当前状态</span><strong>${escapeHtml(status.title)}</strong><p>${escapeHtml(status.detail)}</p>`;
        }

        const cycleEl = document.getElementById('period-stat-cycle');
        const lenEl = document.getElementById('period-stat-length');
        const nextEl = document.getElementById('period-stat-next');
        const careEl = document.getElementById('period-care-card');
        const avgLen = getAveragePeriodLength();
        const next = getNextPeriodDate();
        if (cycleEl) cycleEl.textContent = `${getAverageCycleLength()}天`;
        if (lenEl) lenEl.textContent = avgLen ? `${avgLen}天` : `${periodSettings.periodLength}天`;
        if (nextEl) {
            const diff = next ? dayDiff(next, new Date()) : null;
            nextEl.textContent = diff === null ? '-' : (diff >= 0 ? `${diff}天` : `推迟${Math.abs(diff)}天`);
        }
        if (careEl) careEl.textContent = status.detail;

        const selectedTitle = document.getElementById('period-selected-title');
        if (selectedTitle) selectedTitle.textContent = selectedDate;

        const startDateInput = document.getElementById('period-start-date');
        const endDateInput = document.getElementById('period-end-date');
        if (startDateInput && !startDateInput.value) startDateInput.value = selectedDate;
        const noteInput = document.getElementById('period-note-input');
        const selectedRecord = getRecordForDate(selectedDate);
        if (endDateInput && selectedRecord && selectedRecord.endDate && document.activeElement !== endDateInput) {
            endDateInput.value = selectedRecord.endDate;
        }
        if (noteInput && document.activeElement !== noteInput) noteInput.value = selectedRecord ? selectedRecord.note || '' : '';

        const cycleInput = document.getElementById('period-cycle-input');
        const lengthInput = document.getElementById('period-length-input');
        if (cycleInput && document.activeElement !== cycleInput) cycleInput.value = periodSettings.cycleLength;
        if (lengthInput && document.activeElement !== lengthInput) lengthInput.value = periodSettings.periodLength;

        renderHistory();
    }

    function getAveragePeriodLength() {
        const completed = periodRecords.filter(r => r.endDate);
        if (!completed.length) return null;
        const sum = completed.reduce((total, r) => total + getRecordDuration(r), 0);
        return Math.round(sum / completed.length);
    }

    function renderHistory() {
        const list = document.getElementById('period-history');
        if (!list) return;
        const records = getSortedRecords().slice(0, 6);
        if (!records.length) {
            list.innerHTML = '<div class="period-empty">还没有记录。点某一天后，可以记录开始。</div>';
            return;
        }
        list.innerHTML = records.map(record => {
            const end = record.endDate || '进行中';
            const duration = getRecordDuration(record);
            return `
                <button class="period-history-item" data-date="${record.startDate}">
                    <span>${escapeHtml(record.startDate)} - ${escapeHtml(end)}</span>
                    <strong>${duration}天</strong>
                </button>`;
        }).join('');
        list.querySelectorAll('.period-history-item').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDate = btn.dataset.date;
                currentMonth = fromDateKey(selectedDate);
                renderPeriodUI();
            });
        });
    }

    function startPeriod() {
        const startInput = document.getElementById('period-start-date');
        selectedDate = startInput && startInput.value ? startInput.value : selectedDate;
        const existing = getRecordForDate(selectedDate);
        if (existing) {
            if (typeof showNotification === 'function') showNotification('这一天已经在记录里了', 'info');
            return;
        }
        const active = periodRecords.find(r => !r.endDate);
        if (active) active.endDate = toDateKey(addDays(fromDateKey(selectedDate), -1));
        periodRecords.push({
            id: `period_${Date.now()}`,
            startDate: selectedDate,
            endDate: null,
            note: ''
        });
        savePeriodData();
        renderPeriodUI();
        if (typeof showNotification === 'function') showNotification('已记录开始', 'success');
    }

    function endPeriod() {
        const startInput = document.getElementById('period-start-date');
        const endInput = document.getElementById('period-end-date');
        if (startInput && startInput.value) selectedDate = startInput.value;
        const endDate = endInput && endInput.value ? endInput.value : selectedDate;
        let record = getRecordForDate(endDate) || getRecordForDate(selectedDate);
        if (!record) record = getSortedRecords().find(r => !r.endDate);
        if (!record) {
            if (typeof showNotification === 'function') showNotification('还没有可结束的记录', 'info');
            return;
        }
        if (fromDateKey(endDate) < fromDateKey(record.startDate)) {
            if (typeof showNotification === 'function') showNotification('结束日期不能早于开始日期', 'warning');
            return;
        }
        record.endDate = endDate;
        selectedDate = endDate;
        savePeriodData();
        renderPeriodUI();
        if (typeof showNotification === 'function') showNotification('已记录结束', 'success');
    }

    function deleteSelectedRecord() {
        const startInput = document.getElementById('period-start-date');
        const endInput = document.getElementById('period-end-date');
        const key = (startInput && startInput.value) || (endInput && endInput.value) || selectedDate;
        const record = getRecordForDate(key);
        if (!record) {
            if (typeof showNotification === 'function') showNotification('这一天没有记录', 'info');
            return;
        }
        if (!confirm('确定删除这段月经记录吗？')) return;
        periodRecords = periodRecords.filter(r => r.id !== record.id);
        savePeriodData();
        renderPeriodUI();
        if (typeof showNotification === 'function') showNotification('已删除记录', 'success');
    }

    function saveSelectedNote() {
        const input = document.getElementById('period-note-input');
        const startInput = document.getElementById('period-start-date');
        const key = (startInput && startInput.value) || selectedDate;
        const record = getRecordForDate(key);
        if (!input || !record) return;
        record.note = input.value.trim();
        savePeriodData();
        renderHistory();
    }

    function bindPeriodEvents() {
        const modal = document.getElementById('period-modal');
        if (!modal || modal.dataset.bound === 'true') return;
        modal.dataset.bound = 'true';
        const byId = id => document.getElementById(id);
        byId('period-prev-month')?.addEventListener('click', () => {
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
            renderCalendar();
        });
        byId('period-next-month')?.addEventListener('click', () => {
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
            renderCalendar();
        });
        byId('period-start-btn')?.addEventListener('click', startPeriod);
        byId('period-end-btn')?.addEventListener('click', endPeriod);
        byId('period-delete-btn')?.addEventListener('click', deleteSelectedRecord);
        byId('period-note-input')?.addEventListener('change', saveSelectedNote);
        byId('period-start-date')?.addEventListener('change', e => {
            if (e.target.value) {
                selectedDate = e.target.value;
                renderSidePanel();
            }
        });
        byId('period-end-date')?.addEventListener('change', e => {
            if (e.target.value) {
                selectedDate = e.target.value;
                renderSidePanel();
            }
        });
        byId('period-cycle-input')?.addEventListener('change', e => {
            periodSettings.cycleLength = Math.max(20, Math.min(45, Number(e.target.value) || 28));
            savePeriodData();
            renderPeriodUI();
        });
        byId('period-length-input')?.addEventListener('change', e => {
            periodSettings.periodLength = Math.max(2, Math.min(10, Number(e.target.value) || 5));
            savePeriodData();
            renderPeriodUI();
        });

        const close = () => hideModal(byId('period-modal'));
        byId('period-close-btn')?.addEventListener('click', close);
        byId('period-close-bottom-btn')?.addEventListener('click', close);
        byId('period-back-btn')?.addEventListener('click', () => {
            close();
            const adv = byId('advanced-modal');
            if (adv) showModal(adv);
        });
    }

    async function openPeriodModal() {
        await loadPeriodData();
        ensurePeriodModal();
        bindPeriodEvents();
        currentMonth = fromDateKey(selectedDate);
        renderPeriodUI();
        const adv = document.getElementById('advanced-modal');
        if (adv) hideModal(adv);
        setTimeout(() => showModal(document.getElementById('period-modal')), 120);
    }

    async function initPeriodFeature() {
        ensurePeriodEntry();
        ensurePeriodModal();
        await loadPeriodData();
        bindPeriodEvents();
        const entry = document.getElementById('period-function');
        if (entry && !entry.dataset.initialized) {
            entry.dataset.initialized = 'true';
            entry.addEventListener('click', openPeriodModal);
        }
    }

    window.initPeriodFeature = initPeriodFeature;
    window.openPeriodModal = openPeriodModal;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPeriodFeature);
    } else {
        initPeriodFeature();
    }
})();
