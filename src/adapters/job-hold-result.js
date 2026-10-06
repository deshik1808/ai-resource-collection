const held = $('Hold').first().json;
const writeFailed = Boolean($input.first().json.error);
const holdNotices = [writeFailed ? '❌ Not saved, send again' : held.notice].filter(Boolean);
return [{ json: { saved: [], skipped: [], notices: holdNotices, label: labelFor(held.kind) } }];
