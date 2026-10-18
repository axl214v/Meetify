// Anonymous feedback form. Nothing here identifies the sender: no cookies are sent, no account is read.
(function () {
    const form = document.getElementById('fbForm');
    const done = document.getElementById('fbDone');
    const err = document.getElementById('fbError');
    const submit = document.getElementById('fbSubmit');
    const ratingBtns = Array.from(document.querySelectorAll('#fbRating .btn'));
    let rating = null;

    ratingBtns.forEach(b => b.addEventListener('click', () => {
        const v = Number(b.dataset.v);
        rating = rating === v ? null : v;
        ratingBtns.forEach(x => {
            const on = Number(x.dataset.v) === rating;
            x.setAttribute('aria-checked', String(on));
            x.classList.toggle('btn-primary', on);
        });
    }));

    function showError(msg) { err.textContent = msg; err.hidden = !msg; }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('');
        const message = document.getElementById('fbMessage').value.trim();
        if (message.length < 3) { showError('Please write a few words.'); return; }

        submit.disabled = true;
        submit.textContent = 'Sending...';
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                credentials: 'omit',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rating,
                    category: document.getElementById('fbCategory').value,
                    message,
                    contact: document.getElementById('fbContact').value.trim(),
                    website: document.getElementById('fbWebsite').value
                })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Could not send. Please try again.');
            }
            form.hidden = true;
            done.hidden = false;
        } catch (ex) {
            showError(ex.message);
            submit.disabled = false;
            submit.textContent = 'Send feedback';
        }
    });
})();
