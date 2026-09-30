(function () {
    const token = new URLSearchParams(window.location.search).get('token');
    const states = ['Confirm', 'Done', 'Resub', 'Error'];

    function show(name) {
        states.forEach(s => {
            document.getElementById('state' + s).style.display = s === name ? '' : 'none';
        });
    }

    function fail(message) {
        document.getElementById('errorText').textContent = message;
        show('Error');
    }

    // POST only (never GET), so mail scanners that prefetch links can't unsubscribe anyone
    async function post(action) {
        const res = await fetch('/api/email/' + action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
    }

    async function run(action, nextState, btn) {
        btn.disabled = true;
        try {
            await post(action);
            show(nextState);
        } catch (e) {
            fail(e.message);
        } finally {
            btn.disabled = false;
        }
    }

    const confirmBtn = document.getElementById('confirmBtn');
    const resubBtn   = document.getElementById('resubBtn');
    confirmBtn.addEventListener('click', () => run('unsubscribe', 'Done', confirmBtn));
    resubBtn.addEventListener('click',   () => run('resubscribe', 'Resub', resubBtn));

    if (!token) fail('This link is invalid or has expired.');
    else show('Confirm');
})();
