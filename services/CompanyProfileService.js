const CompanyProfileModel = require('../models/CompanyProfileModel');

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeList(items, allowedKeys, meaningfulKeys = allowedKeys) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => allowedKeys.reduce((acc, key) => ({ ...acc, [key]: String(item?.[key] || '').trim() }), {}))
    .filter((item) => meaningfulKeys.some((key) => item[key]));
}

function toDto(profile) {
  if (!profile) {
    return {
      legalName: '',
      ruc: '',
      phones: '',
      whatsappPhones: '',
      address: '',
      email: '',
      industry: '',
      taxRate: 18,
      logoDataUrl: '',
      bankAccounts: [],
      website: '',
      socialLinks: [],
    };
  }

  return {
    ...profile,
    bankAccounts: parseJson(profile.bankAccountsJson),
    socialLinks: parseJson(profile.socialLinksJson),
  };
}

class CompanyProfileService {
  static async getProfile() {
    return toDto(await CompanyProfileModel.get());
  }

  static async saveProfile(data) {
    const profile = {
      legalName: data.legalName,
      ruc: data.ruc,
      phones: data.phones,
      whatsappPhones: data.whatsappPhones,
      address: data.address,
      email: data.email,
      industry: data.industry,
      taxRate: data.taxRate,
      logoDataUrl: data.logoDataUrl,
      bankAccounts: normalizeList(data.bankAccounts, ['bankName', 'accountNumber', 'cci', 'currency', 'holder'], ['bankName', 'accountNumber', 'cci', 'holder']),
      website: data.website,
      socialLinks: normalizeList(data.socialLinks, ['network', 'url']),
    };

    if (profile.logoDataUrl && profile.logoDataUrl.length > 2_500_000) {
      const error = new Error('El logo es demasiado grande. Usa una imagen menor a 2 MB.');
      error.status = 400;
      throw error;
    }

    return toDto(await CompanyProfileModel.upsert(profile));
  }
}

module.exports = CompanyProfileService;
