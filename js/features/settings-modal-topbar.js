(function () {
    'use strict';

    var MODALS = {
        'appearance-modal': {
            parent: 'settings-modal',
            icon: 'fa-palette',
            fallbackTitle: '\u5916\u89c2\u8bbe\u7f6e',
            legacy: ['back-appearance', 'close-appearance']
        },
        'chat-modal': {
            parent: 'settings-modal',
            icon: 'fa-comments',
            fallbackTitle: '\u804a\u5929\u8bbe\u7f6e',
            legacy: ['back-chat', 'close-chat']
        },
        'advanced-modal': {
            parent: 'settings-modal',
            icon: 'fa-tools',
            fallbackTitle: '\u9ad8\u7ea7\u529f\u80fd',
            legacy: ['back-advanced', 'close-advanced']
        },
        'custom-replies-modal': {
            parent: 'advanced-modal',
            icon: 'fa-layer-group',
            fallbackTitle: '\u5185\u5bb9\u7ba1\u7406',
            legacy: ['close-custom-replies']
        },
        'stats-modal': {
            parent: 'advanced-modal',
            icon: 'fa-chart-bar',
            fallbackTitle: '\u6d88\u606f\u7edf\u8ba1 & \u6536\u85cf',
            legacy: ['close-stats']
        },
        'mood-modal': {
            parent: 'advanced-modal',
            icon: 'fa-book-open',
            fallbackTitle: '\u5fc3\u6674\u624b\u8d26',
            legacy: ['close-mood']
        },
        'anniversary-modal': {
            parent: 'advanced-modal',
            icon: 'fa-heart',
            fallbackTitle: '\u91cd\u8981\u65e5',
            legacy: ['close-anniversary-modal']
        },
        'decision-menu-modal': {
            parent: 'advanced-modal',
            icon: 'fa-balance-scale',
            fallbackTitle: '\u6289\u62e9',
            legacy: ['close-decision-menu']
        },
        'fortune-lenormand-modal': {
            parent: 'advanced-modal',
            icon: 'fa-star-and-crescent',
            fallbackTitle: '\u8fd0\u52bf\u5360\u535c',
            legacy: ['close-fortune', 'close-lenormand', 'close-tarot-divination', 'close-divihistory']
        },
        'theme-editor-modal': {
            parent: 'appearance-modal',
            icon: 'fa-code',
            fallbackTitle: '\u5168\u5c40\u4e3b\u9898 CSS',
            legacy: ['close-theme-editor']
        },
        'companion-diary-modal': {
            parent: 'advanced-modal',
            icon: 'fa-book',
            fallbackTitle: '\u966a\u4f34\u65e5\u8bb0',
            legacy: ['cd-back-btn', 'close-companion-diary']
        },
        'period-modal': {
            parent: 'advanced-modal',
            icon: 'fa-droplet',
            fallbackTitle: '\u6708\u7ecf\u8bb0\u5f55',
            legacy: ['period-back-btn', 'period-close-bottom-btn']
        },
        'group-chat-modal': {
            parent: 'chat-modal',
            icon: 'fa-users',
            fallbackTitle: '\u7fa4\u804a\u8bbe\u7f6e',
            legacy: ['close-group-chat']
        }
    };

    function getModalTitle(modal, config) {
        var titleNode = modal.querySelector('.modal-title span, .modal-title');
        var title = titleNode ? titleNode.textContent.trim() : '';
        return title || config.fallbackTitle;
    }

    function hideCurrentAndShow(modal, targetId) {
        var target = document.getElementById(targetId);
        if (typeof hideModal === 'function') hideModal(modal);
        else modal.style.display = 'none';

        if (target) {
            if (typeof showModal === 'function') showModal(target);
            else target.style.display = 'flex';
        }
    }

    function closeModal(modal) {
        if (typeof hideModal === 'function') hideModal(modal);
        else modal.style.display = 'none';
    }

    function markLegacyButtons(modal, config) {
        (config.legacy || []).forEach(function (id) {
            var button = document.getElementById(id);
            if (button && modal.contains(button)) {
                button.setAttribute('data-settings-topbar-legacy-nav', 'true');
            }
        });

        modal.querySelectorAll('.modal-buttons, .ann-footer, .period-footer, .cs-footer').forEach(function (area) {
            var buttons = Array.prototype.slice.call(area.querySelectorAll('button'));
            if (!buttons.length) return;
            var allHidden = buttons.every(function (button) {
                return button.getAttribute('data-settings-topbar-legacy-nav') === 'true';
            });
            if (allHidden) area.classList.add('settings-topbar-empty-actions');
        });
    }

    function ensureTopbar(modal, config) {
        var content = modal.querySelector('.modal-content');
        if (!content || content.querySelector(':scope > .settings-modal-topbar')) return;

        content.classList.add('settings-topbar-host');

        var topbar = document.createElement('div');
        topbar.className = 'settings-modal-topbar';
        topbar.innerHTML =
            '<div class="settings-modal-topbar-left">' +
                '<button type="button" class="settings-modal-topbar-back" aria-label="Back">' +
                    '<i class="fas fa-arrow-left"></i>' +
                '</button>' +
                '<span class="settings-modal-topbar-title">' +
                    '<i class="fas ' + config.icon + '"></i>' +
                    '<span></span>' +
                '</span>' +
            '</div>' +
            '<button type="button" class="settings-modal-topbar-close" aria-label="Close">' +
                '<i class="fas fa-xmark"></i>' +
            '</button>';

        topbar.querySelector('.settings-modal-topbar-title span').textContent = getModalTitle(modal, config);
        content.insertBefore(topbar, content.firstChild);

        topbar.querySelector('.settings-modal-topbar-back').addEventListener('click', function () {
            hideCurrentAndShow(modal, modal.dataset.settingsParentModal || config.parent);
        });
        topbar.querySelector('.settings-modal-topbar-close').addEventListener('click', function () {
            closeModal(modal);
        });

        markLegacyButtons(modal, config);
    }

    function applyAll() {
        Object.keys(MODALS).forEach(function (id) {
            var modal = document.getElementById(id);
            if (modal) ensureTopbar(modal, MODALS[id]);
        });
    }

    function trackSettingParents() {
        var triggerParents = {
            'custom-replies-function': 'advanced-modal',
            'stats-function': 'advanced-modal',
            'envelope-function': 'advanced-modal',
            'mood-function': 'advanced-modal',
            'anniversary-function': 'advanced-modal',
            'decision-function': 'advanced-modal',
            'fortune-lenormand-function': 'advanced-modal',
            'companion-diary-function': 'advanced-modal',
            'period-function': 'advanced-modal',
            'open-theme-editor': 'appearance-modal',
            'group-chat-toggle': 'chat-modal'
        };

        var targetModals = {
            'custom-replies-function': 'custom-replies-modal',
            'stats-function': 'stats-modal',
            'envelope-function': 'envelope-modal',
            'mood-function': 'mood-modal',
            'anniversary-function': 'anniversary-modal',
            'decision-function': 'decision-menu-modal',
            'fortune-lenormand-function': 'fortune-lenormand-modal',
            'companion-diary-function': 'companion-diary-modal',
            'period-function': 'period-modal',
            'open-theme-editor': 'theme-editor-modal',
            'group-chat-toggle': 'group-chat-modal'
        };

        document.addEventListener('click', function (event) {
            var trigger = event.target.closest('[id]');
            if (!trigger) return;
            var parentId = triggerParents[trigger.id];
            var modalId = targetModals[trigger.id];
            if (!parentId || !modalId) return;
            var modal = document.getElementById(modalId);
            if (modal) modal.dataset.settingsParentModal = parentId;
        }, true);
    }

    function wrapShowModal() {
        if (typeof window.showModal !== 'function' || window.showModal.__settingsTopbarWrapped) return;
        var originalShowModal = window.showModal;
        window.showModal = function (modal) {
            if (modal && modal.id && MODALS[modal.id]) ensureTopbar(modal, MODALS[modal.id]);
            return originalShowModal.apply(this, arguments);
        };
        window.showModal.__settingsTopbarWrapped = true;
    }

    function init() {
        applyAll();
        trackSettingParents();
        wrapShowModal();

        var observer = new MutationObserver(function () {
            applyAll();
            wrapShowModal();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
