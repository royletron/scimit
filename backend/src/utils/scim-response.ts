export function formatSCIMUser(user: any) {
  const rawData = JSON.parse(user.raw_data);

  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user.id,
    externalId: user.external_id || undefined,
    userName: user.user_name,
    active: user.active === 1,
    meta: {
      resourceType: 'User',
      created: user.created_at,
      lastModified: user.updated_at,
      version: `W/"${user.meta_version}"`,
      location: `/scim/v2/Users/${user.id}`
    },
    ...rawData
  };
}

export function formatSCIMGroup(group: any, members?: any[]) {
  const rawData = JSON.parse(group.raw_data);

  const formattedMembers = members?.map(m => ({
    value: m.member_id,
    $ref: `/scim/v2/Users/${m.member_id}`,
    type: m.member_type || 'User',
    display: m.display_name
  })) || [];

  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: group.id,
    externalId: group.external_id || undefined,
    displayName: group.display_name,
    members: formattedMembers.length > 0 ? formattedMembers : undefined,
    meta: {
      resourceType: 'Group',
      created: group.created_at,
      lastModified: group.updated_at,
      version: `W/"${group.meta_version}"`,
      location: `/scim/v2/Groups/${group.id}`
    },
    ...rawData
  };
}

export function formatListResponse(resources: any[], totalResults: number, startIndex: number, itemsPerPage: number) {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults,
    startIndex,
    itemsPerPage,
    Resources: resources
  };
}
