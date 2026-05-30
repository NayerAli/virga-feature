/* eslint-env browser */

document.addEventListener('DOMContentLoaded', () => {
  let reportToDelete = null;
  let deleteButtonToDelete = null;

  const PAGE_SIZE_STORAGE_KEY = 'dashboard-pagination:pageSize';
  const paginationUi = window.VirgaPaginationUi;
  let pageSize = paginationUi
    ? paginationUi.readStoredPageSize(PAGE_SIZE_STORAGE_KEY, 10)
    : 10;
  let currentPage = 1;

  // Attach event listeners to delete buttons
  const attachDeleteListeners = () => {
    document.querySelectorAll('button.action-btn.delete').forEach(button => {
      button.addEventListener('click', function() {
        reportToDelete = this.dataset.reportId;
        deleteButtonToDelete = this;
        // Use jQuery to show modal instead of Bootstrap constructor
        $('#deleteModal').modal('show');
      });
    });
  };

  // Initial attachment of delete listeners
  attachDeleteListeners();

  // Handle delete confirmation
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!reportToDelete) return;

    try {
      const response = await fetch(`/report/delete/${encodeURIComponent(reportToDelete)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        showDashboardFeedback('Rapport supprimé avec succès.', 'success');
        handleSearch(currentPage);
      } else {
        showDashboardFeedback('Erreur lors de la suppression du rapport.', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showDashboardFeedback('Erreur lors de la suppression du rapport.', 'error');
    } finally {
      $('#deleteModal').modal('hide');
      reportToDelete = null;
      deleteButtonToDelete = null;
    }
  });

  const showDashboardFeedback = (message, type) => {
    let feedback = document.getElementById('dashboardFeedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'dashboardFeedback';
      const wrapper = document.querySelector('.content-wrapper');
      if (wrapper) wrapper.insertBefore(feedback, wrapper.firstChild);
    }

    const isSuccess = type === 'success';
    const iconClass = isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle';
    feedback.className = `alert alert-${isSuccess ? 'success' : 'danger'} fade-out`;
    feedback.classList.remove('d-none');
    feedback.setAttribute('role', isSuccess ? 'status' : 'alert');
    feedback.setAttribute('aria-live', 'polite');
    feedback.innerHTML = `<i class="fas ${iconClass}" aria-hidden="true"></i> ${escapeHtml(message)}`;
  };

  const getBrandLogo = (brand) => {
    if (!window.VirgaVehicleBrandLogos) {
      return {
        src: '/static/img/vehicle-brands/default.svg',
        alt: 'Logo marque véhicule'
      };
    }

    return window.VirgaVehicleBrandLogos.getVehicleBrandLogo(brand);
  };

  const normalizeLicensePlateSearch = (value) => String(value || '').replace(/[\s-]/g, '').toLowerCase();

  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };

  const escapeAttribute = (value) => escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Search functionality
  const searchInput = document.getElementById('searchReports');
  const paginationContainer = document.getElementById('dashboardPagination');
  let searchTimeout;

  const urlParams = new URL(window.location.href);
  searchInput.value = urlParams.searchParams.get('search') || '';
  currentPage = Number.parseInt(urlParams.searchParams.get('page'), 10) || 1;

  const scrollToReportsSection = () => {
    document.querySelector('.reports-section')?.scrollIntoView({ block: 'start' });
  };

  const renderPagination = (pagination) => {
    if (!paginationContainer || !paginationUi) return;

    paginationContainer.innerHTML = paginationUi.renderDashboardPaginationHtml(pagination, pageSize);
    paginationContainer.classList.toggle(
      'dashboard-pagination--single-page',
      !pagination || pagination.totalPages <= 1
    );
    paginationContainer.classList.toggle(
      'dashboard-pagination--many',
      pagination && paginationUi.isManyPages(pagination.totalPages)
    );
  };

  const readInitialPagination = () => {
    const script = document.getElementById('dashboardInitialPagination');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
    }
  };

  const renderEmptyState = (searchValue) => {
    const trimmedSearch = String(searchValue || '').trim();
    if (trimmedSearch) {
      return `
        <tr>
          <td colspan="5" class="no-reports">
            <i class="fas fa-info-circle" aria-hidden="true"></i>
            <p>Aucun résultat pour «&nbsp;${escapeHtml(trimmedSearch)}&nbsp;»</p>
            <p class="text-muted small mb-0">Modifiez votre recherche ou effacez le champ pour tout afficher.</p>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td colspan="5" class="no-reports">
          <i class="fas fa-info-circle" aria-hidden="true"></i>
          <p>Aucun rapport pour le moment</p>
          <a href="/form" class="btn btn-primary mt-3">
            <i class="fas fa-plus" aria-hidden="true"></i>
            Créer un rapport
          </a>
        </td>
      </tr>
    `;
  };

  const updateTable = (reports, searchValue = '') => {
    const tbody = document.querySelector('.reports-table tbody');
    if (!reports.length) {
      tbody.innerHTML = renderEmptyState(searchValue);
      return;
    }

    tbody.innerHTML = reports.map(report => {
      const brandLogo = getBrandLogo(report.brand);
      const vehicleLabel = report.brand && report.model
        ? `${escapeHtml(report.brand)} ${escapeHtml(report.model)}`
        : 'N/A';
      const safeReportId = encodeURIComponent(report.report_id || '');

      return `
      <tr class="report-row">
        <td class="license-plate">${escapeHtml(report.license_plate)}</td>
        <td>${escapeHtml(report.client_name)}</td>
        <td>
          <div class="vehicle-brand-cell">
            <img src="${brandLogo.src}"
                 alt="${escapeAttribute(brandLogo.alt)}"
                 class="vehicle-brand-logo vehicle-brand-logo-sm"
                 loading="lazy"
                 decoding="async">
            <span>${vehicleLabel}</span>
          </div>
        </td>
        <td>${new Date(report.created_at).toLocaleDateString('fr-FR')}</td>
        <td>
          <div class="action-buttons">
            <a href="/report/${safeReportId}"
               class="action-btn view"
               title="Voir le rapport"
               aria-label="Voir le rapport">
              <i class="fas fa-eye" aria-hidden="true"></i>
            </a>
            <a href="/report/preview/${safeReportId}?fresh=${Date.now()}"
               class="action-btn preview"
               title="Prévisualiser le PDF"
               aria-label="Prévisualiser le PDF"
               target="_blank"
               rel="noopener noreferrer">
              <i class="fas fa-file-pdf" aria-hidden="true"></i>
            </a>
            <a href="/report/download/${safeReportId}?fresh=${Date.now()}"
               class="action-btn download"
               title="Télécharger le PDF"
               aria-label="Télécharger le PDF">
              <i class="fas fa-download" aria-hidden="true"></i>
            </a>
            <a href="/form/${safeReportId}"
               class="action-btn edit"
               title="Modifier le rapport"
               aria-label="Modifier le rapport">
              <i class="fas fa-pen-to-square" aria-hidden="true"></i>
            </a>
            <button type="button"
                    class="action-btn delete"
                    data-report-id="${escapeAttribute(report.report_id)}"
                    title="Supprimer le rapport"
                    aria-label="Supprimer le rapport">
              <i class="fas fa-trash" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

    // Reattach delete event listeners after updating table
    attachDeleteListeners();
  };

  const updateBrowserUrl = (searchValue, page) => {
    const nextUrl = new URL(window.location.href);
    if (searchValue) {
      nextUrl.searchParams.set('search', searchValue);
    } else {
      nextUrl.searchParams.delete('search');
    }
    if (page > 1) {
      nextUrl.searchParams.set('page', page);
    } else {
      nextUrl.searchParams.delete('page');
    }
    window.history.replaceState({}, '', nextUrl);
  };

  const handleSearch = async (page = 1, options = {}) => {
    const { scrollToTop = false } = options;
    const searchValue = searchInput.value.trim();
    const normalizedPlateSearch = normalizeLicensePlateSearch(searchValue);
    try {
      const response = await fetch(`/dashboard?search=${encodeURIComponent(searchValue)}&plateSearch=${encodeURIComponent(normalizedPlateSearch)}&page=${encodeURIComponent(page)}&pageSize=${pageSize}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const data = await response.json();
      currentPage = data.pagination ? data.pagination.currentPage : page;
      updateTable(data.reports || [], searchValue);
      renderPagination(data.pagination);
      updateBrowserUrl(searchValue, currentPage);
      if (scrollToTop) scrollToReportsSection();
    } catch (error) {
      console.error('Search error:', error);
      showDashboardFeedback('Erreur lors de la recherche. Réessayez.', 'error');
    }
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(1), 300);
  });

  if (paginationContainer) {
    paginationContainer.addEventListener('click', (event) => {
      const sizeButton = event.target.closest('[data-page-size]');
      if (sizeButton) {
        const nextSize = Number(sizeButton.dataset.pageSize);
        if (!paginationUi.PAGE_SIZE_OPTIONS.includes(nextSize) || nextSize === pageSize) return;
        pageSize = nextSize;
        paginationUi.writeStoredPageSize(PAGE_SIZE_STORAGE_KEY, pageSize);
        handleSearch(1, { scrollToTop: true });
        return;
      }

      const button = event.target.closest('[data-page]');
      if (!button || button.disabled || button.classList.contains('disabled')) return;
      event.preventDefault();

      const requestedPage = Number.parseInt(button.dataset.page, 10);
      if (Number.isNaN(requestedPage)) return;
      handleSearch(requestedPage, { scrollToTop: true });
    });

    paginationContainer.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const input = event.target.closest('.dashboard-page-input');
      if (!input) return;
      event.preventDefault();
      const requestedPage = Number.parseInt(input.value, 10);
      if (Number.isNaN(requestedPage)) return;
      handleSearch(requestedPage, { scrollToTop: true });
      input.blur();
    });

    paginationContainer.addEventListener('change', (event) => {
      const input = event.target.closest('.dashboard-page-input');
      if (!input) return;
      const requestedPage = Number.parseInt(input.value, 10);
      if (Number.isNaN(requestedPage)) return;
      handleSearch(requestedPage, { scrollToTop: true });
    });
  }

  const initialPagination = readInitialPagination();
  if (initialPagination && initialPagination.pageSize && initialPagination.pageSize !== pageSize) {
    handleSearch(currentPage, { scrollToTop: false });
  } else if (initialPagination) {
    renderPagination(initialPagination);
  }
});
