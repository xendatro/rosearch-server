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

async function getDetailedGameData(games) {
  let gameIds = games.map((game) => game.id)
  const n = 20
  let i = 0
  while (i < games.length) {
    console.log(i, i+n)
    let details = await get(`https://games.roblox.com/v1/games?universeIds=${gameIds.slice(i, i+n).toString()}`)
	let thumbnails = await get(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${gameIds.slice(i, i+n).toString()}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`)
    for (let x = 0; x < details.data.length; x++) {
      let gameDetails = details.data[x]
	  let thumbDetails = thumbnails.data[x]
      games[i+x].universeId = gameDetails.id
      games[i+x].rootPlaceId = gameDetails.rootPlaceId
      games[i+x].playing = gameDetails.playing
      games[i+x].favoritedCount = gameDetails.favoritedCount
      games[i+x].visits = gameDetails.visits
	  games[i+x].genre = gameDetails.genre
	  games[i+x].thumbnails = thumbDetails.thumbnails
      console.log(games[i+x])
    }
    i += n
  }
  console.log(games)
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
	await getDetailedGameData(games)
	return games
}

async function getGroups(id) {
    let cursor = null;
    let groups = [];

	  let groupGames = [];

    let count = 0

    const groupsData = await get(`https://groups.roblox.com/v2/users/${id}/groups/roles`);
    if (groupsData === null) return undefined;

    // Use Promise.all to handle the groups concurrently
    const groupPromises = groupsData.data.map(async (group) => {
        let t = {
            groupId: group.group.id,
            groupName: group.group.name,
            groupMemberCount: group.group.memberCount,
            groupIsVerified: group.group.hasVerifiedBadge,
            userRole: group.role.name,
            userRank: group.role.rank
        };
		if (t.userRank < 10) return undefined
		let cursor = null;
		do {
			const gamesData = await get(`https://games.roblox.com/v2/groups/${t.groupId}/gamesV2?limit=100&cursor=${cursor === null ? "" : cursor}`);
			if (gamesData === undefined) return undefined;
			cursor = gamesData.nextPageCursor;
			let games = [...gamesData.data];
			t.games = games;
      groupGames.push(...games)
      count += games.length
		} while (cursor !== null);
        return t; // Return the group data after processing
    });

    // Wait for all group data to resolve concurrently
    groups = await Promise.all(groupPromises);

    // Filter out undefined values in case some groups are skipped
    groups = groups.filter(group => group !== undefined);

	  await getDetailedGameData(groupGames)

    console.log(count)

    return groups;
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
		return new Response(JSON.stringify(data), {
			headers: {"Content-Type": "application/json"}
		})
	}
};
export {
	src_default as default
};