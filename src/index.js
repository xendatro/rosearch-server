async function post(endpoint, body) {
	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		})
		const data = await response.json()
		return data.data
	} catch (e) {
		return null
	}
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function get(endpoint) {
	try {
		const response = await fetch(endpoint, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			},
		})
		const data = await response.json()
		return data
	} catch (e) {
		return null
	}
}

async function getIdFromUsername(username) {
	return await post(`https://users.roblox.com/v1/usernames/users`, {
		usernames: [username],
		excludeBannedUsers: true
	})
}

async function getFollowersCount(id) {
	//return await fetch(`https://friends.roblox.com/v1/users/${id}/followers/count`)
	return await get(`https://friends.roblox.com/v1/users/${id}/followers/count`)
}

async function getFollowingCount(id) {
	return await get(`https://friends.roblox.com/v1/users/${id}/followings/count`)
}

async function getUserGames(id) {
	let cursor = null
	let games = []
	do {
		const gamesData = await get(`https://games.roblox.com/v2/users/${id}/games?limit=50&cursor=${cursor === null ? "" : cursor}`)
		if (gamesData === undefined) return undefined
		cursor = gamesData.nextPageCursor
		games.push(...gamesData.data)
	} while (cursor !== null);
	return games
}

/*
[
{
	groupId,
	groupName,
	groupIsVerified,
	groupMemberCount,
	userRole,
	userRank,
	games: [
		smae as usergames
	]
}
]
*/
async function getGroups(id) {
	let cursor = null
	let groups = []
	const groupsData = await get(`https://groups.roblox.com/v2/users/${id}/groups/roles`)
	if (groupsData === null) return undefined
	
	for (const group of groupsData.data) {
		let t = {
			groupId: group.group.id,
			groupName: group.group.name,
			groupMemberCount: group.group.memberCount,
			groupIsVerified: group.group.hasVerifiedBadge,
			userRole: group.role.name,
			userRank: group.role.rank
		}
		if (t.userRank > 1) { // don't add groups with rank 1, it means absolutely nothing
			let cursor = null
			do {
				const gamesData = await get(`https://games.roblox.com/v2/groups/${t.groupId}/gamesV2?limit=50&cursor=${cursor === null ? "" : cursor}`)
				if (gamesData === undefined) return undefined
				cursor = gamesData.nextPageCursor
					let games = [...gamesData.data]
					t.games = games
				await sleep(10)
			} while (cursor !== null);
		}
		
		groups.push(t)
	}

	return groups
}

async function buildData(username) {
    let t = {};

    // Fetch ID first since all other requests depend on it
    let idData = await getIdFromUsername(username);
    if (!idData) return undefined;

    idData = idData[0];
    t.id = idData.id;
    t.username = idData.name;
    t.isVerified = idData.hasVerifiedBadge;

    // Fire all API calls concurrently
    const [followersData, followingsData, userGamesData, groupsData] = await Promise.all([
        getFollowersCount(t.id),
        getFollowingCount(t.id),
        getUserGames(t.id),
		getGroups(t.id)
    ]);

    // Check if any of them failed
    if (!followersData || !followingsData || !userGamesData || !groupsData) return undefined;

    // Assign the results
    t.followers = followersData.count;
    t.followings = followingsData.count;
    t.userGames = userGamesData;
	t.groupsData = groupsData;

    return t;
}


var src_default = {
	async fetch(request, env, ctx) {
		const url = new URL(request.url)
		const data = await buildData(url.searchParams.get("username"))
		console.log(data)
		return new Response(JSON.stringify(data), {
			headers: {"Content-Type": "application/json"}
		})
	}
};
export {
	src_default as default
};
