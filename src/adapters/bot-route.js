const ALLOWED_CHAT_ID = __ID__('chat_id');
return [{ json: route($input.first().json, ALLOWED_CHAT_ID) }];
