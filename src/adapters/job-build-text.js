const TEXT_PROMPT = __TEXT__('prompts/text.txt');
const textJob = $('Start').first().json.job;
return [{ json: { job: textJob, body: nimRequest(__ID__('nim_model'), TEXT_PROMPT, textJob.text) } }];
