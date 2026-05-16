// ── STATE ──────────────────────────────────────────────────────
let state = JSON.parse(localStorage.getItem('glow-state') || 'null') || {
  routines: [],
  completions: {},
  notificationsEnabled: false
};

const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function save() { localStorage.setItem('glow-state', JSON.stringify(state)); }

// ── DATE HELPERS ───────────────────────────────────────────────
function todayKey() { return dateKey(new Date()); }
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isRoutineActiveOnDate(r, date) {
  if (!r.enabled) return false;
  const dayName = DAYS_ES[date.getDay()];
  const freq    = r.freq;
  if (freq === 'Diario') return true;
  if (freq === 'Semanal') {
    const created = new Date(parseInt(r.id));
    return date.getDay() === created.getDay();
  }
  if (freq === 'Quincenal') {
    const weekDay = r.weekDay !== undefined ? r.weekDay : new Date(parseInt(r.id)).getDay();
    if (date.getDay() !== weekDay) return false;
    const created = new Date(parseInt(r.id));
    const offset = (weekDay - created.getDay() + 7) % 7;
    const firstOcc = new Date(created); firstOcc.setHours(0, 0, 0, 0);
    firstOcc.setDate(firstOcc.getDate() + offset);
    const d0 = new Date(date); d0.setHours(0, 0, 0, 0);
    const weeks = Math.round((d0 - firstOcc) / (7 * 86400000));
    return weeks >= 0 && weeks % 2 === 0;
  }
  if (freq === 'Mensual') {
    const dayOfMonth = r.monthDay !== undefined ? r.monthDay : new Date(parseInt(r.id)).getDate();
    return date.getDate() === dayOfMonth;
  }
  if (freq === 'Personalizado') {
    const val = r.customValue || 1;
    const unit = r.customUnit || 'dias';
    const created = new Date(parseInt(r.id));
    if (unit === 'dias') {
      const d0 = new Date(date); d0.setHours(0,0,0,0);
      const c0 = new Date(created); c0.setHours(0,0,0,0);
      const diff = Math.round((d0 - c0) / 86400000);
      return diff >= 0 && diff % val === 0;
    }
    if (unit === 'semanas') {
      const weekDay = r.customWeekDay !== undefined ? r.customWeekDay : created.getDay();
      if (date.getDay() !== weekDay) return false;
      const offset = (weekDay - created.getDay() + 7) % 7;
      const firstOcc = new Date(created); firstOcc.setHours(0,0,0,0);
      firstOcc.setDate(firstOcc.getDate() + offset);
      const d0 = new Date(date); d0.setHours(0,0,0,0);
      const weeks = Math.round((d0 - firstOcc) / (7 * 86400000));
      return weeks >= 0 && weeks % val === 0;
    }
    if (unit === 'meses') {
      const dayOfMonth = r.customMonthDay !== undefined ? r.customMonthDay : created.getDate();
      if (date.getDate() !== dayOfMonth) return false;
      const monthsDiff = (date.getFullYear() - created.getFullYear()) * 12 + (date.getMonth() - created.getMonth());
      return monthsDiff >= 0 && monthsDiff % val === 0;
    }
    return false;
  }
  return freq.split(',').includes(dayName);
}
function isRoutineActiveToday(r) { return isRoutineActiveOnDate(r, new Date()); }

function freqLabel(r) {
  if (r.freq !== 'Personalizado') return r.freq;
  const val = r.customValue || 1;
  const map = { dias: val === 1 ? 'día' : 'días', semanas: val === 1 ? 'semana' : 'semanas', meses: val === 1 ? 'mes' : 'meses' };
  return `Cada ${val} ${map[r.customUnit] || r.customUnit || ''}`.trim();
}

