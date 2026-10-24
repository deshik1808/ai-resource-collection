const candidates = $('Build Pick').first().json.results;
const index = pickIndex(aiText($input.first().json).trim(), candidates.length);
return [{ json: index === null ? { picked: false } : { picked: true, url: candidates[index].url, link_from: 'search' } }];
