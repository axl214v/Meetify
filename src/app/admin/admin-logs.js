// Error Logs tab — uses apiFetch, escHtml, toast, fmtDate, showConfirmModal from admin.js

const logsState = {
    loaded: false,
    filters: { severity: '', type: '', date: '' },
    entries: [],   // error entries indexed by row position
};

async function loadLogsTab() {
    await Promise.all([loadLogStats(), loadLogErrors()]);
    logsState.loaded = true;
}

async function loadLogStats() {
    const el = document.getElementById('logsStatsArea');
    if (!el) return;
    try {
        const res  = await apiFetch('/api/logs/stats');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed');

        const sev = data.bySeverity || {};
        const typ = data.byType    || {};

        document.getElementById('logStatTotal').textContent   = fmt(data.totalErrors || 0);
        document.getElementById('logStatError').textContent   = fmt(sev.error   || 0);
        document.getElementById('logStatWarn').textContent    = fmt(sev.warning  || 0);
        document.getElementById('logStatInfo').textContent    = fmt(sev.info     || 0);
        document.getElementById('logStatUpdated').textContent =
            data.lastUpdated ? fmtDate(data.lastUpdated) : '—';

        renderLogTypeBreakdown(typ);
        renderTopErrors(data.topErrors || []);
        renderDateSparkline(data.byDate || {});
    } catch (e) {
        el.innerHTML = `<p class="logs-error">Failed to load stats: ${escHtml(e.message)}</p>`;
    }
}

function renderLogTypeBreakdown(byType) {
    const el = document.getElementById('logTypeBreakdown');
    if (!el) return;
    const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { el.innerHTML = '<span class="logs-empty">No data</span>'; return; }
    const total = entries.reduce((s, [, n]) => s + n, 0);
    el.innerHTML = entries.map(([type, count]) => {
        const pct = total ? Math.round(count / total * 100) : 0;
        return `<div class="log-type-row">
            <span class="log-type-name">${escHtml(type)}</span>
            <div class="log-type-bar-wrap">
                <div class="log-type-bar" style="width:${pct}%"></div>
            </div>
            <span class="log-type-count">${fmt(count)}</span>
        </div>`;
    }).join('');
}

function renderTopErrors(topErrors) {
    const tbody = document.getElementById('topErrorsBody');
    if (!tbody) return;
    if (!topErrors.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="logs-empty-cell">No errors recorded</td></tr>';
        return;
    }
    tbody.innerHTML = topErrors.slice(0, 15).map(e => `
        <tr>
            <td class="mono logs-msg-cell" title="${escHtml(e.message)}">${escHtml(e.message.slice(0, 80))}${e.message.length > 80 ? '…' : ''}</td>
            <td><span class="log-badge log-badge-type">${escHtml(e.type || '—')}</span></td>
            <td><span class="log-badge log-sev-${escHtml(e.severity || 'info')}">${escHtml(e.severity || '—')}</span></td>
            <td class="log-count-cell">${fmt(e.count)}</td>
            <td class="logs-date-cell">${e.lastSeen ? fmtDate(e.lastSeen) : '—'}</td>
        </tr>`).join('');
}

function renderDateSparkline(byDate) {
    const el = document.getElementById('logDateChart');
    if (!el) return;
    const dates = Object.keys(byDate).sort().slice(-14);
    if (!dates.length) { el.innerHTML = '<span class="logs-empty">No date data</span>'; return; }
    const max = Math.max(...dates.map(d => byDate[d]), 1);
    el.innerHTML = `<div class="sparkline-wrap">` +
        dates.map(d => {
            const h = Math.max(4, Math.round(byDate[d] / max * 60));
            return `<div class="spark-col" title="${escHtml(d)}: ${byDate[d]}">
                <div class="spark-bar" style="height:${h}px"></div>
                <div class="spark-label">${d.slice(5)}</div>
            </div>`;
        }).join('') +
        `</div>`;
}

