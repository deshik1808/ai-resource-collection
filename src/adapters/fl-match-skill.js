const skillResource = $('Start').first().json.resource;
const found = matchSkill($input.first().json.skills || [], skillResource.name);
return [{ json: found ? { matched: true, url: found.url, link_from: 'skills.sh' } : { matched: false } }];
