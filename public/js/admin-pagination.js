// Pagination client des tableaux admin — mêmes composants visuels que le dashboard.

(() => {
  'use strict';

  const ui = window.VirgaPaginationUi;
  const DEFAULT_PAGE_SIZE = 10;
  const PAGE_SIZE_OPTIONS = ui?.PAGE_SIZE_OPTIONS || [10, 25, 50];
  const fillPaginationNumbers = ui?.fillPaginationNumbers;
  const bindPageJumpInput = ui?.bindPageJumpInput;

  const getPageSizeStorageKey = (table, tableIndex) => (
    `admin-pagination:${table.dataset.label || `table-${tableIndex + 1}`}:pageSize`
  );

  const readStoredPageSize = (storageKey) => {
    if (ui?.readStoredPageSize) {
      return ui.readStoredPageSize(storageKey, DEFAULT_PAGE_SIZE);
    }
    try {
      const stored = Number(sessionStorage.getItem(storageKey));
      return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
    } catch {
      return DEFAULT_PAGE_SIZE;
    }
  };

  const writeStoredPageSize = (storageKey, pageSize) => {
    if (ui?.writeStoredPageSize) {
      ui.writeStoredPageSize(storageKey, pageSize);
      return;
    }
    try {
      sessionStorage.setItem(storageKey, String(pageSize));
    } catch {
      // sessionStorage indisponible : on ignore.
    }
  };

  const paginateTable = (table, tableIndex) => {
    const tbody = table.tBodies[0];
    if (!tbody) return;

    const scrollWrapper = table.closest('.overflow-x-auto') || table.parentElement;
    const card = scrollWrapper?.parentElement;
    if (!card) return;

    card.querySelectorAll(':scope > .dashboard-pagination').forEach((node) => node.remove());

    const rows = Array.from(tbody.rows);
    rows.forEach((row) => { row.style.display = ''; });

    scrollWrapper.classList.add('admin-table-viewport');
    table.classList.add('admin-table');

    const total = rows.length;
    if (total === 0) return;

    const storageKey = getPageSizeStorageKey(table, tableIndex);
    let pageSize = readStoredPageSize(storageKey);
    if (!PAGE_SIZE_OPTIONS.includes(pageSize)) {
      pageSize = DEFAULT_PAGE_SIZE;
    }

    let currentPage = 1;
    let totalPages = Math.max(1, Math.ceil(total / pageSize));

    const footer = document.createElement('div');
    footer.className = 'dashboard-pagination admin-table-card__footer';
    footer.setAttribute('aria-label', `Pagination ${table.dataset.label || `tableau ${tableIndex + 1}`}`);

    const left = document.createElement('div');
    left.className = 'dashboard-pagination__left';

    const summary = document.createElement('span');
    summary.className = 'pagination-summary';

    const sizeField = document.createElement('div');
    sizeField.className = 'dashboard-pagination__size';

    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'dashboard-pagination__size-label';
    sizeLabel.textContent = 'Lignes par page';

    const sizeOptions = document.createElement('div');
    sizeOptions.className = 'dashboard-page-size-options';
    sizeOptions.setAttribute('role', 'group');
    sizeOptions.setAttribute('aria-label', 'Nombre de lignes par page');

    const sizeButtons = PAGE_SIZE_OPTIONS.map((optionValue) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pagination-size-btn';
      button.dataset.pageSize = String(optionValue);
      button.textContent = String(optionValue);
      button.setAttribute('aria-label', `${optionValue} lignes par page`);
      return button;
    });

    sizeOptions.append(...sizeButtons);
    sizeField.append(sizeLabel, sizeOptions);
    left.append(summary, sizeField);

    const navMount = document.createElement('div');
    navMount.className = 'admin-table-card__pagination-nav';

    footer.append(left, navMount);
    card.appendChild(footer);

    const scrollToTableStart = () => {
      const anchor = card.querySelector('.admin-table-card__header') || scrollWrapper || card;
      anchor.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (scrollWrapper.scrollLeft) scrollWrapper.scrollLeft = 0;
    };

    const goToPage = (page) => {
      const nextPage = Math.min(Math.max(1, page), totalPages);
      if (nextPage === currentPage) return;
      currentPage = nextPage;
      render();
      requestAnimationFrame(scrollToTableStart);
    };

    const renderNav = (singlePage) => {
      navMount.innerHTML = '';
      if (singlePage) return;

      const nav = document.createElement('nav');
      nav.className = 'pagination-controls dashboard-pagination__nav';
      nav.setAttribute('aria-label', 'Navigation entre les pages');

      const firstBtn = document.createElement('button');
      firstBtn.type = 'button';
      firstBtn.className = 'pagination-btn pagination-edge-btn';
      firstBtn.dataset.page = '1';
      firstBtn.setAttribute('aria-label', 'Première page');
      firstBtn.innerHTML = '<i class="fas fa-angle-double-left" aria-hidden="true"></i>';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'pagination-btn';
      prevBtn.dataset.page = String(currentPage - 1);
      prevBtn.setAttribute('aria-label', 'Page précédente');
      prevBtn.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i><span class="pagination-btn-text">Précédent</span>';

      const numbers = document.createElement('div');
      let jumpInput = null;
      if (fillPaginationNumbers) {
        jumpInput = fillPaginationNumbers(numbers, currentPage, totalPages);
      }

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'pagination-btn';
      nextBtn.dataset.page = String(currentPage + 1);
      nextBtn.setAttribute('aria-label', 'Page suivante');
      nextBtn.innerHTML = '<span class="pagination-btn-text">Suivant</span><i class="fas fa-chevron-right" aria-hidden="true"></i>';

      const lastBtn = document.createElement('button');
      lastBtn.type = 'button';
      lastBtn.className = 'pagination-btn pagination-edge-btn';
      lastBtn.dataset.page = String(totalPages);
      lastBtn.setAttribute('aria-label', 'Dernière page');
      lastBtn.innerHTML = '<i class="fas fa-angle-double-right" aria-hidden="true"></i>';

      nav.append(firstBtn, prevBtn, numbers, nextBtn, lastBtn);
      navMount.append(nav);

      firstBtn.disabled = currentPage === 1;
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
      lastBtn.disabled = currentPage === totalPages;

      nav.querySelectorAll('[data-page]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.disabled) return;
          goToPage(Number(button.dataset.page));
        });
      });

      if (bindPageJumpInput) {
        bindPageJumpInput(jumpInput, {
          getCurrentPage: () => currentPage,
          onSubmit: (page) => goToPage(page)
        });
      }
    };

    const render = () => {
      totalPages = Math.max(1, Math.ceil(total / pageSize));
      const singlePage = totalPages <= 1;

      footer.classList.toggle('dashboard-pagination--single-page', singlePage);
      footer.classList.toggle(
        'dashboard-pagination--many',
        !singlePage && ui?.isManyPages?.(totalPages)
      );

      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);

      rows.forEach((row, index) => {
        row.style.display = singlePage || (index >= startIndex && index < endIndex) ? '' : 'none';
      });

      if (singlePage) {
        summary.innerHTML = `<strong>${total}</strong> ligne${total > 1 ? 's' : ''}`;
      } else {
        summary.innerHTML = `Lignes <strong>${startIndex + 1}</strong> à <strong>${endIndex}</strong> sur <strong>${total}</strong>`;
      }

      sizeButtons.forEach((button) => {
        const value = Number(button.dataset.pageSize);
        const isActive = value === pageSize;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      renderNav(singlePage);
    };

    sizeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextSize = Number(button.dataset.pageSize);
        if (nextSize === pageSize) return;
        pageSize = nextSize;
        writeStoredPageSize(storageKey, pageSize);
        currentPage = 1;
        render();
        requestAnimationFrame(scrollToTableStart);
      });
    });

    render();
  };

  const initAdminPagination = () => {
    const stack = document.querySelector('.reports-section .admin-data-stack');
    if (!stack) return;

    const tables = stack.querySelectorAll('table');
    tables.forEach((table, index) => paginateTable(table, index));
  };

  window.initAdminPagination = initAdminPagination;

  document.addEventListener('DOMContentLoaded', initAdminPagination);
})();
