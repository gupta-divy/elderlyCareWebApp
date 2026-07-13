import type {
  Family,
  FamilyLoadStatus,
  FamilyMember,
  FamilyMembership,
  FamilyRole,
  FamilyRoleFlags,
  Profile,
} from './types';

export type ProfileRow = {
  id: string;
  full_name: string;
  role: FamilyRole;
  email: string;
  whatsapp_number: string | null;
  whatsapp_verified: boolean;
  created_at?: string;
  updated_at?: string;
};

export type FamilyRow = {
  id: string;
  family_code: string;
  created_by: string;
  created_at: string;
};

export type FamilyMembershipRow = {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  status: 'active' | 'pending';
  is_admin?: boolean | null;
  created_at: string;
};

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    whatsappNumber: row.whatsapp_number,
    whatsappVerified: row.whatsapp_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFamily(row: FamilyRow): Family {
  return {
    id: row.id,
    familyCode: row.family_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapMembership(row: FamilyMembershipRow): FamilyMembership {
  return {
    id: row.id,
    familyId: row.family_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
  };
}

export function selectActiveMembership(
  memberships: FamilyMembership[],
  preferredFamilyId?: string | null,
) {
  const active = memberships
    .filter((membership) => membership.status === 'active')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return (
    active.find((membership) => membership.familyId === preferredFamilyId) ??
    active[0] ??
    null
  );
}

export function getFamilyRoleFlags(
  membership: FamilyMembership | null | undefined,
): FamilyRoleFlags {
  const role = membership?.role ?? null;

  return {
    role,
    isAdmin: Boolean(membership?.isAdmin),
    isParent: role === 'parent',
    isChild: role === 'child',
  };
}

export function mapFamilyMembers(
  memberships: FamilyMembership[],
  profiles: Profile[],
  familyId: string,
) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return memberships
    .filter((membership) => membership.familyId === familyId && membership.status === 'active')
    .map((membership) => {
      const profile = profilesById.get(membership.userId);
      return profile ? ({ ...membership, profile } satisfies FamilyMember) : null;
    })
    .filter((member): member is FamilyMember => member !== null)
    .sort((left, right) => {
      if (left.profile.role !== right.profile.role) {
        return left.profile.role === 'parent' ? -1 : 1;
      }
      return left.profile.fullName.localeCompare(right.profile.fullName);
    });
}

export function getFamilyLoadStatus(input: {
  profile: Profile | null;
  currentMembership: FamilyMembership | null;
  activeFamily: Family | null;
  familyMembers: FamilyMember[];
}): FamilyLoadStatus {
  if (!input.profile) return 'missing_profile';
  if (!input.currentMembership) return 'missing_membership';
  if (!input.activeFamily || input.familyMembers.length === 0) return 'invalid_family';
  return 'ready';
}

export function clearFamilyState() {
  return {
    profile: null,
    activeFamily: null,
    currentMembership: null,
    familyMembers: [],
  };
}
