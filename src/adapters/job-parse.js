const parseJob = $('Start').first().json.job;
const pageUrl = parseJob.kind === 'page' ? $('Build Page Read').first().json.page_url : '';
const answer = $input.first().json.list_answer || aiText($input.first().json);
const outcome = readerOutcome(parseJob, answer, pageUrl);
if (outcome.hold) return [{ json: { job: parseJob, hold: outcome.hold } }];
return outcome.resources.map((resource) => ({ json: { job: parseJob, resource } }));
