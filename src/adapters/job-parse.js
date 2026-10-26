const parseJob = $('Start').first().json.job;
const pageUrl = parseJob.kind === 'page' ? $('Build Page Read').first().json.page_url : '';
const outcome = readerOutcome(parseJob, aiText($input.first().json), pageUrl);
if (outcome.hold) return [{ json: { job: parseJob, hold: outcome.hold } }];
return outcome.resources.map((resource) => ({ json: { job: parseJob, resource } }));