// ── TODAY VIEW ─────────────────────────────────────────────────
function renderToday() {
  const now  = new Date();
  const hour = now.getHours();

  const greetEl = document.getElementById('greeting');
  if (hour < 12)      greetEl.textContent = 'Buenos días ✨';
  else if (hour < 18) greetEl.textContent = 'Buenas tardes 🌤';
  else                greetEl.textContent = 'Buenas noches 🌙';

  document.getElementById('today-date').textContent =
    `${DAYS_ES[now.getDay()]}, ${now.getDate()} de ${MONTHS_ES[now.getMonth()]}`;

  const key  = todayKey();
  const done = state.completions[key] || [];

  const todayAll     = state.routines.filter(r => isRoutineActiveToday(r));
  const todayPending = todayAll.filter(r => !done.includes(r.id));

  const morning = todayPending.filter(r => r.timeOfDay === 'Mañana' || r.timeOfDay === 'Ambos');
  const night   = todayPending.filter(r => r.timeOfDay === 'Noche'  || r.timeOfDay === 'Ambos');
  const extra   = todayPending.filter(r => !['Mañana','Noche','Ambos'].includes(r.timeOfDay));

  renderTaskList('morning-list', morning);
  renderTaskList('night-list',   night);
  renderTaskList('extra-list',   extra);

  document.getElementById('lbl-morning').style.display = morning.length ? '' : 'none';
  document.getElementById('lbl-night').style.display   = night.length   ? '' : 'none';
  document.getElementById('lbl-extra').style.display   = extra.length   ? '' : 'none';

  const noRoutines = todayAll.length === 0;
  const allDone    = todayAll.length > 0 && todayPending.length === 0;

  document.getElementById('today-empty').style.display = noRoutines ? 'block' : 'none';
  document.getElementById('all-done').style.display    = allDone   ? 'block' : 'none';

  computeStreak();
  renderMiniCalendar();
}

function renderTaskList(containerId, routines) {
  const el = document.getElementById(containerId);
  if (!routines.length) { el.innerHTML = ''; return; }
  el.innerHTML = routines.map(r => `
    <div class="task-card" id="card-${r.id}">
      <span class="task-emoji">${r.emoji}</span>
      <div class="task-info">
        <div class="task-name">${r.name}</div>
        <div class="task-meta">${r.zone} · ${freqLabel(r)} · ${r.reminderTime}</div>
      </div>
      <button class="task-check" onclick="markDone('${r.id}')">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </button>
    </div>`).join('');
}

function markDone(id) {
  const key = todayKey();
  if (!state.completions[key]) state.completions[key] = [];
  if (!state.completions[key].includes(id)) state.completions[key].push(id);
  save();

  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.style.transition = 'opacity .3s, transform .3s';
    card.style.opacity    = '0';
    card.style.transform  = 'translateX(40px)';
    setTimeout(renderToday, 300);
  } else {
    renderToday();
  }
}

function computeStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const k      = dateKey(d);
    const active = state.routines.filter(r => isRoutineActiveOnDate(r, new Date(d.getTime())));
    if (!active.length) break;
    const done = state.completions[k] || [];
    if (!active.every(r => done.includes(r.id))) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  document.getElementById('streak-count').textContent = streak;
}

// ── MINI CALENDAR ──────────────────────────────────────────────
let calDate = new Date();

function renderMiniCalendar() {
  const year  = calDate.getFullYear();
  const month = calDate.getMonth();
  document.getElementById('cal-month-label').textContent = `${MONTHS_ES[month]} ${year}`;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  DAYS_ES.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today       = new Date();

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day other-month';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date      = new Date(year, month, d);
    const k         = dateKey(date);
    const isToday   = date.toDateString() === today.toDateString();
    const allActive = state.routines.filter(r => isRoutineActiveOnDate(r, date));
    const done      = state.completions[k] || [];
    const hasTasks  = allActive.length > 0;
    const allDone   = hasTasks && allActive.every(r => done.includes(r.id));

    const cell = document.createElement('div');
    cell.className = `cal-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''} ${allDone ? 'all-done-day' : ''}`;
    cell.textContent = d;
    grid.appendChild(cell);
  }
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1); renderMiniCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1); renderMiniCalendar();
});

// ── HISTORY VIEW ───────────────────────────────────────────────
let histDate = new Date();

