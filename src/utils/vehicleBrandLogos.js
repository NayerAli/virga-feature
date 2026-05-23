const fs = require('fs');
const path = require('path');

const VEHICLE_BRAND_LOGO_BASE_URL = '/static/img/vehicle-brands';
const VEHICLE_BRAND_LOGO_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'vehicle-brands');
const DEFAULT_BRAND_KEY = 'default';

const BRAND_LOGO_FILES = Object.freeze({
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

const BRAND_ALIASES = Object.freeze({
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
  const alias = BRAND_ALIASES[normalizedBrand];

  if (alias && BRAND_LOGO_FILES[alias]) {
    return alias;
  }

  if (BRAND_LOGO_FILES[normalizedBrand]) {
    return normalizedBrand;
  }

  return DEFAULT_BRAND_KEY;
};

const getVehicleBrandLogo = (brand) => {
  const brandKey = getVehicleBrandKey(brand);
  const fileName = BRAND_LOGO_FILES[brandKey] || BRAND_LOGO_FILES[DEFAULT_BRAND_KEY];

  return {
    brandKey,
    fileName,
    src: `${VEHICLE_BRAND_LOGO_BASE_URL}/${fileName}`,
    alt: brandKey === DEFAULT_BRAND_KEY
      ? 'Logo marque véhicule'
      : `Logo ${brand || brandKey}`
  };
};

const getVehicleBrandLogoPath = (brand) => {
  const { fileName } = getVehicleBrandLogo(brand);
  const logoPath = path.resolve(VEHICLE_BRAND_LOGO_DIR, fileName);
  const basePath = path.resolve(VEHICLE_BRAND_LOGO_DIR);

  if (!logoPath.startsWith(`${basePath}${path.sep}`)) {
    return null;
  }

  if (!fs.existsSync(logoPath)) {
    const fallbackPath = path.resolve(VEHICLE_BRAND_LOGO_DIR, BRAND_LOGO_FILES[DEFAULT_BRAND_KEY]);
    return fs.existsSync(fallbackPath) ? fallbackPath : null;
  }

  return logoPath;
};

module.exports = {
  BRAND_LOGO_FILES,
  BRAND_ALIASES,
  getVehicleBrandKey,
  getVehicleBrandLogo,
  getVehicleBrandLogoPath,
  normalizeBrandName
};
