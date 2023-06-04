require('dotenv').config();
const { KeyvFile } = require('keyv-file');
const { genAzureEndpoint } = require('../../utils/genAzureEndpoints');
const tiktoken = require('@dqbd/tiktoken');
const tiktokenModels = require('../../utils/tiktokenModels');
const encoding_for_model = tiktoken.encoding_for_model;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CADTrustKnowledge = require('./cadTrustKnowledge');
const fs = require('fs');

const LOGO_SVG_SEARCH = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
const LOGO_SVG_UP = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
const LOGO_SVG_SPINNER = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="animate-spin text-center ml-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg><div class="ml-12 flex items-center gap-2" role="button"></svg>`;


const askClient = async ({
  text,
  parentMessageId,
  conversationId,
  model,
  oaiApiKey,
  chatGptLabel,
  promptPrefix,
  temperature,
  top_p,
  presence_penalty,
  frequency_penalty,
  onProgress,
  abortController,
  userId
}) => {
  const { ChatGPTClient } = await import('@waylaidwanderer/chatgpt-api');
  const store = {
    store: new KeyvFile({ filename: './data/cache.json' })
  };

  console.log("[chatgpt-client] askClient", text, model);

  const azure = process.env.AZURE_OPENAI_API_KEY ? true : false;
  let promptText = 'You are ChatGPT, a large language model trained by OpenAI.';
  if (promptPrefix) {
    promptText = promptPrefix;
  }
  const maxContextTokens = model === 'gpt-4' ? 8191 : model === 'gpt-4-32k' ? 32767 : 4095; // 1 less than maximum
  const clientOptions = {
    reverseProxyUrl: process.env.OPENAI_REVERSE_PROXY || null,
    azure,
    maxContextTokens,
    modelOptions: {
      model,
      temperature,
      top_p,
      presence_penalty,
      frequency_penalty
    },
    chatGptLabel,
    promptPrefix,
    proxy: process.env.PROXY || null,
    debug: true
  };

  let apiKey = oaiApiKey ? oaiApiKey : process.env.OPENAI_KEY || null;

  if (azure) {
    apiKey = oaiApiKey ? oaiApiKey : process.env.AZURE_OPENAI_API_KEY || null;
    clientOptions.reverseProxyUrl = genAzureEndpoint({
      azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
      azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION
    });
  }

  const client = new ChatGPTClient(apiKey, clientOptions, store);

  const options = {
    onProgress,
    abortController,
    ...(parentMessageId && conversationId ? { parentMessageId, conversationId } : {})
  };

  let usage = {};
  let enc = null;
  try {
    enc = encoding_for_model(tiktokenModels.has(model) ? model : 'gpt-3.5-turbo');
    usage.prompt_tokens = (enc.encode(promptText)).length + (enc.encode(text)).length;
  } catch (e) {
    console.log('Error encoding prompt text', e);
  }
  
  const res = await client.sendMessage(text, { ...options, userId });

  try {
    usage.completion_tokens = (enc.encode(res.response)).length;
    enc.free();
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    res.usage = usage;
  } catch (e) {
    console.log('Error encoding response text', e);
  }
  
  console.log("[chatgpt-client] askClient: onProgress", onProgress)
  console.log("[chatgpt-client] askClient: res", res)

  const updateResText = (textToAppend) => {
    console.log(`[chatgpt-client] UpdateResText - Old Text: ${res.response}`);
    console.log(`[chatgpt-client] UpdateResText - Text to Append: ${textToAppend}`);
    res.response = res.response + textToAppend;
    console.log(`[chatgpt-client] UpdateResText - New Text: ${res.response}`);
    onProgress(textToAppend);
  }

  /*if (res.response.includes("[TO KNOWLEDGE]")) {
    console.log("[chatgpt-client] Going to hide the [TO KNOWLEDGE]..");
    res.response = `
    <div class="flex items-center text-xs bg-green-100 rounded p-3 text-gray-900">
      <div>
        <div class="flex items-center gap-2">
          ${LOGO_SVG_SEARCH}
          <div>Generating SQL..</div>
        </div>
      </div>
    ${LOGO_SVG_SPINNER}
    </div>`;
  }*/


  let FROM_KNOWLEDGE;

  const pattern = /Knowledge\.searchForCarbonProjects\("([^"]*)", "([^"]*)", "([^"]*)"\)/gm;

  let match = pattern.exec(res.response);

  if (match) {
    try {
      const command = match[0];
      const registry = match[1];
      const query = match[2];
      const insights = match[3];
  
      console.log("Got a match for the carbon project");
      console.log(registry, query, insights);
  
  
      if (registry.toLocaleLowerCase() !== "verra") {
        updateResText("\nNote: I am only able to process data from the Verra Registry at the moment. Other registries are coming soon!");
      }

      const fileCallback = (file) => {
        console.log(`[chatgpt-client] Got file callback: ${file}`);
      }
  
      FROM_KNOWLEDGE = await CADTrustKnowledge.searchForCarbonProject(registry, query, insights, updateResText, fileCallback);

      console.log("[chatgpt-client] FROM_KNOWLEDGE", FROM_KNOWLEDGE);
      //updateResText(FROM_KNOWLEDGE);

    } catch (err) {
      console.log(err.trace);
      console.log(err);
      console.log("Something happened while handling search");
      res.response = `<div class="flex items-center text-xs bg-red-100 rounded p-3 text-gray-900"><div><div class="flex items-center gap-2"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path></svg><div>Clicked on a link</div></div></div><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="animate-spin text-center ml-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg><div class="ml-12 flex items-center gap-2" role="button"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="18 15 12 9 6 15"></polyline></svg></div></div>`;
      res.response += "\n\n" + "Sorry, an internal error occurred while processing your request. Please try again later.";
    }
  }
  return res;
};

module.exports = { askClient };
