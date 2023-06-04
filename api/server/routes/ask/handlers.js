const _ = require('lodash');
const citationRegex = /\[\^\d+?\^]/g;
const backtick = /(?<!`)[`](?!`)/g;
// const singleBacktick = /(?<!`)[`](?!`)/;
const cursorDefault = '<span className="result-streaming">█</span>';
const { getCitations, citeText } = require('../../../app');

const handleError = (res, message) => {
  res.write(`event: error\ndata: ${JSON.stringify(message)}\n\n`);
  res.end();
};

const sendMessage = (res, message) => {
  console.log("[handlers.js] sendMessage: ", message);
  if (message.length === 0) {
    return;
  }
  res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
};

const createOnProgress = ({ onProgress: _onProgress }) => {
  let i = 0;
  let code = '';
  let tokens = '';
  let precode = '';
  let blockCount = 0;
  let codeBlock = false;
  let cursor = cursorDefault;

  const progressCallback = async (partial, { res, text, bing = false, ...rest }) => {
    let chunk = partial === text ? '' : partial;
    tokens += chunk;
    precode += chunk;
    tokens = tokens.replaceAll('[DONE]', '');

    console.log("[handlers.js] chunk: ", chunk);
    console.log("[handlers.js] tokens: ", tokens);
    console.log("[handlers.js] precode: ", precode);

    if (tokens.includes("[TO KNOWLEDGE]")) {
      console.log("[handlers.js] Going to hide the [TO KNOWLEDGE]..");
      tokens = `<div class="flex items-center text-xs rounded p-3 text-gray-900 bg-gray-100"><div><div class="flex items-center gap-2"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><div>Searching on Verra...</div></div></div><div class="ml-12 flex items-center gap-2" role="button"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="18 15 12 9 6 15"></polyline></svg></div></div>`;
    }

    if (codeBlock) {
      code += chunk;
    }

    if (precode.includes('```') && codeBlock) {
      console.log("Not in a code block, using HTML cursor");
      codeBlock = false;
      cursor = cursorDefault;
      precode = precode.replace(/```/g, '');
      code = '';
    }

    if (precode.includes('```') && code === '') {
      console.log("In a code block, using traditional cursor");
      precode = precode.replace(/```/g, '');
      codeBlock = true;
      blockCount++;
      cursor = blockCount > 1 ? '█\n\n```' : '█\n\n';
    }

    const backticks = precode.match(backtick);
    if (backticks && !codeBlock && cursor === cursorDefault) {
      precode = precode.replace(backtick, '');
      cursor = '█';
    }

    if (tokens.match(/^\n/)) {
      tokens = tokens.replace(/^\n/, '');
    }

    if (bing) {
      tokens = citeText(tokens, true);
    }

    sendMessage(res, { text: tokens + cursor, message: true, initial: i === 0, ...rest });

    _onProgress && _onProgress({ text: tokens, message: true, initial: i === 0, ...rest });

    i++;
  };

  const onProgress = (opts) => {
    return _.partialRight(progressCallback, opts);
  };

  const getPartialText = () => {
    return tokens;
  };

  return { onProgress, getPartialText };
};

const handleText = async (response, bing = false) => {
  let { text } = response;
  // text = await detectCode(text);
  response.text = text;

  if (bing) {
    // const hasCitations = response.response.match(citationRegex)?.length > 0;
    const links = getCitations(response);
    if (response.text.match(citationRegex)?.length > 0) {
      text = citeText(response);
    }
    text += links?.length > 0 ? `\n<small>${links}</small>` : '';
  }

  return text;
};

module.exports = { handleError, sendMessage, createOnProgress, handleText };
