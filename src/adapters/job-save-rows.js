const saveJob = $('Start').first().json.job;
const found = $('Parse').all().map((item) => item.json.resource);
const links = $input.all().map((item) => (item.json.link_from !== undefined ? item.json : { link: '', link_from: 'not found' }));
const savedRows = $('Read Sheet').all().map((item) => item.json).filter((r) => r.row_number);
const plan = saveRows(found, links, savedRows, saveJob, new Date());
const label = labelFor(saveJob.kind);
if (plan.rows.length === 0) return [{ json: { row: null, skipped: plan.skipped, label } }];
return plan.rows.map((row) => ({ json: { row, skipped: plan.skipped, label } }));
