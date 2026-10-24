import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const runSetup = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Setup', output: [{}] },
});

const createSpreadsheet = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Create Spreadsheet',
    parameters: {
      resource: 'spreadsheet',
      operation: 'create',
      authentication: 'oAuth2',
      title: 'AI Basket',
      sheetsUi: { sheetValues: [{ title: 'resources' }] },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'kJtMXJFwpGaYguB1', name: 'Google Sheets account 2' } },
    output: [{ spreadsheetId: 'abc', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc', sheets: [{ properties: { sheetId: 123, title: 'resources' } }] }],
  },
});

const writeHeader = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Write Header',
    parameters: {
      method: 'PUT',
      url: expr('https://sheets.googleapis.com/v4/spreadsheets/{{ $json.spreadsheetId }}/values/resources%21A1%3AL1?valueInputOption=RAW'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '{"values":[["saved_at","name","category","description","link","link_from","prompt_text","source_url","note","status","attempts","stars"]]}',
    },
    credentials: { googleSheetsOAuth2Api: { id: 'kJtMXJFwpGaYguB1', name: 'Google Sheets account 2' } },
    output: [{ updatedRange: 'resources!A1:L1', updatedCells: 12 }],
  },
});

const freezeAndFilter = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Freeze And Filter',
    parameters: {
      method: 'POST',
      url: expr('https://sheets.googleapis.com/v4/spreadsheets/{{ $("Create Spreadsheet").item.json.spreadsheetId }}:batchUpdate'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{"requests":[{"updateSheetProperties":{"properties":{"sheetId":{{ $("Create Spreadsheet").item.json.sheets[0].properties.sheetId }},"gridProperties":{"frozenRowCount":1}},"fields":"gridProperties.frozenRowCount"}},{"setBasicFilter":{"filter":{"range":{"sheetId":{{ $("Create Spreadsheet").item.json.sheets[0].properties.sheetId }},"startRowIndex":0,"startColumnIndex":0,"endColumnIndex":12}}}}]}'),
    },
    credentials: { googleSheetsOAuth2Api: { id: 'kJtMXJFwpGaYguB1', name: 'Google Sheets account 2' } },
    output: [{ spreadsheetId: 'abc', replies: [{}, {}] }],
  },
});

export default workflow('ai-basket-setup', 'AI Basket – Setup')
  .add(runSetup)
  .to(createSpreadsheet)
  .to(writeHeader)
  .to(freezeAndFilter);
