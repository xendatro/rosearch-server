var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
async function post(endpoint, body) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return data.data;
  } catch (e) {
    return null;
  }
}
__name(post, "post");
async function get(endpoint) {
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    return data;
  } catch (e) {
    return null;
  }
}
__name(get, "get");
async function getIdFromUsername(username) {
  return await post(`https://users.roblox.com/v1/usernames/users`, {
    usernames: [username],
    excludeBannedUsers: true
  });
}
__name(getIdFromUsername, "getIdFromUsername");
async function getFollowersCount(id) {
  return await get(`https://friends.roblox.com/v1/users/${id}/followers/count`);
}
__name(getFollowersCount, "getFollowersCount");
async function getFollowingCount(id) {
  return await get(`https://friends.roblox.com/v1/users/${id}/followings/count`);
}

async function getThumbnail(id) {
  return await get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=720x720&format=Png&isCircular=false`)
}
__name(getFollowingCount, "getFollowingCount");
async function getDetailedGameData(games) {
  let gameIds = games.map((game) => game.id);
  const n = 50;
  let i = 0;
  while (i < games.length) {
    console.log(i, i + n);
    const detailsPromise = get(`https://games.roblox.com/v1/games?universeIds=${gameIds.slice(i, i + n).toString()}`);
    const thumbnailsPromise = get(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${gameIds.slice(i, i + n).toString()}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`);
    const [details, thumbnails] = await Promise.all([detailsPromise, thumbnailsPromise]);
    console.log(details)
    await Promise.all(details.data.map((gameDetails, x) => {
      const thumbDetails = thumbnails.data[x];
      const game = games[i + x];
      game.universeId = gameDetails.id;
      game.rootPlaceId = gameDetails.rootPlaceId;
      game.playing = gameDetails.playing;
      game.favoritedCount = gameDetails.favoritedCount;
      game.visits = gameDetails.visits;
      game.genre = gameDetails.genre;
      game.thumbnails = thumbDetails.thumbnails;
      return game;
    }));
    i += n;
  }
}
__name(getDetailedGameData, "getDetailedGameData");
async function getUserGames(id) {
  let cursor = null;
  let games = [];
  do {
    const gamesData = await get(`https://games.roblox.com/v2/users/${id}/games?limit=50&cursor=${cursor === null ? "" : cursor}`);
    if (gamesData === void 0)
      return void 0;
    cursor = gamesData.nextPageCursor;
    games.push(...gamesData.data);
  } while (cursor !== null);
  await getDetailedGameData(games);
  return games;
}
__name(getUserGames, "getUserGames");
async function getGroups(id) {
  let cursor = null;
  let groups = [];
  let groupGames = [];
  let count = 0;
  const groupsData = await get(`https://groups.roblox.com/v2/users/${id}/groups/roles?includeLocked=true`);
  if (groupsData === null)
    return void 0;
  const groupPromises = groupsData.data.map(async (group) => {
    const rolesData = await get(`https://groups.roblox.com/v1/groups/${group.group.id}/roles`)
    const rankMemberCount = rolesData.roles.filter((role) => role.rank === group.role.rank)[0].memberCount
    let t = {
      groupId: group.group.id,
      groupName: group.group.name,
      groupMemberCount: group.group.memberCount,
      groupIsVerified: group.group.hasVerifiedBadge,
      userRole: group.role.name,
      userRank: group.role.rank,
      rankMemberCount: rankMemberCount
    };
    if (t.userRank < 10)
      return void 0;
    let cursor2 = null;
    do {
      const gamesData = await get(`https://games.roblox.com/v2/groups/${t.groupId}/gamesV2?limit=100&cursor=${cursor2 === null ? "" : cursor2}`);
      if (gamesData === void 0)
        return void 0;
      cursor2 = gamesData.nextPageCursor;
      console.log(gamesData)
      let games = [...gamesData.data];
      t.games = games;
      groupGames.push(...games);
      count += games.length;
    } while (cursor2 !== null);
    return t;
  });
  groups = await Promise.all(groupPromises);
  groups = groups.filter((group) => group !== void 0);
  const gameChunks = chunkArray(groupGames, 50);
  await Promise.all(gameChunks.map((chunk) => getDetailedGameData(chunk)));
  console.log(count);
  return groups;
}
__name(getGroups, "getGroups");
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
__name(chunkArray, "chunkArray");
async function buildData(username) {
  let t = {};
  let idData = await getIdFromUsername(username);
  if (!idData)
    return void 0;
  idData = idData[0];
  t.id = idData.id;
  t.username = idData.name;
  t.displayName = idData.displayName;
  t.isVerified = idData.hasVerifiedBadge;
  const [followersData, followingsData, userGamesData, groupsData, avatarThumbnail] = await Promise.all([
    getFollowersCount(t.id),
    getFollowingCount(t.id),
    getUserGames(t.id),
    getGroups(t.id),
    getThumbnail(t.id)
  ]);
  if (!followersData || !followingsData || !userGamesData || !groupsData || !avatarThumbnail)
    return void 0;
  t.followers = followersData.count;
  t.followings = followingsData.count;
  t.userGames = userGamesData;
  t.groupsData = groupsData;
  t.avatarThumbnail = avatarThumbnail.data[0].imageUrl
  return t;
}
__name(buildData, "buildData");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const data = await buildData(url.searchParams.get("username"));
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://rosearch.dev"
       }
    });
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
