const {
  getVehicleBrandKey,
  getVehicleBrandLogo,
  getVehicleBrandLogoPath,
  normalizeBrandName
} = require('../src/utils/vehicleBrandLogos');

describe('vehicleBrandLogos', () => {
  test('normalizes brand names safely', () => {
    expect(normalizeBrandName(' Renault ')).toBe('renault');
    expect(normalizeBrandName('Citroën')).toBe('citroen');
    expect(normalizeBrandName('Mercedes Benz')).toBe('mercedes-benz');
  });

  test('resolves known brands and aliases', () => {
    expect(getVehicleBrandKey('Renault')).toBe('renault');
    expect(getVehicleBrandKey('VW')).toBe('volkswagen');
    expect(getVehicleBrandKey('Citroën')).toBe('citroen');
    expect(getVehicleBrandKey('Mercedes-Benz')).toBe('mercedes');
  });

  test('falls back for unknown or unsafe brands', () => {
    expect(getVehicleBrandKey('../../etc/passwd')).toBe('default');
    expect(getVehicleBrandKey('https://evil.example/logo.svg')).toBe('default');
    expect(getVehicleBrandLogo('').src).toBe('/static/img/vehicle-brands/default.svg');
  });

  test('returns a local existing logo path', () => {
    expect(getVehicleBrandLogoPath('Renault')).toMatch(/public\/img\/vehicle-brands\/renault\.svg$/);
    expect(getVehicleBrandLogoPath('../../etc/passwd')).toMatch(/public\/img\/vehicle-brands\/default\.svg$/);
  });
});
