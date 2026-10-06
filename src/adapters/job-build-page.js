const PAGE_PROMPT = __TEXT__('prompts/page.txt');
const pageJob = $('Start').first().json.job;
const html = $input.first().json.data;
return [{ json: { job: pageJob, body: nimRequest(__ID__('nim_model'), PAGE_PROMPT, pageText(html, 8000)) } }];
