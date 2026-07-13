export type FamilyRole = 'parent' | 'child';

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: FamilyRole;
  whatsappNumber: string | null;
  whatsappVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Family = {
  id: string;
  familyCode: string;
  createdBy: string;
  createdAt: string;
};

export type FamilyMembership = {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  status: 'active' | 'pending';
  isAdmin: boolean;
  createdAt: string;
};

export type FamilyMember = FamilyMembership & {
  profile: Profile;
};

export type FamilyRoleFlags = {
  role: FamilyRole | null;
  isAdmin: boolean;
  isParent: boolean;
  isChild: boolean;
};

export type FamilyLoadStatus = 'ready' | 'missing_profile' | 'missing_membership' | 'invalid_family';
