const chooseResource = $('Start').first().json.resource;
const skillMatch = $('Match Skill').first().json.skillMatch || null;
const searchBody = $('GitHub Search').first().json.body || {};
const packBody = $input.first().json.body;
const chosen = chooseLink(skillMatch, packBody && packBody.full_name ? packBody : null, searchBody.items || [], chooseResource.name);
return [{ json: chosen ? { matched: true, ...chosen } : { matched: false } }];
