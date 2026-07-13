"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapProfile = mapProfile;
exports.mapFamily = mapFamily;
exports.mapMembership = mapMembership;
exports.selectActiveMembership = selectActiveMembership;
exports.getFamilyRoleFlags = getFamilyRoleFlags;
exports.mapFamilyMembers = mapFamilyMembers;
exports.getFamilyLoadStatus = getFamilyLoadStatus;
exports.clearFamilyState = clearFamilyState;
function mapProfile(row) {
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
function mapFamily(row) {
    return {
        id: row.id,
        familyCode: row.family_code,
        createdBy: row.created_by,
        createdAt: row.created_at,
    };
}
function mapMembership(row) {
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
function selectActiveMembership(memberships, preferredFamilyId) {
    const active = memberships
        .filter((membership) => membership.status === 'active')
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return (active.find((membership) => membership.familyId === preferredFamilyId) ??
        active[0] ??
        null);
}
function getFamilyRoleFlags(membership) {
    const role = membership?.role ?? null;
    return {
        role,
        isAdmin: Boolean(membership?.isAdmin),
        isParent: role === 'parent',
        isChild: role === 'child',
    };
}
function mapFamilyMembers(memberships, profiles, familyId) {
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    return memberships
        .filter((membership) => membership.familyId === familyId && membership.status === 'active')
        .map((membership) => {
        const profile = profilesById.get(membership.userId);
        return profile ? { ...membership, profile } : null;
    })
        .filter((member) => member !== null)
        .sort((left, right) => {
        if (left.profile.role !== right.profile.role) {
            return left.profile.role === 'parent' ? -1 : 1;
        }
        return left.profile.fullName.localeCompare(right.profile.fullName);
    });
}
function getFamilyLoadStatus(input) {
    if (!input.profile)
        return 'missing_profile';
    if (!input.currentMembership)
        return 'missing_membership';
    if (!input.activeFamily || input.familyMembers.length === 0)
        return 'invalid_family';
    return 'ready';
}
function clearFamilyState() {
    return {
        profile: null,
        activeFamily: null,
        currentMembership: null,
        familyMembers: [],
    };
}
