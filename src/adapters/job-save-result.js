const planned = $('Save Rows').all().map((item) => item.json);
const appendFailed = Boolean($input.first().json.error);
const savedList = appendFailed ? [] : planned.filter((p) => p.row).map((p) => p.row);
return [{ json: { saved: savedList, skipped: appendFailed ? [] : planned[0].skipped, notices: appendFailed ? ['❌ Not saved, send again'] : [], label: planned[0].label } }];
