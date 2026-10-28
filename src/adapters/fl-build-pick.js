const PICK_PROMPT = __TEXT__('prompts/pick-link.txt');
const pickResource = $('Start').first().json.resource;
const repoBody = ['Tool Repos', 'GitHub Search'].map((n) => { try { return $(n).first().json.body; } catch (e) { return null; } }).find(Boolean) || {};
const webResults = ($input.first().json.results || []).slice(0, 5);
const direct = directLink(webResults, repoBody.items, pickResource.name);
if (direct) return [{ json: { direct: true, url: direct, link_from: 'search' } }];
const searchResults = pickCandidates(webResults, repoBody.items, pickResource.name);
if (searchResults.length === 0) return [{ json: { direct: false, hasResults: false } }];
return [{ json: { direct: false, hasResults: true, results: searchResults, body: pickRequest(__ID__('nim_model'), PICK_PROMPT, pickResource, searchResults) } }];
