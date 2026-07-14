import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useApp, type AuthenticatedFamilyProfile } from '../context/AppContext';
import {
  clearFamilyState,
  getFamilyLoadStatus,
  getFamilyRoleFlags,
  mapFamily,
  mapFamilyMembers,
  mapMembership,
  mapProfile,
  selectActiveMembership,
  type FamilyMembershipRow,
  type FamilyRow,
  type ProfileRow,
} from '../features/family/familyData';
import type {
  Family,
  FamilyLoadStatus,
  FamilyMember,
  FamilyMembership,
  FamilyRole,
  Profile,
} from '../features/family/types';
import { friendlyAuthError } from '../lib/auth/errors';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';
import { useAuth } from './AuthContext';

type ProfileUpdateResult = {
  profile: Profile;
  emailConfirmationRequired: boolean;
};

type FamilyContextValue = {
  profile: Profile | null;
  activeFamily: Family | null;
  currentMembership: FamilyMembership | null;
  familyMembers: FamilyMember[];
  familyProfiles: AuthenticatedFamilyProfile[];
  role: FamilyRole | null;
  isAdmin: boolean;
  isParent: boolean;
  isChild: boolean;
  loading: boolean;
  error: string | null;
  status: FamilyLoadStatus | null;
  refreshFamily: () => Promise<Profile | null>;
  updateProfile: (details: {
    fullName: string;
    email: string;
    whatsappNumber: string | null;
  }) => Promise<ProfileUpdateResult>;
  clearFamily: () => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

function toFriendlyFamilyError(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/failed to fetch|network/i.test(error.message)) {
      return 'We could not reach Supabase. Please check your connection and try again.';
    }
    if (/relation .* does not exist/i.test(error.message)) {
      return 'Supabase family tables are not ready yet. Please run the latest migration.';
    }
    if (/permission denied|42501|row-level security/i.test(error.message)) {
      return 'Your account does not have access to that family data.';
    }
  }

  return 'We could not load your family workspace. Please try again.';
}

