const skillResource = $('Start').first().json.resource;
const found = matchSkill($input.first().json.skills || [], skillResource.name);
return [{ json: { skillMatch: found, repo: found ? repoOf(found.url) : '' } }];
