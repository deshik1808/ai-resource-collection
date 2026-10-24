const pTrigger = $('Process Trigger').first().json;
const planNotices = $('Plan').first().json.notices || [];
const incoming = $input.all().map((item) => item.json);
const jobResults = incoming.filter((r) => Array.isArray(r.saved));
const failures = incoming.filter((r) => r.error).length;
const allNotices = failures ? [...planNotices, '❌ Not saved, send again'] : planNotices;
const replyText = combineReply(jobResults, allNotices, Boolean(pTrigger.retry_row));
return [{ json: { chat_id: String(pTrigger.chat_id), text: escapeHtml(replyText) } }];
