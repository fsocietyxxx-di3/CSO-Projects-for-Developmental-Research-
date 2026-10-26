/**
 * @cso-registry/shared — the single source of truth for the API contract.
 * Zod schemas here are validated on the API boundary AND drive frontend forms,
 * so field rules exist exactly once in the codebase.
 */
import { z } from "zod";

/* ---------------------------------- roles --------------------------------- */

export const ROLES = ["ADMIN", "PRESIDENT"] as const;
export type Role = (typeof ROLES)[number];

/* --------------------------------- members -------------------------------- */

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export const MEMBERSHIP_STATUSES = ["ACTIVE", "PENDING", "CLEARED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const memberInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  middleName: z.string().trim().max(80).optional(),
  birthdate: z.coerce.date({
    errorMap: () => ({ message: "Birthdate is required (YYYY-MM-DD)" }),
  }),
  gender: z.enum(GENDERS),
  address: z.string().trim().min(1, "Address is required").max(255),
  barangay: z.string().trim().min(1, "Barangay is required").max(120),
  householdId: z.string().trim().max(64).optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Member consent must be accepted (RA 10173)" }),
  }),
});
export type MemberInput = z.infer<typeof memberInputSchema>;

/**
 * Enroll body — two paths:
 *  1. NEW person: all memberInputSchema fields, no existingMemberId.
 *  2. SAME person in a second org: pass existingMemberId from the duplicate panel;
 *     API verifies the exact match (name+birthdate) before creating ONLY a new Membership.
 */
export const memberEnrollSchema = memberInputSchema.extend({
  existingMemberId: z.string().uuid().optional(),
  /** Admin encodes into a chosen org; presidents are locked to their own. */
  organizationId: z.string().uuid().optional(),
});
export type MemberEnrollInput = z.infer<typeof memberEnrollSchema>;

/** Payload sent to the duplicate-check endpoint before a member is saved. */
export const duplicateCheckInputSchema = memberInputSchema.pick({
  firstName: true,
  lastName: true,
  middleName: true,
  birthdate: true,
  barangay: true,
});
export type DuplicateCheckInput = z.infer<typeof duplicateCheckInputSchema>;

/** A candidate match returned by the duplicate-check endpoint. */
export interface MemberHit {
  memberId: string;
  fullName: string;
  birthdate: string;
  barangay: string;
  organizationNames: string[];
  /** "exact" = name+birthdate match, "soft" = fuzzy name match — review before merging. */
  matchType: "exact" | "soft";
}

/** Response shape of POST /api/v1/members/duplicate-check */
export interface DuplicateCheckResult {
  duplicates: MemberHit[];
}

/* ------------------------------ organizations ------------------------------ */

export const ACCREDITATION_STATUSES = [
  "PENDING",
  "ACCREDITED",
  "RENEWAL_DUE",
  "LAPSED",
] as const;
export type AccreditationStatus = (typeof ACCREDITATION_STATUSES)[number];

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(3, "Organization name is required").max(160),
  type: z.string().trim().max(120).optional(), // NGO, federation, foundation…
  about: z.string().trim().max(2000).optional(),
  barangay: z.string().trim().max(120).optional(),
  accreditationStatus: z.enum(ACCREDITATION_STATUSES).default("PENDING"),
  accreditationValidUntil: z.coerce.date().optional().nullable(),
  allotment: z.coerce.number().int().min(0).max(1000).default(20),
});
export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;

export const organizationUpdateSchema = organizationCreateSchema.partial();
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;

export interface OrganizationSummary {
  id: string;
  name: string;
  type?: string | null;
  barangay?: string | null;
  accreditationStatus: AccreditationStatus;
  accreditationValidUntil?: string | null;
  allotment: number;
  activeMemberCount: number;
}

/* -------------------------------- assistance ------------------------------- */

export const assistanceSchema = z.object({
  memberId: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: z.string().trim().min(1, "Assistance type is required").max(80), // e.g. AYUDA, MEDICAL, BURIAL
  items: z.string().trim().max(500).optional(),
  amount: z.coerce.number().min(0).max(1_000_000).optional(),
});
export type AssistanceInput = z.infer<typeof assistanceSchema>;

/** POST /assistances body — org pinned server-side for presidents; override is ADMIN-only. */
export const assistanceRecordSchema = assistanceSchema.extend({
  organizationId: z.string().uuid().optional(), // required for admins; locked for presidents
  receivedAt: z.coerce.date().optional(), // defaults to now (back-datable entries)
  override: z.boolean().optional(), // admins may exceed the allotment ONLY
});
export type AssistanceRecordInput = z.infer<typeof assistanceRecordSchema>;

/* --------------------- ledger summaries & batch suggestion ------------------ */

export interface MemberLite {
  id: string;
  name: string; // "Last, First"
  barangay: string;
}

export interface AllotmentSummary {
  organizationId: string;
  organizationName: string;
  allotment: number;
  aidedDistinct: number; // different people who ever received
  entries: number; // raw ledger rows
  repeats: Array<MemberLite & { times: number }>; // the "Si Eva" flags
  unused: number; // allotment - aidedDistinct (>= 0 when within cap)
}

/** GET /assistances/next-eligible — fair-rotation suggestion (tenure-first). */
export interface NextEligibleMember extends MemberLite {
  joinedAt: string; // membership joinedAt
}

export interface NextEligibleResult {
  organizationId: string;
  count: number; // suggestions returned
  totalEligible: number; // pool size (members with zero entries)
  next: NextEligibleMember[];
}

/* ---------------------------------- reports --------------------------------- */

/** Sprint 4 — aggregates behind the Reports screen + exports. */
export interface ReportOrgRow {
  name: string;
  activeMembers: number;
  entries: number; // assistance rows
  recipients: number; // distinct people aided
  allotment: number;
}
export interface ReportBarangayRow {
  barangay: string;
  members: number;
  recipients: number; // distinct people aided, same barangay
}
export interface ReportGenderRow {
  gender: string;
  label: string; // Male / Female / Other
  members: number;
  recipients: number;
  amount: number; // PHP total of entries
}
export interface ReportTypeRow {
  type: string;
  entries: number;
  amount: number;
}
export interface ReportSummary {
  generatedAt: string;
  scope: "ALL_ORGS" | "OWN_ORG";
  totals: { members: number; organizations: number; entries: number; recipients: number; amountTotal: number };
  byOrg: ReportOrgRow[];
  byBarangay: ReportBarangayRow[];
  byGender: ReportGenderRow[];
  byType: ReportTypeRow[];
}

/* --------------------------- admin: user accounts -------------------------- */
/** Presidents cannot self-register — the CSO Desk admin creates their accounts. */
export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.enum(ROLES).default("PRESIDENT"),
  organizationId: z.string().uuid().optional().nullable(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export interface UserSummary {
  id: string;
  authId: string;
  email: string;
  name: string;
  role: Role;
  organizationId?: string | null;
}

/* ---------------------------------- misc ----------------------------------- */

export interface ApiError {
  error: string;
  detail?: string;
}