function renderHistCalendar() {
  const year  = histDate.getFullYear();
  const month = histDate.getMonth();
  document.getElementById('hist-month-label').textContent = `${MONTHS_ES[month]} ${year}`;

  const grid = document.getElementById('hist-calendar-grid');
  grid.innerHTML = '';

  DAYS_ES.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-day-header'; h.textContent = d; grid.appendChild(h);
  });

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today       = new Date();

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div'); e.className = 'cal-day other-month'; grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date      = new Date(year, month, d);
    const k         = dateKey(date);
    const isToday   = date.toDateString() === today.toDateString();
    const allActive = state.routines.filter(r => isRoutineActiveOnDate(r, date));
    const done      = state.completions[k] || [];
    const hasTasks  = allActive.length > 0;
    const allDone   = hasTasks && allActive.every(r => done.includes(r.id));

    const cell = document.createElement('div');
    cell.className = `cal-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''} ${allDone ? 'all-done-day' : ''}`;
    cell.textContent = d;
    cell.addEventListener('click', () => showCalDetail(date, k));
    grid.appendChild(cell);
  }
  showCalDetail(today, dateKey(today));
}

function showCalDetail(date, key) {
  const detail = document.getElementById('cal-detail');
  const active = state.routines.filter(r => isRoutineActiveOnDate(r, date));
  const done   = state.completions[key] || [];
  const label  = `${DAYS_ES[date.getDay()]} ${date.getDate()} de ${MONTHS_ES[date.getMonth()]}`;

  if (!active.length) {
    detail.innerHTML = `<div class="cal-detail-title">${label}</div><div class="cal-empty">Sin cuidados este día</div>`;
    return;
  }
  detail.innerHTML = `
    <div class="cal-detail-title">${label}</div>
    ${active.map(r => `
    <div class="cal-item">
      <span>${r.emoji}</span>
      <span style="${done.includes(r.id) ? 'text-decoration:line-through;opacity:.6' : ''}">${r.name}</span>
      ${done.includes(r.id) ? '<span style="margin-left:auto;font-size:12px;color:#e888a8">✓</span>' : ''}
    </div>`).join('')}`;
}

document.getElementById('hist-prev').addEventListener('click', () => {
  histDate.setMonth(histDate.getMonth() - 1); renderHistCalendar();
});
document.getElementById('hist-next').addEventListener('click', () => {
  histDate.setMonth(histDate.getMonth() + 1); renderHistCalendar();
});

// ── ROUTINES VIEW ──────────────────────────────────────────────
function renderRoutines() {
  const el = document.getElementById('routines-list');
  if (!state.routines.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg><p>Aún no tienes rutinas.<br>¡Agrega tu primer cuidado!</p></div>';
    return;
  }
  el.innerHTML = state.routines.map(r => `
    <div class="routine-card ${r.enabled ? '' : 'disabled'}">
      <span class="routine-icon">${r.emoji}</span>
      <div class="routine-info">
        <div class="routine-name">${r.name}</div>
        <div class="routine-tags">
          <span class="tag">${r.zone}</span>
          <span class="tag yellow">${r.timeOfDay}</span>
          <span class="tag">${freqLabel(r)}</span>
          <span class="tag">⏰ ${r.reminderTime}</span>
        </div>
      </div>
      <div class="routine-actions">
        <button class="icon-btn" onclick="editRoutine('${r.id}')" title="Editar">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="icon-btn" onclick="toggleRoutine('${r.id}')" title="${r.enabled ? 'Pausar' : 'Activar'}">
          ${r.enabled
            ? `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`}
        </button>
        <button class="icon-btn delete" onclick="deleteRoutine('${r.id}')" title="Eliminar">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    </div>`).join('');
}

function toggleRoutine(id) {
  const r = state.routines.find(r => r.id === id);
  if (r) { r.enabled = !r.enabled; save(); renderRoutines(); renderToday(); }
}
function deleteRoutine(id) {
  state.routines = state.routines.filter(r => r.id !== id);
  save(); renderRoutines(); renderToday(); scheduleNotifications();
  showToast('Rutina eliminada');
}

// ── MODAL ──────────────────────────────────────────────────────
let selectedZone = '', selectedTime = '', selectedFreq = '', selectedEmoji = '🧴';
let editingId = null, selectedWeekDay = null, selectedMonthDay = null;
let selectedCustomValue = 1, selectedCustomUnit = null, selectedCustomWeekDay = null, selectedCustomMonthDay = null;

