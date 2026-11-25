export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type PlanTier = 'Growth Audit' | 'Local Domination' | 'Enterprise';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type AuditStatus = 'submitted' | 'in_review' | 'blueprint_ready';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  status: AccountStatus;
  companyName: string;
  industry: string;
  phone: string;
  planTier: PlanTier;
  projectedRevenue: number;
  inboundCallsGrowth: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BookingRecord {
  id: string;
  userId: string;
  userEmail: string;
  contactName: string;
  workEmail: string;
  companyName: string;
  dateLabel: string;
  timeSlot: string;
  status: BookingStatus;
  confirmationCode: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditRecord {
  id: string;
  userId: string;
  companyName: string;
  city: string;
  monthlyCalls: number;
  avgTicketValue: number;
  monthlyAdSpend: number;
  currentReviews: number;
  projectedExtraRevenue: number;
  projectedCallsLiftPct: number;
  visibilityScore: number;
  recommendations: string[];
  status: AuditStatus;
  adminNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SlotDate {
  id: string;
  label: string;
  dateText: string;
  fullLabel: string;
}

export interface SlotsResponse {
  timezone: string;
  dates: SlotDate[];
  timeSlots: string[];
}
