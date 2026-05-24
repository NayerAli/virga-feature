/* eslint-env browser */

document.addEventListener('DOMContentLoaded', () => {
  let reportToDelete = null;
  let deleteButtonToDelete = null;
  const pageSize = 10;
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

      // Hide modal using jQuery
      $('#deleteModal').modal('hide');

      const data = await response.json();

      if (data.success) {
        // Remove the row from the table
        const row = deleteButtonToDelete ? deleteButtonToDelete.closest('tr') : null;
        if (row) row.remove();

        // Show success message
        showNotification('Rapport supprimé avec succès', 'success');
        handleSearch(currentPage);
      } else {
        showNotification('Erreur lors de la suppression du rapport', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Erreur lors de la suppression du rapport', 'error');
    } finally {
      // Hide modal using jQuery and reset reportToDelete
      $('#deleteModal').modal('hide');
      reportToDelete = null;
      deleteButtonToDelete = null;
    }
  });

  // Notification helper function
  const showNotification = (message, type) => {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
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

  const renderPagination = (pagination) => {
    if (!paginationContainer || !pagination) return;

    const summary = pagination.totalReports > 0
      ? `Rapports <strong>${pagination.startItem}</strong> à <strong>${pagination.endItem}</strong> sur <strong>${pagination.totalReports}</strong>`
      : 'Aucun rapport à afficher';

    if (pagination.totalPages <= 1) {
      paginationContainer.innerHTML = `<div class="pagination-summary">${summary}</div>`;
      return;
    }

    const previousDisabled = pagination.hasPreviousPage ? '' : 'disabled';
    const nextDisabled = pagination.hasNextPage ? '' : 'disabled';
    const previousAria = pagination.hasPreviousPage ? '' : 'aria-disabled="true" tabindex="-1"';
    const nextAria = pagination.hasNextPage ? '' : 'aria-disabled="true" tabindex="-1"';

    paginationContainer.innerHTML = `
      <div class="pagination-summary">${summary}</div>
      <nav class="pagination-controls" aria-label="Navigation entre les pages de rapports">
        <button type="button"
                class="pagination-btn ${previousDisabled}"
                data-page="${pagination.previousPage}"
                aria-label="Page précédente"
                ${previousAria}>
          <i class="fas fa-chevron-left"></i>
          Précédent
        </button>
        <span class="pagination-current">
          Page <strong>${pagination.currentPage}</strong> / <strong>${pagination.totalPages}</strong>
        </span>
        <button type="button"
                class="pagination-btn ${nextDisabled}"
                data-page="${pagination.nextPage}"
                aria-label="Page suivante"
                ${nextAria}>
          Suivant
          <i class="fas fa-chevron-right"></i>
        </button>
      </nav>
    `;
  };

  const updateTable = (reports) => {
    const tbody = document.querySelector('.reports-table tbody');
    if (!reports.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="no-reports">
            <i class="fas fa-info-circle"></i>
            <p>Aucun rapport trouvé</p>
            <a href="/form" class="btn btn-primary mt-3">
              <i class="fas fa-plus"></i>
              Créer un nouveau rapport
            </a>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = reports.map(report => {
      const brandLogo = getBrandLogo(report.brand);
      const vehicleLabel = report.brand && report.model
        ? `${escapeHtml(report.brand)} | ${escapeHtml(report.model)}`
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
               title="Voir le rapport">
              <i class="fas fa-eye"></i>
            </a>
            <a href="/report/preview/${safeReportId}?fresh=${Date.now()}"
               class="action-btn preview"
               title="Prévisualiser PDF"
               target="_blank">
              <i class="fas fa-file-pdf"></i>
            </a>
            <a href="/report/download/${safeReportId}?fresh=${Date.now()}"
               class="action-btn download"
               title="Télécharger">
              <i class="fas fa-download"></i>
            </a>
            <a href="/form/${safeReportId}"
               class="action-btn edit"
               title="Modifier">
              <i class="fa-regular fa-pen-to-square"></i>
            </a>
            <button class="action-btn delete"
                    data-report-id="${escapeAttribute(report.report_id)}"
                    title="Supprimer">
              <i class="fas fa-trash"></i>
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

  const handleSearch = async (page = 1) => {
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
      updateTable(data.reports || []);
      renderPagination(data.pagination);
      updateBrowserUrl(searchValue, currentPage);
    } catch (error) {
      console.error('Search error:', error);
      showNotification('Erreur lors de la recherche', 'error');
    }
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(1), 300);
  });

  if (paginationContainer) {
    paginationContainer.addEventListener('click', (event) => {
      const button = event.target.closest('.pagination-btn');
      if (!button || button.classList.contains('disabled')) return;
      event.preventDefault();

      const datasetPage = Number.parseInt(button.dataset.page, 10);
      const hrefPage = (() => {
        try {
          return Number.parseInt(new URL(button.getAttribute('href'), window.location.origin).searchParams.get('page'), 10);
        } catch (error) {
          return NaN;
        }
      })();
      const requestedPage = datasetPage || hrefPage || 1;

      handleSearch(requestedPage);
    });
  }
});