function openModal(routine = null) {
  editingId      = routine ? routine.id        : null;
  selectedZone   = routine ? routine.zone      : '';
  selectedTime   = routine ? routine.timeOfDay : '';
  selectedFreq   = routine ? routine.freq      : '';
  selectedEmoji  = routine ? routine.emoji     : '🧴';
  selectedWeekDay      = routine?.weekDay ?? null;
  selectedMonthDay     = routine?.monthDay ?? null;
  selectedCustomValue  = routine?.customValue ?? 1;
  selectedCustomUnit   = routine?.customUnit ?? null;
  selectedCustomWeekDay  = routine?.customWeekDay ?? null;
  selectedCustomMonthDay = routine?.customMonthDay ?? null;

  document.getElementById('modal-title').textContent = routine ? 'Editar Rutina' : 'Nueva Rutina';
  document.getElementById('save-care').textContent   = routine ? 'Guardar cambios' : 'Guardar';
  document.getElementById('care-name').value         = routine ? routine.name : '';
  document.getElementById('care-time').value         = routine ? routine.reminderTime : '08:00';

  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  if (selectedZone) document.querySelector(`#zone-chips .chip[data-val="${selectedZone}"]`)?.classList.add('selected');
  if (selectedTime) document.querySelector(`#time-chips .chip[data-val="${selectedTime}"]`)?.classList.add('selected');
  if (selectedFreq) document.querySelector(`#freq-chips .chip[data-val="${selectedFreq}"]`)?.classList.add('selected');

  const dayPicker = document.getElementById('quincenal-day-picker');
  dayPicker.style.display = selectedFreq === 'Quincenal' ? '' : 'none';
  document.querySelectorAll('.day-chip').forEach(c =>
    c.classList.toggle('selected', parseInt(c.dataset.day) === selectedWeekDay));

  const mensualPicker = document.getElementById('mensual-day-picker');
  mensualPicker.style.display = selectedFreq === 'Mensual' ? '' : 'none';
  document.getElementById('mensual-day-input').value = selectedMonthDay ?? '';

  const customPicker = document.getElementById('personalizado-picker');
  customPicker.style.display = selectedFreq === 'Personalizado' ? '' : 'none';
  document.getElementById('custom-value-input').value = selectedCustomValue;
  document.querySelectorAll('.unit-chip').forEach(c => c.classList.toggle('selected', c.dataset.unit === selectedCustomUnit));
  document.getElementById('custom-weekday-picker').style.display  = selectedCustomUnit === 'semanas' ? '' : 'none';
  document.getElementById('custom-monthday-picker').style.display = selectedCustomUnit === 'meses'   ? '' : 'none';
  document.querySelectorAll('.cwd-chip').forEach(c => c.classList.toggle('selected', parseInt(c.dataset.day) === selectedCustomWeekDay));
  document.getElementById('custom-monthday-input').value = selectedCustomMonthDay ?? '';

  document.querySelectorAll('.emoji-grid span').forEach(e =>
    e.classList.toggle('selected', e.dataset.e === selectedEmoji));

  document.getElementById('modal-overlay').classList.add('open');
}

function editRoutine(id) {
  const r = state.routines.find(r => r.id === id);
  if (r) openModal(r);
}

document.getElementById('open-add-modal').addEventListener('click', () => openModal());
document.getElementById('modal-close').addEventListener('click', () =>
  document.getElementById('modal-overlay').classList.remove('open'));
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay'))
    document.getElementById('modal-overlay').classList.remove('open');
});

