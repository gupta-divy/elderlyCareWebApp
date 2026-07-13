const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clearFamilyState,
  getFamilyLoadStatus,
  getFamilyRoleFlags,
  mapFamily,
  mapFamilyMembers,
  mapMembership,
  mapProfile,
  selectActiveMembership,
} = require('../.codex-tests/features/family/familyData.js');

const familyA = mapFamily({
  id: 'family-a',
  family_code: 'FAM-AAAAAA',
  created_by: 'child-a',
  created_at: '2026-07-01T10:00:00.000Z',
});

const parentProfile = mapProfile({
  id: 'parent-a',
  full_name: 'Asha Parent',
  role: 'parent',
  email: 'asha@example.com',
  whatsapp_number: '+14155550123',
  whatsapp_verified: false,
});

const childProfile = mapProfile({
  id: 'child-a',
  full_name: 'Dev Child',
  role: 'child',
  email: 'dev@example.com',
  whatsapp_number: null,
  whatsapp_verified: false,
});

function membership(overrides) {
  return mapMembership({
    id: 'member-a',
    family_id: 'family-a',
    user_id: 'child-a',
    role: 'child',
    status: 'active',
    is_admin: true,
    created_at: '2026-07-01T10:00:00.000Z',
    ...overrides,
  });
}

test('selects the earliest active family membership by default', () => {
  const selected = selectActiveMembership([
    membership({
      id: 'later',
      family_id: 'family-b',
      created_at: '2026-07-02T10:00:00.000Z',
    }),
    membership({
      id: 'earlier',
      family_id: 'family-a',
      created_at: '2026-07-01T10:00:00.000Z',
    }),
  ]);

  assert.equal(selected?.familyId, 'family-a');
});

test('honors a preferred active family when present', () => {
  const selected = selectActiveMembership(
    [
      membership({
        id: 'earlier',
        family_id: 'family-a',
        created_at: '2026-07-01T10:00:00.000Z',
      }),
      membership({
        id: 'later',
        family_id: 'family-b',
        created_at: '2026-07-02T10:00:00.000Z',
      }),
    ],
    'family-b',
  );

  assert.equal(selected?.familyId, 'family-b');
});

test('computes role and permission helpers from current membership', () => {
  const flags = getFamilyRoleFlags(membership({ role: 'child', is_admin: true }));

  assert.deepEqual(flags, {
    role: 'child',
    isAdmin: true,
    isParent: false,
    isChild: true,
  });
});

test('maps family members only inside the active family', () => {
  const members = mapFamilyMembers(
    [
      membership({ id: 'child-a', user_id: 'child-a', role: 'child' }),
      membership({ id: 'parent-a', user_id: 'parent-a', role: 'parent', is_admin: false }),
      membership({
        id: 'other-family',
        family_id: 'family-b',
        user_id: 'child-b',
        role: 'child',
      }),
    ],
    [childProfile, parentProfile],
    'family-a',
  );

  assert.deepEqual(
    members.map((member) => [member.userId, member.profile.fullName]),
    [
      ['parent-a', 'Asha Parent'],
      ['child-a', 'Dev Child'],
    ],
  );
});

test('reports missing membership separately from missing profile', () => {
  assert.equal(
    getFamilyLoadStatus({
      profile: childProfile,
      activeFamily: null,
      currentMembership: null,
      familyMembers: [],
    }),
    'missing_membership',
  );
});

test('reports invalid family data when membership has no readable family members', () => {
  assert.equal(
    getFamilyLoadStatus({
      profile: childProfile,
      activeFamily: familyA,
      currentMembership: membership({}),
      familyMembers: [],
    }),
    'invalid_family',
  );
});

test('clears shared family state on logout', () => {
  assert.deepEqual(clearFamilyState(), {
    profile: null,
    activeFamily: null,
    currentMembership: null,
    familyMembers: [],
  });
});
