export const BLUEPRINT_LIMITS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  confirmationCodePattern: /^[A-Z0-9-]+$/,
  emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  maxIdLength: 128,
  maxEmailLength: 254,
  maxDisplayNameLength: 100,
  maxPhotoUrlLength: 500,
  maxCompanyNameLength: 120,
  maxIndustryLength: 80,
  maxPhoneLength: 30,
  maxCityLength: 100,
  maxDateLabelLength: 40,
  maxTimeSlotLength: 20,
  maxNotesLength: 500,
  maxAdminNotesLength: 1000,
  maxRecommendationLength: 300,
  maxRecommendationsCount: 5,
  maxProjectedRevenue: 10_000_000,
  maxCallsGrowth: 1000,
} as const;

export function clampText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isValidEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  return (
    trimmed.length >= 3 &&
    trimmed.length <= BLUEPRINT_LIMITS.maxEmailLength &&
    BLUEPRINT_LIMITS.emailPattern.test(trimmed)
  );
}

export function isValidFirestoreId(id: string): boolean {
  return (
    id.length >= 1 &&
    id.length <= BLUEPRINT_LIMITS.maxIdLength &&
    BLUEPRINT_LIMITS.idPattern.test(id)
  );
}

export function sanitizeUserId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `user_${Date.now()}`;
}