document.querySelectorAll('#zone-chips .chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#zone-chips .chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedZone = btn.dataset.val;
}));
document.querySelectorAll('#time-chips .chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#time-chips .chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedTime = btn.dataset.val;
}));
document.querySelectorAll('#freq-chips .chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#freq-chips .chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedFreq = btn.dataset.val;
  const dayPicker = document.getElementById('quincenal-day-picker');
  dayPicker.style.display = selectedFreq === 'Quincenal' ? '' : 'none';
  if (selectedFreq !== 'Quincenal') { selectedWeekDay = null; document.querySelectorAll('.day-chip').forEach(b => b.classList.remove('selected')); }

  const mensualPicker = document.getElementById('mensual-day-picker');
  mensualPicker.style.display = selectedFreq === 'Mensual' ? '' : 'none';
  if (selectedFreq !== 'Mensual') { selectedMonthDay = null; document.getElementById('mensual-day-input').value = ''; }

  const customPicker = document.getElementById('personalizado-picker');
  customPicker.style.display = selectedFreq === 'Personalizado' ? '' : 'none';
  if (selectedFreq !== 'Personalizado') {
    selectedCustomValue = 1; selectedCustomUnit = null; selectedCustomWeekDay = null; selectedCustomMonthDay = null;
    document.querySelectorAll('.unit-chip').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.cwd-chip').forEach(b => b.classList.remove('selected'));
    document.getElementById('custom-weekday-picker').style.display = 'none';
    document.getElementById('custom-monthday-picker').style.display = 'none';
  }
}));
document.querySelectorAll('.day-chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.day-chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedWeekDay = parseInt(btn.dataset.day);
}));
document.getElementById('mensual-day-input').addEventListener('input', e => {
  const v = parseInt(e.target.value);
  selectedMonthDay = (v >= 1 && v <= 28) ? v : null;
});
document.querySelectorAll('.unit-chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.unit-chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedCustomUnit = btn.dataset.unit;
  document.getElementById('custom-weekday-picker').style.display  = selectedCustomUnit === 'semanas' ? '' : 'none';
  document.getElementById('custom-monthday-picker').style.display = selectedCustomUnit === 'meses'   ? '' : 'none';
  selectedCustomWeekDay = null; selectedCustomMonthDay = null;
  document.querySelectorAll('.cwd-chip').forEach(b => b.classList.remove('selected'));
  document.getElementById('custom-monthday-input').value = '';
}));
document.querySelectorAll('.cwd-chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.cwd-chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedCustomWeekDay = parseInt(btn.dataset.day);
}));
document.getElementById('custom-value-input').addEventListener('input', e => {
  const v = parseInt(e.target.value);
  selectedCustomValue = (v >= 1 && v <= 99) ? v : 1;
});
document.getElementById('custom-monthday-input').addEventListener('input', e => {
  const v = parseInt(e.target.value);
  selectedCustomMonthDay = (v >= 1 && v <= 28) ? v : null;
});
document.querySelectorAll('.emoji-grid span').forEach(span => span.addEventListener('click', () => {
  document.querySelectorAll('.emoji-grid span').forEach(s => s.classList.remove('selected'));
  span.classList.add('selected'); selectedEmoji = span.dataset.e;
}));

document.getElementById('save-care').addEventListener('click', () => {
  const name = document.getElementById('care-name').value.trim();
  const time = document.getElementById('care-time').value;
  if (!name)         { showToast('Escribe un nombre'); return; }
  if (!selectedZone) { showToast('Elige una zona'); return; }
  if (!selectedTime) { showToast('Elige mañana o noche'); return; }
  if (!selectedFreq) { showToast('Elige una frecuencia'); return; }
  if (selectedFreq === 'Quincenal' && selectedWeekDay === null) { showToast('Elige el día de la semana'); return; }
  if (selectedFreq === 'Mensual' && !selectedMonthDay) { showToast('Indica el día del mes (1–28)'); return; }
  if (selectedFreq === 'Personalizado') {
    if (!selectedCustomUnit)                                                { showToast('Elige días, semanas o meses'); return; }
    if (!selectedCustomValue || selectedCustomValue < 1)                    { showToast('Indica cada cuánto'); return; }
    if (selectedCustomUnit === 'semanas' && selectedCustomWeekDay === null)  { showToast('Elige el día de la semana'); return; }
    if (selectedCustomUnit === 'meses'   && !selectedCustomMonthDay)         { showToast('Indica el día del mes (1–28)'); return; }
  }

  if (editingId) {
    const r = state.routines.find(r => r.id === editingId);
    if (r) {
      r.name = name; r.emoji = selectedEmoji; r.zone = selectedZone;
      r.timeOfDay = selectedTime; r.freq = selectedFreq; r.reminderTime = time;
      r.weekDay        = selectedFreq === 'Quincenal'     ? selectedWeekDay        : undefined;
      r.monthDay       = selectedFreq === 'Mensual'       ? selectedMonthDay       : undefined;
      r.customValue    = selectedFreq === 'Personalizado' ? selectedCustomValue    : undefined;
      r.customUnit     = selectedFreq === 'Personalizado' ? selectedCustomUnit     : undefined;
      r.customWeekDay  = (selectedFreq === 'Personalizado' && selectedCustomUnit === 'semanas') ? selectedCustomWeekDay  : undefined;
      r.customMonthDay = (selectedFreq === 'Personalizado' && selectedCustomUnit === 'meses')   ? selectedCustomMonthDay : undefined;
    }
    showToast('✏️ Rutina actualizada');
  } else {
    state.routines.push({
      id: Date.now().toString(), name, emoji: selectedEmoji,
      zone: selectedZone, timeOfDay: selectedTime,
      freq: selectedFreq, reminderTime: time, enabled: true,
      ...(selectedFreq === 'Quincenal'     ? { weekDay: selectedWeekDay }                                                     : {}),
      ...(selectedFreq === 'Mensual'       ? { monthDay: selectedMonthDay }                                                   : {}),
      ...(selectedFreq === 'Personalizado' ? { customValue: selectedCustomValue, customUnit: selectedCustomUnit,
          ...(selectedCustomUnit === 'semanas' ? { customWeekDay: selectedCustomWeekDay }   : {}),
          ...(selectedCustomUnit === 'meses'   ? { customMonthDay: selectedCustomMonthDay } : {}) } : {})
    });
    showToast('✨ Rutina guardada');
  }
  save();
  document.getElementById('modal-overlay').classList.remove('open');
  renderRoutines(); renderToday(); scheduleNotifications();
});

