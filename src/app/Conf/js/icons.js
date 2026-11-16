// Inline SVG icons for the room UI (stroke style, inherit currentColor). Replaces emoji.
(function () {
    const svg = (body, size = 18) =>
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

    const MIC = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>';
    const CAM = '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3"/>';
    const SLASH = '<path d="M4 4l16 16"/>';

    // Raise hand and reactions (content, not interface chrome): drawn in the same stroke style, no emoji
    const REACTION_BODIES = {
        'thumbs-up': '<path d="M7 11v9H4.5a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 4.5 11H7z"/><path d="M7 11l3.6-7a2 2 0 0 1 2.4 2v3.5h5a2 2 0 0 1 2 2.3l-1 6.2a2 2 0 0 1-2 1.7H7"/>',
        'clap': '<path d="M5 12.5l-1.2-1.2a1.6 1.6 0 0 1 2.3-2.3l3 3"/><path d="M9.1 12l3.7-3.7a1.6 1.6 0 0 1 2.3 2.3L12 13.7"/><path d="M15 10.6l1.9 1.9a5.2 5.2 0 0 1-7.4 7.4l-4.2-4.2"/><path d="M5.5 4.5l.8 1.6M9 3v2M2.5 8h2"/>',
        'heart': '<path d="M12 20.5S4 15.6 4 9.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.6c0 6-8 10.9-8 10.9z"/>',
        'laugh': '<circle cx="12" cy="12" r="9"/><path d="M8.5 9.5h.01M15.5 9.5h.01"/><path d="M7.5 13.5h9a4.5 4.5 0 0 1-9 0z"/>',
        'surprise': '<circle cx="12" cy="12" r="9"/><path d="M8.5 9.5h.01M15.5 9.5h.01"/><circle cx="12" cy="15.5" r="2"/>',
        'question': '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17h.01"/>'
    };
    const HAND = '<path d="M8.5 13V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11.5 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14.5 11V6a1.5 1.5 0 0 1 3 0v7"/><path d="M8.5 13l-1.4-2.1a1.5 1.5 0 0 0-2.5 1.6l2.9 5.2C8.7 19.8 10.4 21 12.6 21h.9a5 5 0 0 0 5-5v-3"/>';

    window.Icons = {
        lock:      svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 16),
        pip:       svg('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor"/>', 18),
        hand:      svg(HAND),
        handSmall: svg(HAND, 14),
        reaction:  (name, size = 18) => svg(REACTION_BODIES[name] || '', size),
        mic:       svg(MIC),
        micOff:    svg(MIC + SLASH),
        cam:       svg(CAM),
        camOff:    svg(CAM + SLASH),
        screen:    svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
        screenStop:svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><rect x="10" y="7.5" width="4" height="4" rx="0.5" fill="currentColor"/>'),
        users:     svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>'),
        chat:      svg('<path d="M4 5h16v11H9l-5 4z"/>'),
        pin:       svg('<path d="M15 4l5 5-3 1-3.5 3.5.5 4-1.5 1.5-3.5-3.5L5 20l4.5-4.5L6 12l1.5-1.5 4 .5L15 7z"/>', 14),
        pinOn:     svg('<path d="M15 4l5 5-3 1-3.5 3.5.5 4-1.5 1.5-3.5-3.5L5 20l4.5-4.5L6 12l1.5-1.5 4 .5L15 7z" fill="currentColor"/>', 14),
        crown:     svg('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', 14),
        shield:    svg('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>', 14),
        more:      svg('<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>', 16),
        link:      svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
        close:     svg('<path d="M6 6l12 12M18 6L6 18"/>', 16),
        leave:     svg('<path d="M10.7 13.3a16 16 0 0 1-2.4-3l1.5-1.5a1.5 1.5 0 0 0 .3-1.6L9 4.5A1.5 1.5 0 0 0 7.4 3.5L4.6 4A2 2 0 0 0 3 6c.6 8.4 7.6 15.4 16 16a2 2 0 0 0 2-1.6l.5-2.8a1.5 1.5 0 0 0-1-1.6l-3.2-1.1a1.5 1.5 0 0 0-1.6.3l-1.5 1.5"/>', 18)
    };
    document.querySelectorAll('[data-icon]').forEach(el => { if (window.Icons[el.dataset.icon]) el.innerHTML = window.Icons[el.dataset.icon]; });
})();