async function loadLogErrors() {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="logs-empty-cell">Loading…</td></tr>';

    const { severity, type, date } = logsState.filters;
    const params = new URLSearchParams({ limit: 200 });
    if (severity) params.set('severity', severity);
    if (type)     params.set('type', type);
    if (date)     params.set('date', date);

    try {
        const res  = await apiFetch('/api/logs/errors?' + params);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed');

        const errors = (data.errors || []).slice().reverse(); // newest first
        logsState.entries = errors;
        document.getElementById('logsTotalCount').textContent = `${errors.length} entries`;

        if (!errors.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="logs-empty-cell">No errors match the current filters</td></tr>';
            return;
        }

        tbody.innerHTML = errors.map((e, i) => `
            <tr class="log-row-${escHtml(e.severity || 'info')}" onclick="showLogDetailByIndex(${i})" style="cursor:pointer">
                <td class="logs-date-cell">${e.serverTimestamp ? fmtDate(e.serverTimestamp) : fmtDate(e.timestamp)}</td>
                <td><span class="log-sev-${escHtml(e.severity || 'info')} log-badge">${escHtml(e.severity || '—')}</span></td>
                <td><span class="log-badge log-badge-type">${escHtml(e.type || '—')}</span></td>
                <td class="logs-msg-cell">${escHtml((e.message || '—').slice(0, 100))}${(e.message||'').length > 100 ? '…' : ''}</td>
                <td class="logs-url-cell">${escHtml(urlPath(e.url))}</td>
            </tr>`).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="logs-empty-cell" style="color:var(--danger)">${escHtml(e.message)}</td></tr>`;
    }
}

function urlPath(url) {
    if (!url) return '—';
    try { return new URL(url).pathname; } catch { return url.slice(0, 40); }
}

function showLogDetailByIndex(i) {
    const entry = logsState.entries[i];
    if (!entry) return;
    showLogDetailEntry(entry);
}

function showLogDetailEntry(entry) {
    try {
        const lines = [
            `Time:     ${entry.serverTimestamp || entry.timestamp || '—'}`,
            `Severity: ${entry.severity || '—'}`,
            `Type:     ${entry.type || '—'}`,
            `Message:  ${entry.message || '—'}`,
            `URL:      ${entry.url || '—'}`,
            `Browser:  ${entry.browser?.name} ${entry.browser?.version || ''}`,
            `User:     ${entry.userId || 'guest'} | Session: ${entry.sessionId || '—'}`,
            ``,
            entry.stack ? `Stack:\n${entry.stack}` : '',
        ].filter(l => l !== undefined).join('\n');
        document.getElementById('logDetailPre').textContent = lines;
        document.getElementById('logDetailModal').classList.add('active');
    } catch { /* ignore */ }
}

function closeLogDetail() {
    document.getElementById('logDetailModal').classList.remove('active');
}

function applyLogFilters() {
    logsState.filters.severity = document.getElementById('logFilterSev').value;
    logsState.filters.type     = document.getElementById('logFilterType').value;
    logsState.filters.date     = document.getElementById('logFilterDate').value;
    loadLogErrors();
}

function clearLogFilters() {
    document.getElementById('logFilterSev').value  = '';
    document.getElementById('logFilterType').value = '';
    document.getElementById('logFilterDate').value = '';
    logsState.filters = { severity: '', type: '', date: '' };
    loadLogErrors();
}

function confirmClearLogs() {
    showConfirmModal('⚠', 'Clear error logs', 'This will permanently delete all client error logs and reset statistics. This cannot be undone.', clearAllLogs);
}

async function clearAllLogs() {
    try {
        const res  = await apiFetch('/api/logs/errors', { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed');
        toast('Logs cleared', 'success');
        loadLogsTab();
    } catch (e) {
        toast('Failed to clear logs: ' + e.message, 'error');
    }
}
