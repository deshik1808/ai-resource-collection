const TEXT_PROMPT = __TEXT__('prompts/text.txt');
const textJob = $('Start').first().json.job;
const list = parseList(textJob.text);
if (list) return [{ json: { job: textJob, list_answer: JSON.stringify({ resources: list }) } }];
return [{ json: { job: textJob, body: nimRequest(__ID__('nim_model'), TEXT_PROMPT, textJob.text) } }];
