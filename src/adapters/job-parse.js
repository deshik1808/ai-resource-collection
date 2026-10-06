const parseJob = $('Start').first().json.job;
const outcome = readerOutcome(parseJob, aiText($input.first().json));
if (outcome.hold) return [{ json: { job: parseJob, hold: outcome.hold } }];
return outcome.resources.map((resource) => ({ json: { job: parseJob, resource } }));
