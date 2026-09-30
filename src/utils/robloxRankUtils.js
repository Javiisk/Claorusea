// src/utils/robloxRankUtils.js

const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

// Returns every rank in the group, sorted from lowest to highest.
export async function getGroupRoles() {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  const data = await res.json();
  return (data.roles || []).sort((a, b) => a.rank - b.rank);
}

// Matches a rank by name, rank number, or rank ID (same fuzzy match /setrank used).
export function findRoleByInput(roles, input) {
  return roles.find(r =>
    r.name.toLowerCase() === input.toLowerCase() ||
    String(r.rank) === input ||
    String(r.id) === input
  );
}

// Splits "user1, user2, user3" into a clean array, capped at 15 entries.
export function parseUsernameList(input) {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 15);
}

// Resolves multiple Roblox usernames to their IDs in a single request.
export async function resolveRobloxUsers(usernames) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames, excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data || []; // [{ requestedUsername, id, name, ... }]
}

export async function getCurrentRoleForUser(userId) {
  const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
  const data = await res.json();
  const group = data.data?.find(g => String(g.group.id) === String(GROUP_ID));
  return group ? { id: group.role.id, name: group.role.name, rank: group.role.rank } : null;
}

export async function setRank(userId, roleId) {
  try {
    const res = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?filter=user=='users/${userId}'`,
      { headers: { 'x-api-key': API_KEY } }
    );
    const data = await res.json();
    let membership = data.groupMemberships?.[0];

    if (!membership) {
      const res2 = await fetch(
        `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?maxPageSize=1&filter=user==users/${userId}`,
        { headers: { 'x-api-key': API_KEY } }
      );
      const data2 = await res2.json();
      membership = data2.groupMemberships?.[0];
      if (!membership) return { success: false, error: 'User is not in the group.' };
    }

    const membershipId = membership.path.split('/').pop();
    const updateRes = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${membershipId}`,
      {
        method: 'PATCH',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: `groups/${GROUP_ID}/roles/${roleId}` }),
      }
    );

    if (updateRes.ok) return { success: true };
    const err = await updateRes.json();
    return { success: false, error: err.message || 'Failed to update rank.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
