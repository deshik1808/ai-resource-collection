const pInput = $('Process Trigger').first().json;
const sheet = $('Read Sheet').all().map((item) => item.json).filter((r) => r.row_number);
const retryRow = pInput.retry_row ? Number(pInput.retry_row) : null;
const planned = planJobs({ chat_id: String(pInput.chat_id), text: String(pInput.text || ''), retry_row: retryRow }, sheet);
if (planned.jobs.length === 0) return [{ json: { job: null, notices: planned.notices } }];
return planned.jobs.map((job) => ({ json: { job, notices: planned.notices } }));
