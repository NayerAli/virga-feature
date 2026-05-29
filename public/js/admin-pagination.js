// Pagination côté client, indépendante par tableau, pour la page d'administration.

(() => {
  'use strict';

  const DEFAULT_PAGE_SIZE = 10;
  const PAGE_SIZE_OPTIONS = [10, 25, 50];
  const MAX_NUMBERED_BUTTONS = 5;
  const MANY_PAGES_THRESHOLD = 7;

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

  const createButton = (html, ariaLabel, extraClass) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-pagination__btn${extraClass ? ` ${extraClass}` : ''}`;
    button.innerHTML = html;
    if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
    return button;
  };

  const getPageSizeStorageKey = (table, tableIndex) => (
    `admin-pagination:${table.dataset.label || `table-${tableIndex + 1}`}:pageSize`
  );

  const readStoredPageSize = (storageKey) => {
    try {
      const stored = Number(sessionStorage.getItem(storageKey));
      return PAGE_SIZE_OPTIONS.includes(stored) ? stored : null;
    } catch {
      return null;
    }
  };

  const paginateTable = (table, tableIndex) => {
    const tbody = table.tBodies[0];
    if (!tbody) return;

    const scrollWrapper = table.closest('.overflow-x-auto') || table.parentElement;
    const card = scrollWrapper.parentElement;
    if (!card) return;

    const previous = card.querySelector(':scope > .admin-pagination');
    if (previous) previous.remove();

    tbody.querySelectorAll('[data-admin-spacer]').forEach((row) => row.remove());

    const rows = Array.from(tbody.rows);
    rows.forEach((row) => { row.style.display = ''; });

    scrollWrapper.classList.add('admin-table-viewport');
    table.classList.add('admin-table');
    const rowHeight = rows.reduce((max, row) => Math.max(max, row.offsetHeight), 0);

    const storageKey = getPageSizeStorageKey(table, tableIndex);
    let pageSize = readStoredPageSize(storageKey)
      || Number(table.dataset.pageSize)
      || DEFAULT_PAGE_SIZE;
    if (!PAGE_SIZE_OPTIONS.includes(pageSize)) {
      pageSize = DEFAULT_PAGE_SIZE;
    }

    const total = rows.length;
    if (total === 0) return;

    let totalPages = Math.max(1, Math.ceil(total / pageSize));

    const syncSpacerRows = (visibleCount) => {
      tbody.querySelectorAll('[data-admin-spacer]').forEach((row) => row.remove());
      if (totalPages <= 1) return;

      const padCount = pageSize - visibleCount;
      if (padCount <= 0) return;

      const colCount = rows[0]?.cells.length || 1;
      for (let i = 0; i < padCount; i++) {
        const tr = document.createElement('tr');
        tr.className = 'admin-table-spacer';
        tr.setAttribute('data-admin-spacer', '');
        tr.setAttribute('aria-hidden', 'true');
        if (rowHeight > 0) tr.style.height = `${rowHeight}px`;
        for (let c = 0; c < colCount; c++) {
          tr.appendChild(document.createElement('td'));
        }
        tbody.appendChild(tr);
      }
    };

    const nav = document.createElement('nav');
    nav.className = 'admin-pagination';
    nav.setAttribute('aria-label', `Pagination ${table.dataset.label || `tableau ${tableIndex + 1}`}`);

    // — Zone gauche : compteur + lignes par page
    const left = document.createElement('div');
    left.className = 'admin-pagination__left';

    const range = document.createElement('span');
    range.className = 'admin-pagination__range';

    const sizeField = document.createElement('div');
    sizeField.className = 'admin-pagination__size';

    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'admin-pagination__size-label';
    sizeLabel.textContent = 'Par page';

    const sizeOptions = document.createElement('div');
    sizeOptions.className = 'admin-pagination__size-options';
    sizeOptions.setAttribute('role', 'group');
    sizeOptions.setAttribute('aria-label', 'Nombre de lignes par page');

    const sizeButtons = PAGE_SIZE_OPTIONS.map((optionValue) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-pagination__size-option';
      button.dataset.value = String(optionValue);
      button.textContent = String(optionValue);
      button.setAttribute('aria-label', `${optionValue} lignes par page`);
      button.setAttribute('aria-pressed', optionValue === pageSize ? 'true' : 'false');
      if (optionValue === pageSize) button.classList.add('is-active');
      return button;
    });

    sizeOptions.append(...sizeButtons);
    sizeField.append(sizeLabel, sizeOptions);
    left.append(range, sizeField);

    // — Zone droite : navigation groupée
    const navGroup = document.createElement('div');
    navGroup.className = 'admin-pagination__nav';

    const firstBtn = createButton(
      '<i class="fas fa-angle-double-left" aria-hidden="true"></i>',
      'Première page',
      'admin-pagination__edge'
    );
    const prevBtn = createButton(
      '<i class="fas fa-chevron-left" aria-hidden="true"></i>',
      'Page précédente',
      'admin-pagination__step'
    );

    const pageJump = document.createElement('div');
    pageJump.className = 'admin-pagination__page-jump';

    const pageInput = document.createElement('input');
    pageInput.type = 'number';
    pageInput.id = `admin-page-goto-${tableIndex}`;
    pageInput.className = 'admin-pagination__page-input';
    pageInput.min = '1';
    pageInput.inputMode = 'numeric';
    pageInput.setAttribute('aria-label', 'Numéro de page');

    const pageTotal = document.createElement('span');
    pageTotal.className = 'admin-pagination__page-total';

    pageJump.append(pageInput, pageTotal);

    const numbers = document.createElement('div');
    numbers.className = 'admin-pagination__numbers';
    numbers.hidden = true;

    const nextBtn = createButton(
      '<i class="fas fa-chevron-right" aria-hidden="true"></i>',
      'Page suivante',
      'admin-pagination__step'
    );
    const lastBtn = createButton(
      '<i class="fas fa-angle-double-right" aria-hidden="true"></i>',
      'Dernière page',
      'admin-pagination__edge'
    );

    navGroup.append(firstBtn, prevBtn, pageJump, numbers, nextBtn, lastBtn);

    const navSpacer = document.createElement('div');
    navSpacer.className = 'admin-pagination__nav-spacer';
    navSpacer.setAttribute('aria-hidden', 'true');
    navSpacer.hidden = true;

    nav.append(left, navGroup, navSpacer);
    card.appendChild(nav);

    let currentPage = 1;

    const scrollToTableStart = () => {
      card.scrollIntoView({ block: 'start' });
      if (scrollWrapper.scrollLeft) scrollWrapper.scrollLeft = 0;
    };

    const goToPage = (page) => {
      currentPage = Math.min(Math.max(1, page), totalPages);
      render();
    };

    const submitPageInput = () => {
      const requested = Number.parseInt(pageInput.value, 10);
      if (Number.isNaN(requested)) {
        pageInput.value = String(currentPage);
        return;
      }
      goToPage(requested);
    };

    const render = () => {
      totalPages = Math.max(1, Math.ceil(total / pageSize));
      const singlePage = totalPages <= 1;
      nav.classList.toggle('admin-pagination--single-page', singlePage);

      currentPage = Math.min(Math.max(1, currentPage), totalPages);

      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);

      rows.forEach((row, index) => {
        row.style.display = singlePage || (index >= startIndex && index < endIndex) ? '' : 'none';
      });

      syncSpacerRows(endIndex - startIndex);

      if (singlePage) {
        range.innerHTML = `<strong>${total}</strong> ligne${total > 1 ? 's' : ''}`;
      } else {
        range.innerHTML = `<strong>${startIndex + 1}</strong>–<strong>${endIndex}</strong> sur <strong>${total}</strong>`;
      }

      sizeButtons.forEach((button) => {
        const value = Number(button.dataset.value);
        const isActive = value === pageSize;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      navSpacer.hidden = !singlePage;
      navGroup.hidden = singlePage;
      if (singlePage) return;

      const manyPages = totalPages > MANY_PAGES_THRESHOLD;
      nav.classList.toggle('admin-pagination--many', manyPages);

      pageInput.max = String(totalPages);
      pageInput.value = String(currentPage);
      pageInput.setAttribute('aria-valuemin', '1');
      pageInput.setAttribute('aria-valuemax', String(totalPages));
      pageInput.setAttribute('aria-valuenow', String(currentPage));
      pageTotal.textContent = `/ ${totalPages}`;

      firstBtn.disabled = currentPage === 1;
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
      lastBtn.disabled = currentPage === totalPages;

      // Peu de pages : numéros cliquables. Beaucoup de pages : champ [X] / N.
      numbers.hidden = manyPages;
      pageJump.hidden = !manyPages;
      numbers.innerHTML = '';
      if (!manyPages) {
        buildPageList(currentPage, totalPages).forEach((page) => {
          if (page === '…') {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'admin-pagination__ellipsis';
            ellipsis.textContent = '…';
            ellipsis.setAttribute('aria-hidden', 'true');
            numbers.appendChild(ellipsis);
            return;
          }

          const pageBtn = createButton(String(page), `Page ${page}`, 'admin-pagination__number');
          if (page === currentPage) {
            pageBtn.classList.add('is-active');
            pageBtn.setAttribute('aria-current', 'page');
          }
          pageBtn.addEventListener('click', () => goToPage(page));
          numbers.appendChild(pageBtn);
        });
      }
    };

    firstBtn.addEventListener('click', () => goToPage(1));
    prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    lastBtn.addEventListener('click', () => goToPage(totalPages));

    pageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitPageInput();
        pageInput.blur();
      }
    });
    pageInput.addEventListener('change', submitPageInput);
    pageInput.addEventListener('blur', () => {
      pageInput.value = String(currentPage);
    });

    sizeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextSize = Number(button.dataset.value);
        if (nextSize === pageSize) return;
        pageSize = nextSize;
        try {
          sessionStorage.setItem(storageKey, String(pageSize));
        } catch {
          // sessionStorage indisponible : on ignore.
        }
        currentPage = 1;
        render();
        scrollToTableStart();
      });
    });

    render();
  };

  const initAdminPagination = () => {
    const section = document.querySelector('.reports-section .grid.grid-cols-1.gap-6');
    if (!section) return;

    const tables = section.querySelectorAll('table');
    tables.forEach((table, index) => paginateTable(table, index));
  };

  window.initAdminPagination = initAdminPagination;

  document.addEventListener('DOMContentLoaded', initAdminPagination);
})();
