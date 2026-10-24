const findQuery = $('Route').first().json.query;
const findSheet = $input.all().map((item) => item.json).filter((r) => r.row_number);
const answer = findQuery ? formatFind(findQuery, findRows(findSheet, findQuery)) : 'Type a word after /find, for example: /find pdf';
return [{ json: { chat_id: $('Route').first().json.chat_id, text: escapeHtml(answer) } }];