function toFamilyProfiles(members: FamilyMember[]) {
  return members.map((member) => ({
    id: member.profile.id,
    fullName: member.profile.fullName,
    email: member.profile.email,
    role: member.profile.role,
    whatsappNumber: member.profile.whatsappNumber,
  }));
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user, authLoading } = useAuth();
  const {
    currentUser,
    isDemoMode,
    logout: clearLocalUser,
    state,
    syncAuthenticatedProfile,
    updateCurrentUserProfile,
  } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [currentMembership, setCurrentMembership] = useState<FamilyMembership | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearFamily = useCallback(() => {
    const empty = clearFamilyState();
    setProfile(empty.profile);
    setActiveFamily(empty.activeFamily);
    setCurrentMembership(empty.currentMembership);
    setFamilyMembers(empty.familyMembers);
    setError(null);
    clearLocalUser();
  }, [clearLocalUser]);

  const loadDemoFamily = useCallback(() => {
    if (!currentUser) {
      clearFamily();
      return null;
    }

    const now = new Date().toISOString();
    const nextProfile: Profile = {
      id: currentUser.id,
      fullName: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      whatsappNumber: currentUser.phoneNumber ?? null,
      whatsappVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    const nextFamily = {
      id: 'family-demo',
      familyCode: 'DEMO42',
      createdBy: 'child-1',
      createdAt: now,
    };
    const nextMembers: FamilyMember[] = state.users.map((familyUser) => ({
      id: `demo-member-${familyUser.id}`,
      familyId: nextFamily.id,
      userId: familyUser.id,
      role: familyUser.role,
      status: 'active',
      isAdmin: familyUser.role === 'child',
      createdAt: now,
      profile: {
        id: familyUser.id,
        fullName: familyUser.name,
        email: familyUser.email,
        role: familyUser.role,
        whatsappNumber: familyUser.phoneNumber ?? null,
        whatsappVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    }));
    const nextMembership = nextMembers.find((member) => member.userId === currentUser.id) ?? null;

    setProfile(nextProfile);
    setActiveFamily(nextFamily);
    setCurrentMembership(nextMembership);
    setFamilyMembers(nextMembers);
    setError(null);
    setLoading(false);

    return nextProfile;
  }, [clearFamily, currentUser, state.users]);

  const refreshFamily = useCallback(async (): Promise<Profile | null> => {
    if (isDemoMode) {
      return loadDemoFamily();
    }

    if (!user || !isSupabaseConfigured) {
      clearFamily();
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, email, whatsapp_number, whatsapp_verified, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const nextProfile = profileData ? mapProfile(profileData as ProfileRow) : null;
      setProfile(nextProfile);

      if (!nextProfile) {
        setActiveFamily(null);
        setCurrentMembership(null);
        setFamilyMembers([]);
        clearLocalUser();
        return null;
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from('family_members')
        .select('id, family_id, user_id, role, status, is_admin, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (membershipError) throw membershipError;

      const memberships = ((membershipData as FamilyMembershipRow[] | null) ?? [])
        .map(mapMembership);
      const nextMembership = selectActiveMembership(memberships);

      if (!nextMembership) {
        setActiveFamily(null);
        setCurrentMembership(null);
        setFamilyMembers([]);
        clearLocalUser();
        return nextProfile;
      }

      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('id, family_code, created_by, created_at')
        .eq('id', nextMembership.familyId)
        .maybeSingle();

      if (familyError) throw familyError;

      const nextFamily = familyData ? mapFamily(familyData as FamilyRow) : null;
      if (!nextFamily) {
        setActiveFamily(null);
        setCurrentMembership(nextMembership);
        setFamilyMembers([]);
        setError('We could not verify your family workspace. Please retry or sign out.');
        clearLocalUser();
        return nextProfile;
      }

      const { data: memberRows, error: membersError } = await supabase
        .from('family_members')
        .select('id, family_id, user_id, role, status, is_admin, created_at')
        .eq('family_id', nextMembership.familyId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;

      const nextMemberships = ((memberRows as FamilyMembershipRow[] | null) ?? [])
        .map(mapMembership);
      const memberProfileIds = [...new Set(nextMemberships.map((member) => member.userId))];

      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, role, email, whatsapp_number, whatsapp_verified, created_at, updated_at')
        .in('id', memberProfileIds.length > 0 ? memberProfileIds : [user.id]);

      if (profilesError) throw profilesError;

      const profiles = ((profileRows as ProfileRow[] | null) ?? []).map(mapProfile);
      const nextMembers = mapFamilyMembers(nextMemberships, profiles, nextMembership.familyId);

      setCurrentMembership(nextMembership);
      setActiveFamily(nextFamily);
      setFamilyMembers(nextMembers);

      syncAuthenticatedProfile({
        ...nextProfile,
        familyId: nextMembership.familyId,
        familyCode: nextFamily.familyCode,
        familyProfiles: toFamilyProfiles(nextMembers),
      });

      return nextProfile;
    } catch (familyError) {
      const message = toFriendlyFamilyError(familyError);
      setError(message);
      setActiveFamily(null);
      setCurrentMembership(null);
      setFamilyMembers([]);
      clearLocalUser();
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearFamily, clearLocalUser, isDemoMode, loadDemoFamily, syncAuthenticatedProfile, user]);

  const updateProfile = useCallback(
    async (details: {
      fullName: string;
      email: string;
      whatsappNumber: string | null;
    }): Promise<ProfileUpdateResult> => {
      if (!user || !profile || !isSupabaseConfigured) {
        if (isDemoMode && profile) {
          const nextFullName = details.fullName.trim().replace(/\s+/g, ' ');
          const nextEmail = details.email.trim().toLowerCase();
          const nextWhatsapp = details.whatsappNumber?.trim() || null;
          const nextProfile = {
            ...profile,
            fullName: nextFullName,
            email: nextEmail,
            whatsappNumber: nextWhatsapp,
            updatedAt: new Date().toISOString(),
          };
          updateCurrentUserProfile({
            fullName: nextFullName,
            email: nextEmail,
            whatsappNumber: nextWhatsapp,
          });
          setProfile(nextProfile);
          setFamilyMembers((members) =>
            members.map((member) =>
              member.userId === profile.id
                ? {
                    ...member,
                    profile: nextProfile,
                  }
                : member,
            ),
          );
          return { profile: nextProfile, emailConfirmationRequired: false };
        }
        throw new Error('PROFILE_NOT_READY');
      }

      const nextFullName = details.fullName.trim().replace(/\s+/g, ' ');
      const nextEmail = details.email.trim().toLowerCase();
      const nextWhatsapp = details.whatsappNumber?.trim() || null;
      const currentAuthEmail = user.email?.trim().toLowerCase() ?? '';
      const supabase = createClient();

      setError(null);

      try {
        let emailConfirmationRequired = false;
        if (nextEmail !== currentAuthEmail) {
          const { data, error: authUpdateError } = await supabase.auth.updateUser({
            email: nextEmail,
          });
          if (authUpdateError) throw authUpdateError;
          emailConfirmationRequired = data.user?.email !== nextEmail;
        }

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            full_name: nextFullName,
            email: emailConfirmationRequired ? profile.email : nextEmail,
            whatsapp_number: nextWhatsapp,
          })
          .eq('id', user.id);

        if (profileUpdateError) throw profileUpdateError;

        const refreshedProfile = await refreshFamily();
        if (!refreshedProfile) throw new Error('PROFILE_REFRESH_FAILED');

        return { profile: refreshedProfile, emailConfirmationRequired };
      } catch (updateError) {
        const message = /email|auth/i.test(String((updateError as { message?: string }).message ?? ''))
          ? friendlyAuthError(updateError)
          : toFriendlyFamilyError(updateError);
        setError(message);
        throw new Error(message);
      }
    },
    [isDemoMode, profile, refreshFamily, updateCurrentUserProfile, user],
  );

  const userId = user?.id ?? null;

  useEffect(() => {
    if (authLoading) return;
    if (isDemoMode) return;
    if (!userId) {
      clearFamily();
      return;
    }

    void refreshFamily();
  }, [authLoading, clearFamily, isDemoMode, userId]);

  useEffect(() => {
    if (authLoading || !isDemoMode) return;
    void loadDemoFamily();
  }, [authLoading, isDemoMode, loadDemoFamily]);

  const flags = getFamilyRoleFlags(currentMembership);
  const status = getFamilyLoadStatus({
    profile,
    activeFamily,
    currentMembership,
    familyMembers,
  });

  const value = useMemo<FamilyContextValue>(
    () => ({
      profile,
      activeFamily,
      currentMembership,
      familyMembers,
      familyProfiles: toFamilyProfiles(familyMembers),
      role: flags.role,
      isAdmin: flags.isAdmin,
      isParent: flags.isParent,
      isChild: flags.isChild,
      loading,
      error,
      status,
      refreshFamily,
      updateProfile,
      clearFamily,
    }),
    [
      activeFamily,
      clearFamily,
      currentMembership,
      error,
      familyMembers,
      flags.isAdmin,
      flags.isChild,
      flags.isParent,
      flags.role,
      loading,
      profile,
      refreshFamily,
      status,
      updateProfile,
    ],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily must be used within FamilyProvider');
  return context;
}
