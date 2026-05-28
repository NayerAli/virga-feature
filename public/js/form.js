/* eslint-env browser */

document.addEventListener('DOMContentLoaded', () => {
  // Global variables
  const form = document.getElementById('inspection-form');
  const licensePlateInput = document.getElementById('license_plate');
  const dropdown = document.getElementById('search_dropdown');
  const previewPdfBtn = document.getElementById('preview-pdf-template-btn');

  const inputsToFormat = [
    {input: 'client_name', type: 'first_letter_only'}, 
    {input: 'brand', type: 'camel'},
    {input: 'model', type: 'first_letter_only'},
    {input: 'revision_oil_type', type: 'upper'}, 
    {input: 'engine_code', type: 'upper'},
    {input: 'brake_disc_thickness_front', type: 'brake_thicknesses'},
    {input: 'brake_disc_thickness_rear', type: 'brake_thicknesses'},
    {input: 'client_email', type: 'lower'}
  ];

  const getBrandLogo = (brand) => {
    if (!window.VirgaVehicleBrandLogos) {
      return {
        src: '/static/img/vehicle-brands/default.svg',
        alt: 'Logo marque véhicule'
      };
    }

    return window.VirgaVehicleBrandLogos.getVehicleBrandLogo(brand);
  };

  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };

  const escapeAttribute = (value) => escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const formFeedbackEl = document.getElementById('formFeedback');
  const vehicleSearchFeedbackEl = document.getElementById('vehicleSearchFeedback');
  const customerSearchFeedbackEl = document.getElementById('customerSearchFeedback');

  const normalizeLicensePlateSearch = (value) => String(value || '').replace(/[\s-]/g, '').toLowerCase();

  const clearFormErrors = () => {
    if (formFeedbackEl) {
      formFeedbackEl.className = 'form-page-feedback d-none';
      formFeedbackEl.innerHTML = '';
    }
    document.querySelectorAll('#inspection-form .is-invalid').forEach((el) => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
    const mechanicFieldset = document.getElementById('mechanicList');
    if (mechanicFieldset) {
      mechanicFieldset.classList.remove('is-invalid');
    }
  };

  const showFormFeedback = (messages, variant) => {
    if (!formFeedbackEl || !messages.length) {
      return;
    }
    const iconClass = variant === 'danger' ? 'fa-times-circle' : 'fa-exclamation-triangle';
    const listItems = messages.map((msg) => `<li>${escapeHtml(msg)}</li>`).join('');
    formFeedbackEl.className = `form-page-feedback alert alert-${variant}`;
    formFeedbackEl.innerHTML = `<i class="fas ${iconClass}" aria-hidden="true"></i><ul class="mb-0 pl-3">${listItems}</ul>`;
    formFeedbackEl.classList.remove('d-none');
    formFeedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const showInlineFeedback = (el, message, variant) => {
    if (!el) {
      return;
    }
    const iconMap = {
      info: 'fa-spinner fa-spin',
      success: 'fa-check-circle',
      warning: 'fa-exclamation-triangle',
      danger: 'fa-exclamation-circle'
    };
    const icon = iconMap[variant] || 'fa-info-circle';
    el.className = `form-inline-feedback alert alert-${variant} py-2 px-3 mb-0 mt-1`;
    el.innerHTML = `<i class="fas ${icon} pr-1" aria-hidden="true"></i> ${escapeHtml(message)}`;
    el.setAttribute('role', variant === 'info' ? 'status' : 'alert');
  };

  const clearInlineFeedback = (el) => {
    if (!el) {
      return;
    }
    el.className = 'form-inline-feedback';
    el.innerHTML = '';
    el.setAttribute('role', 'status');
  };

  const updateBrandLogoPreview = () => {
    const brandInput = document.getElementById('brand');
    const brandLogoPreview = document.getElementById('brand-logo-preview');

    if (!brandInput || !brandLogoPreview) {
      return;
    }

    const brandLogo = getBrandLogo(brandInput.value);
    brandLogoPreview.src = brandLogo.src;
    brandLogoPreview.alt = brandLogo.alt;
  };

  // If the form is with report id (/report/:id), fill the form with the data
  const id = window.location.href.split('/').pop();
  if (id != 'form') {
    // Fetch report data
    fetch(`/report/api-inspection-report/${id}`)
      .then(response => response.json())
      .then(data => {
        fillForm(data);
      });
    
    // Set form action to update instead of submit
    form.action = `/form/update/${id}`;

    // Hide preview PDF button to avoid double submission
    previewPdfBtn.hidden = true;
  }

  if (form) {
    form.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea, select')) {
        e.target.classList.remove('is-invalid');
        e.target.removeAttribute('aria-invalid');
        if (formFeedbackEl && !formFeedbackEl.classList.contains('d-none')) {
          clearFormErrors();
        }
      }
    });

    document.querySelectorAll('.mechanic-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const mechanicFieldset = document.getElementById('mechanicList');
        if (mechanicFieldset) {
          mechanicFieldset.classList.remove('is-invalid');
        }
        if (formFeedbackEl && !formFeedbackEl.classList.contains('d-none')) {
          clearFormErrors();
        }
      });
    });
  }

  // Form submission handler
  if (form) {
    form.addEventListener('submit', (e) => {
      try {
        clearFormErrors();
        if (!validateForm()) {
          console.error('Form validation failed, preventing submission');
          e.preventDefault();

        } else {
          setUnsetRadioInputs();

          const formData = new FormData(form);

          // Set is_company value to true if checkbox is checked
          if(document.getElementById('is_company').checked) {
            formData.set('is_company', true);
          } else {
            formData.set('is_company', false);
          }

        }
      } catch (error) {
        console.error('Error in submit handler', error);
        e.preventDefault();
      }
    });
  } else {
    console.error('Form not found in DOM');
  }

  // Auto-format license plate
  if (licensePlateInput) {
    licensePlateInput.addEventListener('input', (e) => {
      try {
        let value = e.target.value.toUpperCase();
        
        // Keep any manually entered spaces or dashes
        const manuallyFormatted = value.includes(' ') || value.includes('-');
        
        // Remove any characters that aren't letters, numbers, spaces, or dashes
        value = value.replace(/[^A-Z0-9\s-]/g, '');
        
        // If user hasn't manually formatted, detect and auto-format
        if (!manuallyFormatted) {
          // Remove any existing spaces or dashes for pattern detection
          const stripped = value.replace(/[\s-]/g, '');
          
          // Detect format based on input pattern
          const isFNIPattern = /^\d{0,3}[A-Z]{0,3}\d{0,3}$/.test(stripped);
          const isSIVPattern = /^[A-Z]{0,2}\d{0,3}[A-Z]{0,2}$/.test(stripped);
          
          // If neither pattern matches, prevent input
          if (!isFNIPattern && !isSIVPattern) {
            value = value.slice(0, -1);
          }
          
          // Enforce maximum length
          if (isFNIPattern && stripped.length > 9) {
            value = stripped.slice(0, 9);
          } else if (isSIVPattern && stripped.length > 7) {
            value = stripped.slice(0, 7);
          }
          
          // Auto-format complete plates
          if (stripped.length === 9 && /^\d{3}[A-Z]{3}\d{3}$/.test(stripped)) {
            // FNI format (DOM-TOM): 123ABC000 -> 123 ABC 000
            value = stripped.slice(0, 3) + ' ' + stripped.slice(3, 6) + ' ' + stripped.slice(6);
          } else if (stripped.length === 7 && /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(stripped)) {
            // SIV format: AB123CD -> AB-123-CD
            value = stripped.slice(0, 2) + '-' + stripped.slice(2, 5) + '-' + stripped.slice(5);
          }
        } else {
          // For manually formatted input, just enforce max length including separators
          const isFNIFormat = value.includes(' '); // FNI uses spaces
          const maxLength = isFNIFormat ? 11 : 9; // 11 chars for FNI (9 + 2 spaces), 9 for SIV (7 + 2 dashes)
          if (value.length > maxLength) {
            value = value.slice(0, maxLength);
          }
        }
        
        e.target.value = value;
      } catch (error) {
        console.error('Error in license plate formatter', error);
      }
    });

    // Add blur event to validate format
    licensePlateInput.addEventListener('blur', (e) => {
      try {
        let value = e.target.value.trim().toUpperCase();
        const stripped = value.replace(/[\s-]/g, '');
        
        // Check if it's a complete plate of either format
        const isFNI = /^\d{3}[A-Z]{3}\d{3}$/.test(stripped);
        const isSIV = /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(stripped);
        
        // If complete but not properly formatted, apply formatting
        if (isFNI && !/^\d{3}\s[A-Z]{3}\s\d{3}$/.test(value)) {
          value = stripped.slice(0, 3) + ' ' + stripped.slice(3, 6) + ' ' + stripped.slice(6);
        } else if (isSIV && !/^[A-Z]{2}-\d{3}-[A-Z]{2}$/.test(value)) {
          value = stripped.slice(0, 2) + '-' + stripped.slice(2, 5) + '-' + stripped.slice(5);
        }
        
        e.target.value = value;
      } catch (error) {
        console.error('Error in license plate blur handler', error);
      }
    });
  } else {
    console.error('License plate input not found');
  }

  // Format inputs
  inputsToFormat.forEach(inputToFormat => {
    const inputElement = document.getElementById(inputToFormat.input);
    if (inputElement) {
      inputElement.addEventListener('input', (e) => {
        formatInput(e.target, inputToFormat.type);

        if (inputToFormat.input === 'brand') {
          updateBrandLogoPreview();
        }
      });
    }
  });
  
  // Input focus event
  licensePlateInput.addEventListener('focus', () => {
    updateDropdown();
    dropdown.classList.remove('d-none');
  });
  
  // Input keyup event for filtering
  licensePlateInput.addEventListener('input', (e) => {
    filterVehicles(e.target.value);
  });
  
  // Click events for dropdown items
  document.addEventListener('click', (e) => {
    if (e.target.closest('.search-item-text')) {
      const immat = e.target.closest('.search-item-text').dataset.immat;
      const id = e.target.closest('.search-item-text').dataset.id;
      
      handleSearch(immat, id);
      // dropdown.classList.add('d-none');

    } else if (e.target.closest('.search-item-report')) {

      const immat = e.target.closest('.search-item-report').dataset.immat;
      // Open new tab with report page
      window.open(`/dashboard?search=${encodeURIComponent(immat)}`, '_blank');

    } else if (!e.target.closest('#license_plate')) {
      dropdown.classList.add('d-none');
    }
  });
  
  // Enter key
  licensePlateInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(licensePlateInput.value.trim(), licensePlateInput.dataset.id);
      dropdown.classList.add('d-none');
    }
  });

  if (previewPdfBtn) previewPdfBtn.addEventListener('click', async () => {
    clearFormErrors();
    if (!validateForm(true)) {
      console.error('Form validation failed, preventing submission');
      return;
    }
    
    setUnsetRadioInputs();
    
    // Set form attributes for preview submission
    form.action = '/form/submit-preview';
    form.target = '_blank';
    
    // Submit form to generate preview in new tab
    form.submit();

    previewPdfBtn.disabled = true;
    
    // Redirect main page to dashboard after a short delay
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);
  });

    
  function markInvalid(input) {
    if (!input) {
      return;
    }
    if (input.id === 'mechanicList') {
      input.classList.add('is-invalid');
      return;
    }
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
  }

  // Client-side validation function
  function validateForm(isPreview = false) {
    try {
      const errorMessages = [];
      const invalidFields = [];

      const requiredFields = [
        { id: 'client_name', message: 'Le nom du client est requis.' },
        { id: 'license_plate', message: 'L\'immatriculation est requise.' },
        { id: 'brand', message: 'La marque du véhicule est requise.' }
      ];

      requiredFields.forEach((field) => {
        const input = document.getElementById(field.id);
        if (!input) {
          errorMessages.push(field.message);
          return;
        }
        if (!input.value.trim()) {
          errorMessages.push(field.message);
          invalidFields.push(input);
        }
      });

      const phoneInput = document.getElementById('client_phone');
      if (phoneInput && phoneInput.value) {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phoneInput.value.trim())) {
          errorMessages.push('Format de téléphone invalide (10 chiffres requis).');
          invalidFields.push(phoneInput);
        }
      }

      const emailInput = document.getElementById('client_email');
      if (emailInput && emailInput.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
          errorMessages.push('Format d\'e-mail invalide.');
          invalidFields.push(emailInput);
        }
      }

      const plateInput = document.getElementById('license_plate');
      if (plateInput && plateInput.value) {
        const sivRegex = /^[A-Z]{2}[-]?[0-9]{3}[-]?[A-Z]{2}$/;
        const fniRegex = /^[0-9]{3}\s?[A-Z]{3}\s?[0-9]{3}$/;
        const value = plateInput.value.trim().toUpperCase();
        if (!sivRegex.test(value) && !fniRegex.test(value)) {
          errorMessages.push('Format d\'immatriculation invalide (ex. AB-123-CD ou 123 ABC 000).');
          invalidFields.push(plateInput);
        }
      }

      const dateInputs = document.querySelectorAll('[type="date"]');
      dateInputs.forEach((dateInput) => {
        if (dateInput.value.trim()) {
          const date = new Date(dateInput.value);
          if (Number.isNaN(date.getTime())) {
            errorMessages.push('Une date saisie n\'est pas valide.');
            invalidFields.push(dateInput);
          }
        }
      });

      document.querySelectorAll('#inspection-form input[type="text"], #inspection-form input[type="email"], #inspection-form input[type="tel"], #inspection-form textarea').forEach((input) => {
        if (input.type !== 'hidden') {
          input.value = input.value.trim();
        }
      });

      const mechanics = document.querySelectorAll('.mechanic-checkbox:checked');
      const mechanicFieldset = document.getElementById('mechanicList');
      if (mechanics.length === 0 && !isPreview) {
        errorMessages.push('Sélectionnez au moins un mécanicien.');
        invalidFields.push(mechanicFieldset);
      }

      if (errorMessages.length > 0) {
        invalidFields.forEach(markInvalid);
        showFormFeedback(errorMessages, 'danger');
        const firstFocusable = invalidFields.find((el) => el && typeof el.focus === 'function');
        if (firstFocusable) {
          firstFocusable.focus();
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in validateForm', error);
      showFormFeedback(['Une erreur est survenue lors de la validation du formulaire.'], 'danger');
      return false;
    }
  }

  // Format input based on type
  function formatInput(input, type) {
    // input.value = input.value.trim();
    switch(type) {
    case 'sentence': input.value = toSentenceCase(input.value); break;
    case 'upper': input.value = input.value.toUpperCase(); break;
    case 'camel': input.value = toCamelCase(input.value); break;
    case 'first_letter_only': input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1); break;
    case 'lower': input.value = input.value.toLowerCase(); break;
    case 'brake_thicknesses': 
      if (input.value.includes('/')) {
        input.value = input.value.replace(/\//g, ' / ').replace(/\s+/g, ' ').replace(/\s+$/, '');
      }
      break;
    }
  }

  // Fill form with data using their key as html element id
  function fillForm(data) {
    const form = document.getElementById('inspection-form');

    if (form) {
      for(const [key, val] of Object.entries(data)) {
        const input = document.getElementById(key);

        if (input) {
          switch(input.type) {
          case 'checkbox': input.checked = !!val; break;
          case 'date': 
            try {
              input.value = new Date(val).toISOString().split('T')[0];
            } catch (error) {
              input.value = val;
              console.error(`fillForm() : Error in date formatting for ${key} => ${val}`, error);
            }
            break;
          case 'number': input.value = Number(val); break;
          case 'textarea': input.value = val; break;
          default: input.value = val; break;
          }
        }
      }

      if (Array.isArray(data.inspection_results)) {
        for (let ir in data.inspection_results) {
          const radioName = `${data.inspection_results[ir].category}_${data.inspection_results[ir].item_id}_${data.inspection_results[ir].value.value}`;
          const radio = document.getElementById(radioName);
          if (radio) {
            radio.checked = true;
          }
        }
      }

      updateBrandLogoPreview();

      if (data.mechanics !== '{}' && Object.prototype.hasOwnProperty.call(data, 'mechanics')) {
        const parsedMechanics = JSON.parse(data.mechanics);

        for (let mechanic in parsedMechanics) {
          const option = document.getElementById(`mechanicList_${parsedMechanics[mechanic]}`);
          if (option && !option.checked) {
            option.checked = true;
          } else if (option && option.selected) {
            option.selected = true;
          }
        }
      }
    } else {
      console.error('Form not found in DOM');
    }
  }

  // Convert first letter to uppercase and the rest to lowercase
  function toSentenceCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Convert string to camel case
  const toCamelCase = (str) => {
    return str
      .split(' ') // Split into words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter
      .join(' '); // Join back with single spaces
  };

  // Set radio inputs to checked if not already checked
  const setUnsetRadioInputs = () => {
    const radioGroups = document.querySelectorAll('.custom-radio-group');
    radioGroups.forEach(group => {
      const radios = group.querySelectorAll('input[type="radio"]');
      const isChecked = Array.from(radios).some(radio => radio.checked);

      if (!isChecked) {
        const nonVerifieRadio = group.querySelector('input[type="radio"][value="2"]');
        if (nonVerifieRadio) {
          nonVerifieRadio.checked = true;
        } else {
          console.error(`Radio with id="2" not found in group: ${group.id}`);
        }
      }
    });
  };

  let allVehicles = [];
  let filteredVehicles = [];

  // Fetch all vehicules on page load
  const fetchVehicles = async () => {
    try {
      const response = await fetch('/form/api-vehicules');
      const data = await response.json();
      if (data.success) {
        allVehicles = data.data;
        filteredVehicles = [...allVehicles];
      }
    } catch (error) {
      console.error('Error fetching vehicules:', error);
    }
  };

  // Filter vehicules based on search input
  const filterVehicles = (searchText) => {
    if (!searchText.trim()) {
      filteredVehicles = [...allVehicles];
    } else {
      const searchLower = searchText.toLowerCase();
      const normalizedPlateSearch = normalizeLicensePlateSearch(searchText);
      filteredVehicles = allVehicles.filter(vehicule => {
        const normalizedVehiclePlate = normalizeLicensePlateSearch(vehicule.license_plate);

        return (vehicule.license_plate || '').toLowerCase().includes(searchLower) ||
          normalizedVehiclePlate.includes(normalizedPlateSearch) ||
          (vehicule.brand || '').toLowerCase().includes(searchLower) ||
          (vehicule.model || '').toLowerCase().includes(searchLower);
      });
    }
    updateDropdown();
  };

  // Update dropdown content
  const updateDropdown = () => {
    const dropdown = document.getElementById('search_dropdown');
    const content = document.querySelector('.search-dropdown-content');
    
    if (filteredVehicles.length === 0) {
      content.innerHTML = '<div class="search-item">Aucun véhicule trouvé</div>';
    } else {
      content.innerHTML = filteredVehicles.map(vehicule => {
        const brandLogo = getBrandLogo(vehicule.brand);
        const safeLicensePlate = escapeAttribute(vehicule.license_plate);
        const safeVehicleId = escapeAttribute(vehicule.vehicule_id);
        const vehicleLabel = `${escapeHtml(vehicule.brand)} ${escapeHtml(vehicule.model)}`.trim();

        return `
        <div class="search-item">
          <div class="search-item-text" data-immat="${safeLicensePlate}" data-id="${safeVehicleId}">
            <img src="${brandLogo.src}"
                 alt="${escapeAttribute(brandLogo.alt)}"
                 class="vehicle-brand-logo vehicle-brand-logo-sm"
                 loading="lazy"
                 decoding="async">
            <div>
              <div class="search-item-title">${safeLicensePlate}</div>
              <div class="search-item-subtitle">${vehicleLabel}</div>
            </div>
          </div>
          <div class="search-item-report" data-immat="${safeLicensePlate}">
            <i class="fas fa-list"></i>
          </div>
        </div>
      `;
      }).join('');
    }
    
    dropdown.classList.remove('d-none');
  };

  // Handle search functionality
  const handleSearch = async (immatriculation, id) => {
    if (!immatriculation) {
      showInlineFeedback(vehicleSearchFeedbackEl, 'Saisissez une immatriculation.', 'warning');
      return;
    }

    try {
      showInlineFeedback(vehicleSearchFeedbackEl, 'Recherche en cours…', 'info');

      const response = await fetch(`/form/api-vehicule-details/${encodeURIComponent(id)}`);
      const data = await response.json();

      fillForm(data.vehicule);
      fillForm(data.customer);

      if (data.success) {
        showInlineFeedback(vehicleSearchFeedbackEl, 'Véhicule trouvé : les champs ont été pré-remplis.', 'success');
        dropdown.classList.add('d-none');
      } else {
        showInlineFeedback(vehicleSearchFeedbackEl, data.message || 'Véhicule introuvable.', 'warning');
      }

      setTimeout(() => clearInlineFeedback(vehicleSearchFeedbackEl), 3000);

    } catch (error) {
      console.error('Search error:', error);
      showInlineFeedback(vehicleSearchFeedbackEl, 'Erreur lors de la recherche du véhicule.', 'danger');
    }
  };

  // Fetch vehicules on page load
  updateBrandLogoPreview();
  fetchVehicles();

  // Customer Search Functionality
  let searchTimeout = null;
  const clientNameInput = document.getElementById('client_name');
  const customerDropdown = document.getElementById('customer_search_dropdown');
  let filteredCustomers = [];

  // Input focus event for customer search
  clientNameInput.addEventListener('focus', () => {
    if (clientNameInput.value.trim().length >= 2) {
      handleCustomerSearch(clientNameInput.value.trim());
    }
  });

  // Input keyup event for customer filtering
  clientNameInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.trim();
    
    if (searchTerm.length < 2) {
      document.getElementById('customer_search_dropdown').classList.add('d-none');
      return;
    }
    
    searchTimeout = setTimeout(() => handleCustomerSearch(searchTerm), 600);
  });

  // Click events for customer dropdown items
  document.addEventListener('click', (e) => {
    const customerResult = e.target.closest('.customer-result');
    if (customerResult) {
      const customerId = customerResult.dataset.id;
      selectCustomerFromID(customerId);
    } else if (!e.target.closest('#client_name')) {
      customerDropdown.classList.add('d-none');
    }
  });

  // Handle customer search
  const handleCustomerSearch = async (searchTerm) => {
    try {
      const response = await fetch(`/form/api-customers-search?query=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Search failed');
      }
      
      filteredCustomers = data.data;
      const resultsContainer = document.querySelector('.customer-search-dropdown-content');
      
      if (filteredCustomers.length === 0) {
        resultsContainer.innerHTML = '<div class="search-dropdown-empty">Aucun client trouvé</div>';
        customerDropdown.classList.remove('d-none');
        return;
      }
      
      resultsContainer.innerHTML = filteredCustomers.map(customer => {
        const safeCustomerId = escapeAttribute(customer.customer_id);
        const safeCustomerName = escapeHtml(customer.name);
        const safeCustomerPhone = escapeHtml(customer.phone);
        const safeCustomerEmail = escapeHtml(customer.email);
        const safeCustomerAddress = escapeHtml(customer.address);

        return `
        <button type="button" class="customer-result"
             data-id="${safeCustomerId}"
             data-name="${escapeAttribute(customer.name)}"
             data-phone="${escapeAttribute(customer.phone || '')}"
             data-address="${escapeAttribute(customer.address || '')}">
          <span class="customer-result-name"><i class="fas fa-user" aria-hidden="true"></i> ${safeCustomerName}</span>
          <span class="customer-result-meta text-muted">
            ${customer.phone ? `<span><i class="fas fa-phone" aria-hidden="true"></i> ${safeCustomerPhone}</span>` : ''}
            ${customer.email ? `<span><i class="fas fa-envelope" aria-hidden="true"></i> ${safeCustomerEmail}</span>` : ''}
            ${customer.address ? `<span><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${safeCustomerAddress}</span>` : ''}
          </span>
        </button>
      `;
      }).join('');
      
      customerDropdown.classList.remove('d-none');
    } catch (error) {
      console.error('Search error:', error);
      showInlineFeedback(customerSearchFeedbackEl, 'Erreur lors de la recherche client.', 'danger');
      setTimeout(() => clearInlineFeedback(customerSearchFeedbackEl), 3000);
    }
  };

  // Select customer from ID
  const selectCustomerFromID = async (customerId) => {
    try {
      showInlineFeedback(customerSearchFeedbackEl, 'Chargement des informations client…', 'info');

      const customer = filteredCustomers.find(c => c.customer_id === customerId);
      
      if (customer) {
        // Get original customer ID (the one loaded with the report)
        const originalCustomerId = document.getElementById('customer_id').value;
        
        // Update form fields
        document.getElementById('customer_id').value = customer.customer_id;
        document.getElementById('client_name').value = customer.name;
        document.getElementById('client_phone').value = customer.phone || '';
        document.getElementById('client_email').value = customer.email || '';
        document.getElementById('client_address').value = customer.address || '';
        document.getElementById('is_company').checked = customer.is_company;

        // Add a hidden field to indicate this is a customer reassignment
        // Only if selecting a different customer than the original one
        if (originalCustomerId && originalCustomerId !== customer.customer_id) {
          let reassignField = document.getElementById('customer_reassign');
          if (!reassignField) {
            reassignField = document.createElement('input');
            reassignField.type = 'hidden';
            reassignField.id = 'customer_reassign';
            reassignField.name = 'customer_reassign';
            form.appendChild(reassignField);
          }
          reassignField.value = 'true';
          
          // Also store the original customer ID for reference
          let originalCustomerIdField = document.getElementById('original_customer_id');
          if (!originalCustomerIdField) {
            originalCustomerIdField = document.createElement('input');
            originalCustomerIdField.type = 'hidden';
            originalCustomerIdField.id = 'original_customer_id';
            originalCustomerIdField.name = 'original_customer_id';
            form.appendChild(originalCustomerIdField);
          }
          originalCustomerIdField.value = originalCustomerId;
        }

        showInlineFeedback(customerSearchFeedbackEl, 'Informations client chargées.', 'success');
        customerDropdown.classList.add('d-none');
      }

      setTimeout(() => clearInlineFeedback(customerSearchFeedbackEl), 3000);

    } catch (error) {
      console.error('Error selecting customer:', error);
      showInlineFeedback(customerSearchFeedbackEl, 'Erreur lors du chargement du client.', 'danger');
    }
  };
});
