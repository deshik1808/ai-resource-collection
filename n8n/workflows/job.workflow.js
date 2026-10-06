import { workflow, node, trigger, switchCase, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const jobTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Job Trigger',
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'job', type: 'object' }] } },
    output: [{ job: { chat_id: '1', kind: 'youtube', source_url: 'https://www.youtube.com/watch?v=a', note: '', text: '', retry_row: null, replace_row: null } }],
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
    output: [{ row_number: 2, saved_at: '2026-09-12 10:00', name: 'superpowers', category: 'Skill', status: 'ok', source_url: '', link: '', attempts: 0 }],
  },
});

const start = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Start',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('adapters/job-start.js') },
    output: [{ job: { kind: 'youtube' } }],
  },
});

const routeKind = switchCase({
  version: 3.2,
  config: {
    name: 'Route Kind',
    parameters: {
      rules: {
        values: [
          { outputKey: 'youtube', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.job.kind }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'youtube' }], combinator: 'and' } },
          { outputKey: 'page', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.job.kind }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'page' }], combinator: 'and' } },
          { outputKey: 'text', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.job.kind }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'text' }], combinator: 'and' } },
        ],
      },
    },
  },
});

const buildWatch = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Watch',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('adapters/job-build-watch.js') },
    output: [{ job: { kind: 'youtube', source_url: 'https://www.youtube.com/watch?v=a' }, prompt: 'p' }],
  },
});

const watch = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Watch',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'video',
      operation: 'analyze',
      modelId: { __rl: true, mode: 'id', value: __ID__('gemini_model') },
      text: expr('{{ $json.prompt }}'),
      inputType: 'url',
      videoUrls: expr('{{ $json.job.source_url }}'),
      simplify: true,
      options: { maxOutputTokens: 8192 },
    },
    credentials: { googlePalmApi: { id: 'GzWPqEIKL3sEzEJR', name: 'Google Gemini(PaLM) Api account' } },
    output: [{ content: { parts: [{ text: '{"resources":[]}' }] } }],
  },
});

const fetchPage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch Page',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.job.source_url }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (compatible; AIBasket/1.0)' }] },
      options: { response: { response: { responseFormat: 'text' } }, timeout: 10000 },
    },
    output: [{ data: '<html><body>page</body></html>' }],
  },
});

const buildPageRead = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Page Read',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/input.js', 'lib/resources.js', 'adapters/job-build-page.js') },
    output: [{ job: { kind: 'page' }, body: { model: 'm', messages: [] } }],
  },
});

const buildTextRead = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Text Read',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/job-build-text.js') },
    output: [{ job: { kind: 'text' }, body: { model: 'm', messages: [] } }],
  },
});

const readWithNim = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Read With NIM',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: { timeout: 60000 },
    },
    credentials: { httpHeaderAuth: newCredential('NVIDIA NIM') },
    output: [{ choices: [{ message: { content: '{"resources":[]}' } }] }],
  },
});

const parse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/job-parse.js') },
    output: [{ job: { kind: 'youtube' }, hold: null, resource: { name: 'A', category: 'Skill', description: '', link_in_source: '', prompt_text: '' } }],
  },
});

const isHold = ifElse({
  version: 2.2,
  config: {
    name: 'Is Hold?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ Boolean($json.hold) }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const hold = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Hold',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/input.js', 'lib/reply.js', 'lib/sheet.js', 'lib/resources.js', 'adapters/job-hold.js') },
    output: [{ op: 'append', row: { status: 'check' }, notice: 'n', kind: 'youtube' }],
  },
});

const holdOp = switchCase({
  version: 3.2,
  config: {
    name: 'Hold Op',
    parameters: {
      rules: {
        values: [
          { outputKey: 'append', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.op }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'append' }], combinator: 'and' } },
          { outputKey: 'update', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.op }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'update' }], combinator: 'and' } },
          { outputKey: 'none', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.op }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'none' }], combinator: 'and' } },
        ],
      },
    },
  },
});

const appendHold = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Append Hold',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'sheet',
      operation: 'append',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: __ID__('sheet_id') },
      sheetName: { __rl: true, mode: 'name', value: 'resources' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          saved_at: expr('{{ $json.row.saved_at }}'),
          name: expr('{{ $json.row.name }}'),
          category: expr('{{ $json.row.category }}'),
          description: expr('{{ $json.row.description }}'),
          link: expr('{{ $json.row.link }}'),
          link_from: expr('{{ $json.row.link_from }}'),
          prompt_text: expr('{{ $json.row.prompt_text }}'),
          source_url: expr('{{ $json.row.source_url }}'),
          note: expr('{{ $json.row.note }}'),
          status: expr('{{ $json.row.status }}'),
          attempts: expr('{{ $json.row.attempts }}'),
        },
        schema: [
          { id: 'saved_at', displayName: 'saved_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'category', displayName: 'category', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'description', displayName: 'description', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'link', displayName: 'link', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'link_from', displayName: 'link_from', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'prompt_text', displayName: 'prompt_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'source_url', displayName: 'source_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'attempts', displayName: 'attempts', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
      options: { cellFormat: 'RAW' },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'kJtMXJFwpGaYguB1', name: 'Google Sheets account 2' } },
    output: [{ saved_at: '2026-10-06 14:32' }],
  },
});

const updateHold = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Hold',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'sheet',
      operation: 'update',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: __ID__('sheet_id') },
      sheetName: { __rl: true, mode: 'name', value: 'resources' },
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['row_number'],
        value: {
          row_number: expr('{{ $json.update.row_number }}'),
          status: expr('{{ $json.update.status }}'),
          attempts: expr('{{ $json.update.attempts }}'),
        },
        schema: [
          { id: 'row_number', displayName: 'row_number', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true, readOnly: true, removed: false },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'attempts', displayName: 'attempts', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
      options: { cellFormat: 'RAW' },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'kJtMXJFwpGaYguB1', name: 'Google Sheets account 2' } },
    output: [{ row_number: 4, status: 'pending', attempts: 2 }],
  },
});

const holdResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Hold Result',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/reply.js', 'adapters/job-hold-result.js') },
    output: [{ saved: [], skipped: [], notices: ['⏸ Saved for later, will retry'], label: 'Short' }],
  },
});

export default workflow('ai-basket-job', 'AI Basket – Job')
  .add(jobTrigger)
  .to(readSheet)
  .to(start)
  .to(routeKind
    .onCase(0, buildWatch.to(watch.to(parse)))
    .onCase(1, fetchPage.to(buildPageRead.to(readWithNim)))
    .onCase(2, buildTextRead.to(readWithNim)))
  .add(readWithNim)
  .to(parse)
  .add(parse)
  .to(isHold.onTrue(hold.to(holdOp
    .onCase(0, appendHold.to(holdResult))
    .onCase(1, updateHold.to(holdResult))
    .onCase(2, holdResult))))
  .add(watch.onError(hold))
  .add(fetchPage.onError(hold))
  .add(readWithNim.onError(hold))
  .add(appendHold.onError(holdResult))
  .add(updateHold.onError(holdResult));
