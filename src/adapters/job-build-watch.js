const YOUTUBE_PROMPT = __TEXT__('prompts/youtube.txt');
const watchJob = $('Start').first().json.job;
const hint = watchJob.note ? `\n\nNote from the person who saved it: ${watchJob.note}` : '';
return [{ json: { job: watchJob, body: watchRequest(watchJob.source_url, YOUTUBE_PROMPT + hint) } }];
