import { workflow, node, trigger, switchCase, ifElse, expr } from '@n8n/workflow-sdk';

const findLinkTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Find Link Trigger',
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'resource', type: 'object' }, { name: 'job', type: 'object' }] } },
    output: [{ resource: { name: 'NotebookLM', category: 'Tool', description: '', link_in_source: '', prompt_text: '' }, job: { kind: 'youtube' } }],
  },
});

const start = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Start',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/fl-start.js') },
    output: [{ resource: { name: 'NotebookLM', category: 'Tool' }, job: { kind: 'youtube' }, route: 'search', query: 'NotebookLM', url: '', link_from: 'source' }],
  },
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'Route',
    parameters: {
      rules: {
        values: [
          { outputKey: 'check', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'check' }], combinator: 'and' } },
          { outputKey: 'prompt', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'prompt' }], combinator: 'and' } },
          { outputKey: 'skill', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'skill' }], combinator: 'and' } },
          { outputKey: 'search', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'search' }], combinator: 'and' } },
        ],
      },
    },
  },
});

const promptResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prompt Result',
    parameters: { mode: 'runOnceForAllItems', jsCode: "return [{ json: { link: '', link_from: '' } }];" },
    output: [{ link: '', link_from: '' }],
  },
});

const skillsSearch = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Skills Search',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('https://skills.sh/api/search?q={{ encodeURIComponent($json.query) }}'),
      options: { timeout: 10000 },
    },
    output: [{ skills: [] }],
  },
});

const matchSkillNode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Match Skill',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/fl-match-skill.js') },
    output: [{ skillMatch: null, repo: '' }],
  },
});

const GITHUB_HEADERS = { parameters: [{ name: 'User-Agent', value: 'AIBasket/1.0' }, { name: 'Accept', value: 'application/vnd.github+json' }] };

const githubSearch = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'GitHub Search',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('https://api.github.com/search/repositories?q={{ encodeURIComponent($("Start").first().json.query + " in:name") }}&sort=stars&order=desc&per_page=10'),
      sendHeaders: true,
      headerParameters: GITHUB_HEADERS,
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 },
    },
    output: [{ statusCode: 200, headers: {}, body: { items: [] } }],
  },
});

const hasPack = ifElse({
  version: 2.2,
  config: {
    name: 'Has Pack?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ Boolean($("Match Skill").first().json.repo) }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const packRepo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Pack Repo',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('https://api.github.com/repos/{{ $("Match Skill").first().json.repo }}'),
      sendHeaders: true,
      headerParameters: GITHUB_HEADERS,
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 },
    },
    output: [{ statusCode: 200, headers: {}, body: { full_name: 'obra/superpowers', stargazers_count: 1 } }],
  },
});

const chooseLinkNode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Choose Link',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/fl-choose-link.js') },
    output: [{ matched: true, url: 'https://github.com/obra/superpowers', link_from: 'github', stars: 1 }],
  },
});

const isMatched = ifElse({
  version: 2.2,
  config: {
    name: 'Matched?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.matched }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const tavily = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Tavily',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.tavily.com/search',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ query: ($("Start").first().json.resource.name + " " + $("Start").first().json.resource.description).trim(), max_results: 5 }) }}'),
      options: { timeout: 20000 },
    },
    credentials: { httpHeaderAuth: { id: 'RbUHO9ZG2BzQEu9e', name: 'Header Auth account Tavily' } },
    output: [{ results: [{ title: 't', url: 'https://example.com', content: 'c' }] }],
  },
});

const buildPick = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Pick',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/fl-build-pick.js') },
    output: [{ hasResults: true, results: [{ title: 't', url: 'https://example.com', content: 'c' }], body: { model: 'm', messages: [] } }],
  },
});

const hasResults = ifElse({
  version: 2.2,
  config: {
    name: 'Has Results?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.hasResults }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const pick = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Pick',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: { timeout: 120000 },
    },
    credentials: { httpHeaderAuth: { id: 'jD6IWxW6RPTF5yem', name: 'Header Auth account NVIDIA NIM' } },
    output: [{ choices: [{ message: { content: '0' } }] }],
  },
});

const pickIndexNode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick Index',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/fl-pick-index.js') },
    output: [{ picked: true, url: 'https://example.com', link_from: 'search' }],
  },
});

const isPicked = ifElse({
  version: 2.2,
  config: {
    name: 'Picked?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.picked }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const notFound = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Not Found Result',
    parameters: { mode: 'runOnceForAllItems', jsCode: "return [{ json: { link: '', link_from: 'not found' } }];" },
    output: [{ link: '', link_from: 'not found' }],
  },
});

const checkInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Input',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('adapters/fl-check-input.js') },
    output: [{ url: 'https://example.com', link_from: 'search', stars: null }],
  },
});

const checkLink = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Check Link',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'HEAD',
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (compatible; AIBasket/1.0)' }] },
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 },
    },
    output: [{ statusCode: 200, headers: {} }],
  },
});

const linkResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Link Result',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/fl-link-result.js') },
    output: [{ link: 'https://example.com', link_from: 'search', stars: null, repo: '' }],
  },
});

const needsStars = ifElse({
  version: 2.2,
  config: {
    name: 'Needs Stars?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ Boolean($json.repo) }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const repoStarsNode = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Repo Stars',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('https://api.github.com/repos/{{ $json.repo }}'),
      sendHeaders: true,
      headerParameters: GITHUB_HEADERS,
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 },
    },
    output: [{ statusCode: 200, headers: {}, body: { stargazers_count: 1 } }],
  },
});

const finalResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Final Result',
    parameters: { mode: 'runOnceForAllItems', jsCode: __INCLUDE__('lib/resources.js', 'adapters/fl-final-result.js') },
    output: [{ link: 'https://example.com', link_from: 'search', stars: null }],
  },
});

export default workflow('ai-basket-find-link', 'AI Basket – Find Link')
  .add(findLinkTrigger)
  .to(start)
  .to(route
    .onCase(0, checkInput)
    .onCase(1, promptResult)
    .onCase(2, skillsSearch.to(matchSkillNode.to(githubSearch.to(hasPack.onTrue(packRepo.to(chooseLinkNode)).onFalse(chooseLinkNode))))))
    .onCase(3, tavily))
  .add(chooseLinkNode)
  .to(isMatched.onTrue(checkInput).onFalse(tavily))
  .add(tavily)
  .to(buildPick.to(hasResults
    .onTrue(pick.to(pickIndexNode.to(isPicked.onTrue(checkInput).onFalse(notFound))))
    .onFalse(notFound)))
  .add(checkInput)
  .to(checkLink.to(linkResult.to(needsStars.onTrue(repoStarsNode.to(finalResult)).onFalse(finalResult))));
