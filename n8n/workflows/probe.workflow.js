import { workflow, node, trigger } from '@n8n/workflow-sdk';

const runProbe = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Probe', output: [{}] },
});

const skillsSearchA = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Skills Search A',
    onError: 'continueRegularOutput',
    parameters: { method: 'GET', url: 'https://skills.sh/api/search?q=superpowers', options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } },
    output: [{ statusCode: 200, headers: {}, body: {} }],
  },
});

const skillsSearchB = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Skills Search B',
    onError: 'continueRegularOutput',
    parameters: { method: 'GET', url: 'https://skills.sh/api/skills?search=superpowers', options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } },
    output: [{ statusCode: 200, headers: {}, body: {} }],
  },
});

const linkCheckOk = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Link Check Ok',
    onError: 'continueRegularOutput',
    parameters: { method: 'HEAD', url: 'https://github.com/obra/superpowers', options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } },
    output: [{ statusCode: 200, headers: {}, body: {} }],
  },
});

const linkCheckMissing = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Link Check Missing',
    onError: 'continueRegularOutput',
    parameters: { method: 'HEAD', url: 'https://github.com/obra/no-such-repo-ai-basket-probe', options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } },
    output: [{ statusCode: 200, headers: {}, body: {} }],
  },
});

const geminiLatest = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Gemini Flash Latest',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'video',
      operation: 'analyze',
      modelId: { __rl: true, mode: 'id', value: 'models/gemini-flash-latest' },
      text: __TEXT__('prompts/youtube.txt'),
      inputType: 'url',
      videoUrls: 'https://www.youtube.com/watch?v=0JZtdAtJiyk',
      simplify: true,
      options: { maxOutputTokens: 8192 },
    },
    credentials: { googlePalmApi: { id: 'GzWPqEIKL3sEzEJR', name: 'Google Gemini(PaLM) Api account' } },
    output: [{ content: { parts: [{ text: '{"resources":[]}' }] } }],
  },
});

const geminiTwoFive = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Gemini 2.5 Flash',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'video',
      operation: 'analyze',
      modelId: { __rl: true, mode: 'id', value: 'models/gemini-2.5-flash' },
      text: __TEXT__('prompts/youtube.txt'),
      inputType: 'url',
      videoUrls: 'https://www.youtube.com/watch?v=0JZtdAtJiyk',
      simplify: true,
      options: { maxOutputTokens: 8192 },
    },
    credentials: { googlePalmApi: { id: 'GzWPqEIKL3sEzEJR', name: 'Google Gemini(PaLM) Api account' } },
    output: [{ content: { parts: [{ text: '{"resources":[]}' }] } }],
  },
});

export default workflow('ai-basket-probe', 'AI Basket – Probe')
  .add(runProbe).to(skillsSearchA)
  .add(runProbe).to(skillsSearchB)
  .add(runProbe).to(linkCheckOk)
  .add(runProbe).to(linkCheckMissing)
  .add(runProbe).to(geminiLatest)
  .add(runProbe).to(geminiTwoFive);
