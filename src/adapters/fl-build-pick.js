const PICK_PROMPT = __TEXT__('prompts/pick-link.txt');
const pickResource = $('Start').first().json.resource;
const searchResults = ($input.first().json.results || []).slice(0, 5);
if (searchResults.length === 0) return [{ json: { hasResults: false } }];
return [{ json: { hasResults: true, results: searchResults, body: pickRequest(__ID__('nim_model'), PICK_PROMPT, pickResource, searchResults) } }];
