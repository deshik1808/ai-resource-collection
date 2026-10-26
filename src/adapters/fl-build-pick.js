const PICK_PROMPT = __TEXT__('prompts/pick-link.txt');
const pickResource = $('Start').first().json.resource;
const repoBody = ['Tool Repos', 'GitHub Search'].map((n) => { try { return $(n).first().json.body; } catch (e) { return null; } }).find(Boolean) || {};
const searchResults = pickCandidates($input.first().json.results, repoBody.items, pickResource.name);
if (searchResults.length === 0) return [{ json: { hasResults: false } }];
return [{ json: { hasResults: true, results: searchResults, body: pickRequest(__ID__('nim_model'), PICK_PROMPT, pickResource, searchResults) } }];
