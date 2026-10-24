const checked = $('Check Input').first().json;
const alive = linkAlive($input.first().json);
if (!alive) return [{ json: { link: '', link_from: 'not found', stars: null, about: '', repo: '' } }];
return [{ json: { link: checked.url, link_from: checked.link_from, stars: checked.stars, about: checked.about, repo: checked.stars == null ? repoOf(checked.url) : '' } }];
