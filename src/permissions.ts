import { readFileSync, writeFileSync } from "fs";

export enum PermissionTier {
    ME = "me",
    FRIENDS = "friends",
    EVERYONE = "everyone"
}
type PermissionGroupItem = { users?: string[]; guilds?: string[] };
type PermissionGroups = Record<PermissionTier, PermissionGroupItem>;

const groups: PermissionGroups = {
    me: {
        users: [""],
        guilds: [""]
    },
    friends: {
        users: [""],
        guilds: [""]
    },
    everyone: {}
};

let exists = false;
try {
    const file = readFileSync("./permissions.json", "utf8");
    exists = true;
    const permissions = JSON.parse(file);
    if (!["me", "friends"].every(p => typeof permissions[p] === "object" || typeof permissions[p] === "undefined"))
        throw "oopsie daisy";
    groups.me = permissions.me;
    groups.friends = permissions.friends;
    groups.everyone = {};
} catch {
    if (!exists) writeFileSync("./permissions.json", JSON.stringify({
        me: {
            users: [""],
            guilds: [""]
        },
        friends: {
            users: [""],
            guilds: [""]
        }
    }, null, 4));
    else console.error("Failed to parse permissions.json file");
}

export function getPermissionTier(
    user: { id: string } | string,
    guild?: { id: string } | string | null
): PermissionTier {
    if (typeof user === "object") user = user.id;
    if (typeof guild === "object") guild = guild?.id;
    for (const [tier, members] of Object.entries(groups)) {
        if ((members as PermissionGroupItem).users?.includes(user)
            || (guild && (members as PermissionGroupItem).guilds?.includes(guild))
        )
            return tier as PermissionTier;
    }

    return PermissionTier.EVERYONE;
}
