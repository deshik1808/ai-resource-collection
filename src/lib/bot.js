// Decides what to do with one Telegram update.

const { messageText } = require('./input');

/**
 * @param {object} update Telegram update
 * @param {string} allowedChatId '' until setup is done
 * @returns {{action: 'ignore'|'start'|'find'|'save'|'unsupported', chat_id: string, text: string, query: string, show_chat_id: boolean}}
 */
function route(update, allowedChatId) {
  const message = update && update.message;
  const chatId = message && message.chat ? String(message.chat.id) : '';
  const text = message ? messageText(message) : null;
  const result = (action, query = '') => ({ action, chat_id: chatId, text: text || '', query, show_chat_id: false });
  if (!message) return result('ignore');

  const command = (text || '').match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  if (!allowedChatId) {
    return command && command[1] === 'start' ? { ...result('start'), show_chat_id: true } : result('ignore');
  }
  if (chatId !== String(allowedChatId)) return result('ignore');
  if (command && command[1] === 'start') return result('start');
  if (command && command[1] === 'find') return result('find', command[2].trim());
  if (!text) return result('unsupported');
  return result('save');
}

module.exports = { route };
