// Utilitaires partagés pour la pagination (admin client-side, dashboard server-side).
(() => {
  'use strict';

  const PAGE_SIZE_OPTIONS = [10, 25, 50];
  const MAX_NUMBERED_BUTTONS = 5;
  /** À partir de ce nombre de pages : saisie directe en complément des numéros. */
  const MANY_PAGES_THRESHOLD = 8;

  const buildPageList = (currentPage, totalPages) => {
    if (totalPages <= MAX_NUMBERED_BUTTONS + 2) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [1];
    const windowSize = Math.floor(MAX_NUMBERED_BUTTONS / 2);
    let start = Math.max(2, currentPage - windowSize);
    let end = Math.min(totalPages - 1, currentPage + windowSize);

    if (currentPage <= windowSize + 1) {
      end = MAX_NUMBERED_BUTTONS;
    }
    if (currentPage >= totalPages - windowSize) {
      start = totalPages - MAX_NUMBERED_BUTTONS + 1;
    }

    if (start > 2) pages.push('…');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('…');
    pages.push(totalPages);

    return pages;
  };

  const buildPageButtonsHtml = (currentPage, totalPages) => (
    buildPageList(currentPage, totalPages).map((page) => {
      if (page === '…') {
        return '<span class="pagination-ellipsis" aria-hidden="true">…</span>';
      }
      const isActive = page === currentPage ? ' is-active' : '';
      const ariaCurrent = page === currentPage ? ' aria-current="page"' : '';
      return `<button type="button"
                      class="pagination-number-btn${isActive}"
                      data-page="${page}"
                      aria-label="Page ${page}"${ariaCurrent}>${page}</button>`;
    }).join('')
  );

  const buildPageJumpHtml = (currentPage, totalPages) => (
    `<div class="dashboard-page-jump dashboard-page-jump--inline">
      <input type="number"
             class="dashboard-page-input"
             min="1"
             max="${totalPages}"
             value="${currentPage}"
             inputmode="numeric"
             aria-label="Aller à la page">
      <span class="dashboard-page-total">sur ${totalPages}</span>
    </div>`
  );

  const buildPaginationMiddleHtml = (currentPage, totalPages) => {
    const buttons = buildPageButtonsHtml(currentPage, totalPages);
    if (totalPages < MANY_PAGES_THRESHOLD) return buttons;
    return `${buttons}${buildPageJumpHtml(currentPage, totalPages)}`;
  };

  const readStoredPageSize = (storageKey, fallback = 10) => {
    try {
      const stored = Number(sessionStorage.getItem(storageKey));
      return PAGE_SIZE_OPTIONS.includes(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  };

  const writeStoredPageSize = (storageKey, pageSize) => {
    try {
      sessionStorage.setItem(storageKey, String(pageSize));
    } catch {
      // sessionStorage indisponible : on ignore.
    }
  };

  const fillPaginationNumbers = (container, currentPage, totalPages) => {
    container.innerHTML = '';
    container.className = 'dashboard-pagination__numbers';
    if (totalPages >= MANY_PAGES_THRESHOLD) {
      container.classList.add('dashboard-pagination__numbers--with-jump');
    }

    buildPageList(currentPage, totalPages).forEach((page) => {
      if (page === '…') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        container.append(ellipsis);
        return;
      }
      const pageBtn = document.createElement('button');
      pageBtn.type = 'button';
      pageBtn.className = 'pagination-number-btn';
      pageBtn.dataset.page = String(page);
      pageBtn.textContent = String(page);
      pageBtn.setAttribute('aria-label', `Page ${page}`);
      if (page === currentPage) {
        pageBtn.classList.add('is-active');
        pageBtn.setAttribute('aria-current', 'page');
      }
      container.append(pageBtn);
    });

    if (totalPages < MANY_PAGES_THRESHOLD) return null;

    const jump = document.createElement('div');
    jump.className = 'dashboard-page-jump dashboard-page-jump--inline';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'dashboard-page-input';
    input.min = '1';
    input.max = String(totalPages);
    input.value = String(currentPage);
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', 'Aller à la page');

    const totalSpan = document.createElement('span');
    totalSpan.className = 'dashboard-page-total';
    totalSpan.textContent = `sur ${totalPages}`;

    jump.append(input, totalSpan);
    container.append(jump);
    return input;
  };

  const bindPageJumpInput = (input, { getCurrentPage, onSubmit }) => {
    if (!input) return;

    const submit = () => {
      const requested = Number.parseInt(input.value, 10);
      if (Number.isNaN(requested)) {
        input.value = String(getCurrentPage());
        return;
      }
      onSubmit(requested);
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
        input.blur();
      }
    });
    input.addEventListener('change', submit);
    input.addEventListener('blur', () => {
      input.value = String(getCurrentPage());
    });
  };

  /**
   * Génère le HTML de la barre de pagination dashboard (classes existantes).
   * @param {object} pagination - objet renvoyé par l'API dashboard
   * @param {number} activePageSize - taille de page courante (UI)
   */
  const renderDashboardPaginationHtml = (pagination, activePageSize) => {
    if (!pagination || pagination.totalReports === 0) {
      return '<div class="pagination-summary">Aucun rapport à afficher</div>';
    }

    const {
      currentPage,
      totalPages,
      totalReports,
      startItem,
      endItem,
      hasPreviousPage,
      hasNextPage
    } = pagination;

    const singlePage = totalPages <= 1;
    const withJump = totalPages >= MANY_PAGES_THRESHOLD;

    const summary = singlePage
      ? `<strong>${totalReports}</strong> ligne${totalReports > 1 ? 's' : ''}`
      : `Rapports <strong>${startItem}</strong> à <strong>${endItem}</strong> sur <strong>${totalReports}</strong>`;

    const sizeButtons = PAGE_SIZE_OPTIONS.map((size) => (
      `<button type="button"
               class="pagination-size-btn${size === activePageSize ? ' is-active' : ''}"
               data-page-size="${size}"
               aria-label="${size} lignes par page"
               aria-pressed="${size === activePageSize ? 'true' : 'false'}">${size}</button>`
    )).join('');

    let navHtml = '';
    if (!singlePage) {
      const firstDisabled = hasPreviousPage ? '' : ' disabled';
      const prevDisabled = hasPreviousPage ? '' : ' disabled';
      const nextDisabled = hasNextPage ? '' : ' disabled';
      const lastDisabled = hasNextPage ? '' : ' disabled';

      const middleHtml = buildPaginationMiddleHtml(currentPage, totalPages);

      navHtml = `
        <nav class="pagination-controls dashboard-pagination__nav" aria-label="Navigation entre les pages de rapports">
          <button type="button" class="pagination-btn pagination-edge-btn${firstDisabled}"
                  data-page="1" aria-label="Première page"${firstDisabled ? ' disabled' : ''}>
            <i class="fas fa-angle-double-left" aria-hidden="true"></i>
          </button>
          <button type="button" class="pagination-btn${prevDisabled}"
                  data-page="${currentPage - 1}" aria-label="Page précédente"${prevDisabled ? ' disabled' : ''}>
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
            <span class="pagination-btn-text">Précédent</span>
          </button>
          <div class="dashboard-pagination__numbers${withJump ? ' dashboard-pagination__numbers--with-jump' : ''}">
            ${middleHtml}
          </div>
          <button type="button" class="pagination-btn${nextDisabled}"
                  data-page="${currentPage + 1}" aria-label="Page suivante"${nextDisabled ? ' disabled' : ''}>
            <span class="pagination-btn-text">Suivant</span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
          <button type="button" class="pagination-btn pagination-edge-btn${lastDisabled}"
                  data-page="${totalPages}" aria-label="Dernière page"${lastDisabled ? ' disabled' : ''}>
            <i class="fas fa-angle-double-right" aria-hidden="true"></i>
          </button>
        </nav>`;
    }

    return `
      <div class="dashboard-pagination__left">
        <span class="pagination-summary">${summary}</span>
        <div class="dashboard-pagination__size">
          <span class="dashboard-pagination__size-label">Lignes par page</span>
          <div class="dashboard-page-size-options" role="group" aria-label="Nombre de lignes par page">
            ${sizeButtons}
          </div>
        </div>
      </div>
      ${navHtml}`;
  };

  /** @returns {boolean} true si la saisie directe de page est affichée (8+ pages). */
  const isManyPages = (totalPages) => totalPages >= MANY_PAGES_THRESHOLD;

  window.VirgaPaginationUi = {
    PAGE_SIZE_OPTIONS,
    MANY_PAGES_THRESHOLD,
    buildPageList,
    buildPaginationMiddleHtml,
    fillPaginationNumbers,
    bindPageJumpInput,
    readStoredPageSize,
    writeStoredPageSize,
    renderDashboardPaginationHtml,
    isManyPages
  };
})();
