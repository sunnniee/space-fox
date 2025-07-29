import groups from "../permissions.json" with { type: "json" };
export enum PermissionTier {
    ME = "me",
    FRIENDS = "friends",
    EVERYONE = "everyone"
}

type PermissionGroupItem = { users?: string[]; guilds?: string[] };
type PermissionGroups = Record<PermissionTier, PermissionGroupItem>;
groups satisfies PermissionGroups;
/*
{
    "me": {
        "users": ["1234"]
    },
    "friends": {
        "users": ["1234"],
        "guilds": ["5678"]
    },
    "everyone": { leave empty }
}
*/

export function getPermissionTier(user: { id: string } | string, guild?: { id: string } | string): PermissionTier {
    if (typeof user === "object") user = user.id;
    if (typeof guild === "object") guild = guild?.id;
    for (const [tier, members] of Object.entries(groups)) {
        if ((members as PermissionGroupItem).users?.includes(user)
            || (members as PermissionGroupItem).guilds?.includes(guild)
        )
            return tier as PermissionTier;
    }

    return PermissionTier.EVERYONE;
}
