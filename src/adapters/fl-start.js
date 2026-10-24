const flInput = $('Find Link Trigger').first().json;
const flResource = flInput.resource;
const flJob = flInput.job;
let route = 'search';
if (flResource.link_in_source) route = 'check';
else if (flResource.category === 'Prompt') route = 'prompt';
else if (flResource.category === 'Skill') route = 'skill';
const linkFrom = flJob.kind === 'page' ? 'shared' : 'source';
return [{ json: { resource: flResource, job: flJob, route, url: flResource.link_in_source, link_from: linkFrom } }];
