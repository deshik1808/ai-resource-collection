import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const processTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Process Trigger',
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'chat_id', type: 'string' }, { name: 'text', type: 'string' }, { name: 'retry_row', type: 'number' }] } },
    output: [{ chat_id: '1', text: 'https://youtube.com/shorts/abc', retry_row: null }],
  },
});

const readSheet = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Sheet',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: __ID__('sheet_id') },
      sheetName: { __rl: true, mode: 'name', value: 'resources' },
      options: { outputFormatting: { values: { general: 'UNFORMATTED_VALUE', date: 'FORMATTED_STRING' } } },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'kJtMXJFwpGaYguB1', name: 'Google Sheets account 2' } },
    output: [{ row_number: 2, saved_at: '2026-09-12 10:00', name: 'x', status: 'ok', source_url: '' }],
  },
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/input.js', 'lib/reply.js', 'lib/sheet.js', 'adapters/process-plan.js') },
    output: [{ job: { kind: 'youtube' }, notices: [] }],
  },
});

const hasJobs = ifElse({
  version: 2.2,
  config: {
    name: 'Has Jobs?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ Boolean($json.job) }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const runJob = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run Job',
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: __ID__('job') },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: { job: expr('{{ $json.job }}') },
        matchingColumns: [],
        schema: [{ id: 'job', displayName: 'job', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'object' }],
        attemptToConvertTypes: false,
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ saved: [], skipped: [], notices: [], label: 'Short' }],
  },
});

const reply = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reply',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/reply.js', 'adapters/process-reply.js') },
    output: [{ chat_id: '1', text: 'done' }],
  },
});

const hasText = ifElse({
  version: 2.2,
  config: {
    name: 'Has Text?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.text }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const send = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chat_id }}'),
      text: expr('{{ $json.text }}'),
      additionalFields: { appendAttribution: false, disable_web_page_preview: true, parse_mode: 'HTML' },
    },
    credentials: { telegramApi: { id: 'Ft7jeQpziqX7rcN1', name: 'AI Basket' } },
    output: [{ ok: true }],
  },
});

export default workflow('ai-basket-process', 'AI Basket – Process')
  .add(processTrigger)
  .to(readSheet)
  .to(plan)
  .to(hasJobs.onTrue(runJob.to(reply)).onFalse(reply))
  .add(reply)
  .to(hasText.onTrue(send));
