const result = $('Link Result').first().json;
const stars = result.stars ?? (result.repo ? repoStars($input.first().json.body) : null);
return [{ json: { link: result.link, link_from: result.link_from, stars } }];