// ── NAVIGATION ─────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    if (view === 'history')  renderHistCalendar();
    if (view === 'routines') renderRoutines();
    if (view === 'today')    renderToday();
  });
});

// ── TOAST ──────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── NOTIFICATIONS ──────────────────────────────────────────────
let _notifTimers = [], _midnightTimer = null;

async function requestNotifications() {
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  state.notificationsEnabled = perm === 'granted';
  save();
  if (perm === 'granted') scheduleNotifications();
}

async function scheduleNotifications() {
  _notifTimers.forEach(clearTimeout);
  _notifTimers = [];
  clearTimeout(_midnightTimer);

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const todayRoutines = state.routines.filter(isRoutineActiveToday);

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'SCHEDULE', routines: todayRoutines });
  } else {
    const now = new Date();
    todayRoutines.forEach(r => {
      if (!r.reminderTime) return;
      const [hh, mm] = r.reminderTime.split(':').map(Number);
      const target = new Date(); target.setHours(hh, mm, 0, 0);
      const delay = target - now;
      if (delay <= 0) return;
      const t = setTimeout(() => {
        new Notification(`Glow ✨ – ${r.name}`, {
          body: `Tu cuidado de ${r.zone.toLowerCase()} te espera 🌸`,
          icon: '/icons/icon-192.png',
          tag: r.id,
          vibrate: [200, 100, 200]
        });
      }, delay);
      _notifTimers.push(t);
    });
  }

  // Re-schedule at midnight so the next day's routines are picked up
  const now = new Date();
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  _midnightTimer = setTimeout(scheduleNotifications, midnight - now + 1000);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => {
    if (!state.notificationsEnabled && Notification.permission === 'default')
      setTimeout(requestNotifications, 1500);
    else if (Notification.permission === 'granted')
      scheduleNotifications();
  });
}

// ── INIT ───────────────────────────────────────────────────────
if (state.routines.length === 0) {
  const seeds = [
    { name: 'Limpieza facial',  emoji: '🧼', zone: 'Cara', timeOfDay: 'Ambos',  freq: 'Diario',      reminderTime: '07:30' },
    { name: 'Hidratante SPF',   emoji: '🧴', zone: 'Cara', timeOfDay: 'Mañana', freq: 'Diario',      reminderTime: '08:00' },
    { name: 'Sérum vitamina C', emoji: '✨', zone: 'Cara', timeOfDay: 'Mañana', freq: 'Diario',      reminderTime: '08:05' },
    { name: 'Crema de noche',   emoji: '🌙', zone: 'Cara', timeOfDay: 'Noche',  freq: 'Diario',      reminderTime: '22:00' },
    { name: 'Exfoliación',      emoji: '🫧', zone: 'Cara', timeOfDay: 'Noche',  freq: 'Lun,Mié,Vie', reminderTime: '21:30' },
  ];
  seeds.forEach((s, i) => state.routines.push({ id: (Date.now() - i*10000).toString(), ...s, enabled: true }));
  save();
}

renderToday();
