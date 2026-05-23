/* eslint-env browser */

window.VirgaVehicleBrandLogos = (() => {
  const defaultBrandKey = 'default';
  const logoBaseUrl = '/static/img/vehicle-brands';

  const brandLogoFiles = Object.freeze({
    default: 'default.svg',
    renault: 'renault.svg',
    volkswagen: 'volkswagen.svg',
    peugeot: 'peugeot.svg',
    citroen: 'citroen.svg',
    dacia: 'dacia.svg',
    toyota: 'toyota.svg',
    ford: 'ford.svg',
    bmw: 'bmw.svg',
    mercedes: 'mercedes-benz.svg',
    audi: 'audi.svg',
    opel: 'opel.svg',
    nissan: 'nissan.svg',
    hyundai: 'hyundai.svg',
    kia: 'kia.svg',
    fiat: 'fiat.svg',
    seat: 'seat.svg',
    skoda: 'skoda.svg',
    mini: 'mini.svg',
    volvo: 'volvo.svg',
    tesla: 'tesla.svg'
  });

  const brandAliases = Object.freeze({
    vw: 'volkswagen',
    volkswagen: 'volkswagen',
    'mercedes-benz': 'mercedes',
    mercedes: 'mercedes',
    benz: 'mercedes',
    citroen: 'citroen',
    citroën: 'citroen',
    peugeot: 'peugeot',
    renault: 'renault',
    dacia: 'dacia',
    toyota: 'toyota',
    ford: 'ford',
    bmw: 'bmw',
    audi: 'audi',
    opel: 'opel',
    nissan: 'nissan',
    hyundai: 'hyundai',
    kia: 'kia',
    fiat: 'fiat',
    seat: 'seat',
    skoda: 'skoda',
    škoda: 'skoda',
    mini: 'mini',
    volvo: 'volvo',
    tesla: 'tesla'
  });

  const normalizeBrandName = (brand) => {
    if (!brand || typeof brand !== 'string') {
      return '';
    }

    return brand
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  };

  const getVehicleBrandKey = (brand) => {
    const normalizedBrand = normalizeBrandName(brand);
    const alias = brandAliases[normalizedBrand];

    if (alias && brandLogoFiles[alias]) {
      return alias;
    }

    if (brandLogoFiles[normalizedBrand]) {
      return normalizedBrand;
    }

    return defaultBrandKey;
  };

  const getVehicleBrandLogo = (brand) => {
    const brandKey = getVehicleBrandKey(brand);
    const fileName = brandLogoFiles[brandKey] || brandLogoFiles[defaultBrandKey];

    return {
      brandKey,
      fileName,
      src: `${logoBaseUrl}/${fileName}`,
      alt: brandKey === defaultBrandKey ? 'Logo marque véhicule' : `Logo ${brand || brandKey}`
    };
  };

  return {
    getVehicleBrandKey,
    getVehicleBrandLogo,
    normalizeBrandName
  };
})();
