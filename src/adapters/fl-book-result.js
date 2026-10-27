const bookResource = $('Start').first().json.resource;
const book = bookLink(($input.first().json.body || {}).docs, bookResource.name);
return [{ json: book ? { url: book.url, link_from: 'openlibrary', stars: null, about: book.about } : { url: '', link_from: 'not found' } }];
