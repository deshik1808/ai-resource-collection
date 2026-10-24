const toCheck = $input.first().json;
return [{ json: { url: toCheck.url, link_from: toCheck.link_from, stars: toCheck.stars ?? null, about: toCheck.about || '' } }];
