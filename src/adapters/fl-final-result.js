const result = $('Link Result').first().json;
const repoBody = result.repo ? $input.first().json.body : null;
const stars = result.stars ?? repoStars(repoBody);
return [{ json: { link: result.link, link_from: result.link_from, stars, about: result.about || repoAbout(repoBody) } }];
