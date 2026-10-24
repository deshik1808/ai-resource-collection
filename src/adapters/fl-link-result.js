const checked = $('Check Input').first().json;
const alive = linkAlive($input.first().json);
return [{ json: alive ? { link: checked.url, link_from: checked.link_from } : { link: '', link_from: 'not found' } }];
