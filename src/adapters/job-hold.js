const holdJob = $('Start').first().json.job;
const incoming = $input.first().json;
const sheetRows = $('Read Sheet').all().map((item) => item.json).filter((r) => r.row_number);
const reason = incoming.hold
  ? { ...incoming.hold }
  : { temporary: isTemporaryError(incoming.error), empty: false };
if (holdJob.kind === 'page') reason.name = domainOf(holdJob.source_url);
return [{ json: { ...holdPlan(holdJob, reason, sheetRows, new Date()), kind: holdJob.kind } }];
