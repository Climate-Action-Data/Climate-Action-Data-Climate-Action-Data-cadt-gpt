const util = require('util');
const { exec } = require('child_process');
const { Configuration, OpenAIApi } = require("openai");
const _ = require('lodash');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment-timezone');
const puppeteer = require('puppeteer');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');

const { AI_PROMPT, Client, HUMAN_PROMPT } = require("@anthropic-ai/sdk");

let ANTHROPIC_KEY = `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`;

const anthropic_client = new Client(ANTHROPIC_KEY);

const configuration = new Configuration({
  apiKey: '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'
});
const openai = new OpenAIApi(configuration);

const fsStream = require('fs');

const fs = require('fs').promises;

function removeNullOrFalseOrEmptyValues(obj) {
  return _.transform(obj, (result, value, key) => {
    if (value !== null && value !== false && value !== '') {
      if (_.isObject(value) || _.isArray(value)) {
        value = removeNullOrFalseOrEmptyValues(value);
        if (!_.isEmpty(value)) {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
  });
}

function getLatestProjectDescriptionURL(verraResponse) {
  let latestDate = null;
  let url = null;

  let data = verraResponse.documentGroups;

  for (let group of data) {
    for (let document of group.documents) {
      if (document.documentType === "Project Description") {
        const uploadDate = new Date(document.uploadDate);
        if (latestDate === null || uploadDate > latestDate) {
          latestDate = uploadDate;
          url = document.uri;
        }
      }
    }
  }

  return url;
}


const ProgressBar = require('progress');


async function downloadFile(project_id, url) {
  try {
    console.log("Going to download file", url, project_id)


    const { data, headers } = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        'Cookie': 'ASPSESSIONIDQEQADTSB=DPEBCBGCPMMFDKALLKEOAGEM; ASPSESSIONIDQETBAQQD=FOKOAEDDNJHMBOMGBCHFAKIF',
        'Referer': `https://registry.verra.org/app/projectDetail/VCS/${project_id}`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': 1,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
      },
    });

    const totalLength = headers['content-length'];

    const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
      width: 40,
      complete: '=',
      incomplete: ' ',
      renderThrottle: 1,
      total: parseInt(totalLength),
    });

    data.on('data', (chunk) => progressBar.tick(chunk.length));



    let outputPath = path.join(process.cwd(), `/data/pdds/${project_id}.pdf`);

    const writer = fsStream.createWriteStream(outputPath);
    data.pipe(writer);

    return new Promise((resolve, reject) => {
      data.pipe(writer).on('finish', () => resolve(outputPath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error during file download: ${error}`);
    throw error
  }
}




const execAwait = util.promisify(require('child_process').exec);

async function extractTextFromPDF(file) {
  try {
    const fileNameWithoutExtension = file.replace('.pdf', '');
    const command = `pdftotext ${file} ${fileNameWithoutExtension}.txt`;

    await execAwait(command);

    const textBuffer = await fs.readFile(`${fileNameWithoutExtension}.txt`);
    const text = textBuffer.toString();


    console.log('PDF text extraction complete!');
    return text;
  } catch (error) {
    console.error('Error during PDF text extraction:', error);
    throw error;
  }
}


// This function prepares the text for summarization and calls the Anthropic API
async function summarizeTextWithAnthropicStreaming(textContent, searchTerm, question, textUpdate) {
  const prompt = `${HUMAN_PROMPT} You will be provided a list of URLs & their text content. Analyze all the text content, related to ${searchTerm} & ${question}

${textContent}

Based on ALL the [TEXT CONTENT] & [URL]. Answer the results as detailed as possible with the use of a LOT of emojis, while citing URLs, in point form.

Search Term: ${searchTerm} 
Question: ${question}
Answer (Output Top 10 & Cite URLs!): \n ${AI_PROMPT}`;


  console.log(prompt)

  let previousCompletion = "";
  const anthropic_response = await anthropic_client.completeStream({
    prompt: prompt,
    stop_sequences: [HUMAN_PROMPT],
    max_tokens_to_sample: 10000,
    temperature: 0.1,
    model: "claude-v1",
  }, {
    onOpen: (response) => {
      console.log("[cadTrustKnowledge.js] Anthropic Opened stream, HTTP status code", response.status);
    },
    onUpdate: (completion) => {
      const newCompletion = completion.completion;
      const appendedString = newCompletion.slice(previousCompletion.length);
      console.log("[cadTrustKnowledge.js] onComplete", completion);
      console.log("[cadTrustKnowledge.js] Appended string", appendedString);
      previousCompletion = newCompletion;
      textUpdate(appendedString);
    },
  }
  );
  console.log(anthropic_response)
  //return "The weather today is good"
  return anthropic_response['completion'];
}


// This function performs a Google search and returns the text of the Quick Search box or the top three search results
async function searchGoogleAndGetText(searchTerm, screenshotCallback) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 }); // 1080p resolution


  console.log("Launch browser ok");
  let url = `https://www.google.com/search?q=${encodeURI(searchTerm)}`
  await page.goto(url, { waitUntil: 'networkidle2' });

  const screenshotGoogle = await page.screenshot();
  const fileNameGoogle = `screenshot_${uuidv4().slice(0, 6)}_google.png`;
  await fs.writeFile(fileNameGoogle, screenshotGoogle);
  screenshotCallback(fileNameGoogle, url);

  const quickAnswerExists = await page.evaluate(() => {
    const searchElement = document.querySelector('.v7W49e');
    console.log(searchElement)
    const searchChildren = Array.from(searchElement.children);
    console.log(searchChildren);
    let quickAnswerIndex = -1;

    // check if each direct child has the ULSxyf class
    for (let i = 0; i < searchChildren.length; i++) {
      console.log(searchChildren[i].className)
      console.log("###")
      if (searchChildren[i].className === 'ULSxyf') {
        quickAnswerIndex = i;
        break;
      }
      console.log(searchChildren[i]);
      console.log(quickAnswerIndex)
    }

    // check if there is an element with text 'About featured snippets' 
    // or a div/span with class 'hELpae'
    const aboutSnippets = Array.from(document.querySelectorAll('div, span')).some(el =>
      el.innerText === 'About featured snippets' || el.className === 'hELpae'
    );

    if (aboutSnippets) {
      console.log('About featured snippets or hELpae class found');
      return false;
    }

    if (quickAnswerIndex >= 0 && quickAnswerIndex < 3) {
      console.log("Found quick search result")
      return searchChildren[quickAnswerIndex].innerText;
    }

    return false;
  });


  if (quickAnswerExists) {
    await browser.close();
    return { urls: [`Google Quick Answer: ${url}`], texts: [quickAnswerExists.slice(0, 30000)] };
  }

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.g .yuRUbf a')).slice(0, 5).map(a => {
      let url = new URL(a.href);
      url.hash = "";
      return url.toString();
    });
  });

  console.log(links)

  const pagesText = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const newPage = await browser.newPage();
    await newPage.setViewport({ width: 1920, height: 1080 }); // 1080p resolution
    await newPage.goto(link, { waitUntil: 'networkidle2' });

    const text = await newPage.evaluate(() => {
      return document.body.innerText;
    });
    pagesText.push(text.slice(0, 30000));  // Limit the text to the first 30,000 characters

    const screenshot = await newPage.screenshot();
    const fileName = `screenshot_${uuidv4().slice(0, 6)}_${i + 1}.png`;
    await fs.writeFile(fileName, screenshot);
    screenshotCallback(fileName, link);
  }

  await browser.close();

  return { urls: links, texts: pagesText };
}


const google_processing_responses = [
  "Just a moment, we're about to process the Google Search Results the Anthropic Claude LLM. 😊 (This may take 1-2 minutes as the Search Results are long)",
  "Hold tight! We're in the process of handling Google Search Results with the Anthropic Claude LLM. 👍 (This may take 1-2 minutes as the Search Results are long)",
  "Please wait! We're currently processing the Google Search Results with the Anthropic Claude LLM. 😁 (This may take 1-2 minutes as the Search Results are long)",
  "Sit tight! We're currently investigating the Google Search Results with the Anthropic Claude LLM. 🕵️‍♂️ (This may take 1-2 minutes as the Search Results are long)",
  "Please grab a coffee first! We're working on processing the Google Search Results with the Anthropic Claude LLM. 🧐 (This may take 1-2 minutes as the Search Results are long)",
  "This may take a while. We're currently working on the Google Search with the Anthropic Claude LLM. 🏃‍♂️💨 (This may take 1-2 minutes as the Search Results are long)",
];

function getRandomGoogleWaitResponse() {
  console.log("Got random Google response")
  const randomIndex = Math.floor(Math.random() * google_processing_responses.length);
  return google_processing_responses[randomIndex];
}




async function generateSqlQuery(question, remarks, messageCallback) {
  console.log("Going to talk to chatgpt");

  const sqlPromptFile = path.join(process.cwd(), '/data/cad-trust-sql-prompt-verra.txt');
  
  messageCallback("\n\nExecuting SQL:\n");
  messageCallback("```sql\n")
  
  const VERRA_SQL_SEARCH_PROMPT = HUMAN_PROMPT + "\n" + await fs.readFile(sqlPromptFile, 'utf8') + `Query: ${question}\n Remarks: ${remarks}\nSQL:\n${AI_PROMPT}`;

  console.log(VERRA_SQL_SEARCH_PROMPT);

  let previousCompletion = "";

  const anthropic_response = await anthropic_client.completeStream({
    prompt: VERRA_SQL_SEARCH_PROMPT,
    stop_sequences: [HUMAN_PROMPT],
    max_tokens_to_sample: 2048,
    temperature: 0.1,
    model: "claude-v1",
  }, {
    onOpen: (response) => {
      console.log("[cadTrustKnowledge.js] Anthropic Opened stream, HTTP status code", response.status);
    },
    onUpdate: (completion) => {
      const newCompletion = completion.completion;
      const appendedString = newCompletion.slice(previousCompletion.length);
      console.log("[cadTrustKnowledge.js] onComplete", completion);
      console.log("[cadTrustKnowledge.js] Appended string", appendedString);
      previousCompletion = newCompletion;
      messageCallback(appendedString);
    },
  }
  );
  

  messageCallback("\n```");
  messageCallback("\n\n\n");
  messageCallback("---------\n");

  return anthropic_response['completion'];

  /*const response = await openai.createChatCompletion({
    model: "gpt-4",
    messages: messages,
    temperature: 0.1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  });
  console.log(response);

  return response.data.choices[0]['message']['content'];*/
}

// Dummy function to simulate executing the SQL query
// This can be replaced with an actual SQL execution function for your specific database

const mysql = require('mysql');

let pool = mysql.createPool({
  host: 'localhost',
  user: 'cadt',
  password: 'password',
  database: 'cadt',
});


function convertToTSV(result) {
  // The header row is the list of object keys
  const header = Object.keys(result[0]).join('\t') + '\n';

  // Then we map over the rows and join the values with tabs
  const rows = result.map(row => {
    return Object.values(row).join('\t');
  }).join('\n');

  // Return the header and rows together
  return header + rows;
}

async function executeSqlQuery(query) {
  return new Promise((resolve, reject) => {
    pool.getConnection(function (err, connection) {
      if (err) {
        reject(err);
        return;
      }
      connection.query(query, function (error, results, fields) {
        connection.release();
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  });
}




async function searchForVerraProject(question, insightsRequest, messageCallback, fileCallback) {
  
  let query = (await generateSqlQuery(question, insightsRequest, messageCallback)).replace("SQL: ", "");
  let success = false;
  let sqlResults = null;

  while (!success) {
    try {
      sqlResults = await executeSqlQuery(query);
      console.log("Generated SQL query executed successfully:", query);
      success = true;
    } catch (err) {
      console.error("Error generating or executing SQL query:", err.message);
      initialMessages.push({
        "role": "assistant",
        "content": query
      });
      initialMessages.push({
        "role": "user",
        "content": `There was an error executing the query: ${err.message}. Output the fixed SQL ONLY:`
      });
      messageCallback(`There was an error with the previous query. New query *${query}*`)
      query = await generateSqlQuery(initialMessages);
    }
  }

  console.log(sqlResults);

  let fileName = path.join(process.cwd(), `../client/dist/assets/excel/CADT_Search_Results_${uuidv4()}.xlsx`);

  console.log("[cadTrustKnowledge.js] Going to generate excel file:", fileName);

  let workbook = new ExcelJS.Workbook();
  let worksheet = workbook.addWorksheet("My Sheet");

  // Write column names
  worksheet.columns = [
    { header: 'ID', key: 'ID', width: 10 },
    { header: 'Name', key: 'Name', width: 32 },
    { header: 'Proponent', key: 'Proponent', width: 32 },
    { header: 'Project_Type', key: 'Project_Type', width: 32 },
    { header: 'AFOLU_Activities', key: 'AFOLU_Activities', width: 32 },
    { header: 'Methodology', key: 'Methodology', width: 10 },
    { header: 'Status', key: 'Status', width: 20 },
    { header: 'Country_Area', key: 'Country_Area', width: 20 },
    { header: 'Estimated_Annual_Emission_Reductions', key: 'Estimated_Annual_Emission_Reductions', width: 20 },
    { header: 'Region', key: 'Region', width: 10 },
    { header: 'Crediting_Period_Start_Date', key: 'Crediting_Period_Start_Date', width: 20 },
    { header: 'Crediting_Period_End_Date', key: 'Crediting_Period_End_Date', width: 20 },
  ];


  // Add Data and Borders
  sqlResults.forEach((item, index) => {
    console.log(item);
    worksheet.addRow({
      ...item,
      Crediting_Period_Start_Date: new Date(item.Crediting_Period_Start_Date),
      Crediting_Period_End_Date: new Date(item.Crediting_Period_End_Date)
    });
  });

  console.log("Worksheet");
  console.log(worksheet);
  await workbook.xlsx.writeFile(fileName);

  console.log("Write workbook ok!")
  fileCallback(fileName);

  const sqlAnalysisPromptFile = path.join(process.cwd(), '/data/cad-trust-sql-analysis-prompt.txt');

  const VERRA_SQL_ANALYSIS_PROMPT = await fs.readFile(sqlAnalysisPromptFile, 'utf8');

  let sqlResultsTSV;
  try {
    sqlResultsTSV = convertToTSV(sqlResults);
  }
  catch (err) {
    console.log("Error while converting to TSV");
    console.log(err)
    sqlResultsTSV = "[WARNING: NO SQL RESULTS]";
  }

  let CLAUDE_PROMPT = `${HUMAN_PROMPT} 

  ${VERRA_SQL_ANALYSIS_PROMPT} 

  Question: ${question}
  SQL Query Executed: ${query}
  Insights Requested: ${insightsRequest}
  [START OF SQL RESULTS: TSV]
  ${sqlResultsTSV}
  [END OF SQL RESULTS: TSV]

  ---
  Template to follow:

  <<Instructions to follow will be in brackets>>

  --------------


  🔧📜💡 Carbon Market Search Results 💡📜🔧

    🔍 Search Results: {totalCount} (Limit Top 3)

    \`\`\`
    Project #1 <<Generate the same for remaining 10 projects>>
    🌿 Program: {program}
    🔢 Project ID: {ID}
    📜 Name: {Name}
    🏭 Proponent: {Proponent}
    🔧 Project Type: {Project Type}
    🌿 AFLOU Activities: {AFLOU Activities}
    🔧 Methodology: {Methodology}
    🏢 Status: {Status}
    🌍 Country: {Country}
    💨 Annual Emission Reductions: {Estimated Annual Emission Reductions}
    🌏 Region: {region}
    📅 Crediting Period Start Date: 
    📅 Crediting Period End Date:
    
    \`\`\`

    \`\`\`
    Project #2 <<Generate the same for remaining 10 projects>>
   
    🌿 Program: {program}
    🔢 Project ID: {ID}
    📜 Name: {Name}
    🏭 Proponent: {Proponent}
    🔧 Project Type: {Project Type}
    🌿 AFLOU Activities: {AFLOU Activities}
    🔧 Methodology: {Methodology}
    🏢 Status: {Status}
    🌍 Country: {Country}
    💨 Annual Emission Reductions: {Estimated Annual Emission Reductions}
    🌏 Region: {region}
    📅 Crediting Period Start Date: 
    📅 Crediting Period End Date:

    \`\`\`

    <<Generate the same for remaining projects>>

------------------------------

    🔧📜💡 Detailed Insights 💡📜🔧

     - User's request: ${insightsRequest}

     - Detailed Insights
        <<Include a lot of emojis to make it readable>>
        <<Insights at least 5 paragraphs>>
        ...
  ---
  Search Results and Insights (Remember to list ALL TOP 3 projects):\n ${AI_PROMPT}`

  console.log("Talking to Claude", CLAUDE_PROMPT);

  let previousCompletion = "";

  const anthropic_response = await anthropic_client.completeStream({
    prompt: CLAUDE_PROMPT,
    stop_sequences: [HUMAN_PROMPT],
    max_tokens_to_sample: 2048,
    temperature: 0.1,
    model: "claude-v1",
  }, {
    onOpen: (response) => {
      console.log("[cadTrustKnowledge.js] Anthropic Opened stream, HTTP status code", response.status);
    },
    onUpdate: (completion) => {
      const newCompletion = completion.completion;
      const appendedString = newCompletion.slice(previousCompletion.length);
      console.log("[cadTrustKnowledge.js] onComplete", completion);
      console.log("[cadTrustKnowledge.js] Appended string", appendedString);
      previousCompletion = newCompletion;
      messageCallback(appendedString);
    },
  }
  );

  /*let anthropic_response = await anthropic_client
    .complete({
      prompt: CLAUDE_PROMPT,
      stop_sequences: [HUMAN_PROMPT],
      max_tokens_to_sample: 1024,
      model: "claude-v1",
    });*/

  console.log(anthropic_response)
  return anthropic_response['completion']
}


const axios = require('axios');

class CADTrustKnowledge {


  static async searchGoogle(searchTerm, question, whatsappImageCallbackWithCaption, textCallback) {
    console.log("Got this knowledge request " + searchTerm + " " + question);

    const screenshotHandler = (fileName, url) => {
      console.log(`[EleccaKnowledge] Going to pass the screenshot back to WhatsApp ${fileName}`);
      whatsappImageCallbackWithCaption(fileName, "Searching: " + url + ".. please wait..");
    };


    const searchResults = await searchGoogleAndGetText(searchTerm, screenshotHandler);

    let contentForSummarization = '';
    for (let i = 0; i < searchResults.urls.length; i++) {
      contentForSummarization += `\n[${i} URL: ${searchResults.urls[i]}]\n[START OF CONTENT]\n${searchResults.texts[i]}\n [END OF CONTENT]------ `;
    }

    let timeoutId = setTimeout(() => {
      textCallback(getRandomGoogleWaitResponse());
    }, 6000);

    try {
      const summary = await summarizeTextWithAnthropicStreaming(contentForSummarization, searchTerm, question, textCallback);
      clearTimeout(timeoutId); // clear the timer if summarizeText completes in less than 30 seconds
      console.log(summary);
      return summary;
    } catch (error) {
      console.error('Error while summarizing text: ', error);
    }



  }

  static async getCarbonProjectPDD(registry, project_id) {

    const headers = {
      'Accept': 'application/json',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
      'Cookie': 'ASPSESSIONIDQEQADTSB=DPEBCBGCPMMFDKALLKEOAGEM',
      'Referer': `https://registry.verra.org/app/projectDetail/VCS/${project_id}`,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
    };

    console.log("Going to fetch the PDD from Verra for project", project_id)
    let verraResponse = await axios.get(`https://registry.verra.org/uiapi/resource/resourceSummary/${project_id}`, { headers });


    console.log(verraResponse)

    let pddUrl = getLatestProjectDescriptionURL(verraResponse.data)

    let filePath = await downloadFile(project_id, pddUrl);

    return filePath




    /*const fileName = 'data/cadt-extract-url.txt'
    const data = await fs.readFile(fileName, 'utf8');
    let gptMessageHistory = [
      { "role": "system", "content": data },
      { "role": "user", "content": JSON.stringify(verraResponse.data) }
    ]
    console.log(gptMessageHistory)
    console.log("Going to talk to chatgpt")
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: gptMessageHistory,
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })
    console.log(response)
    return response.data.choices[0]['message']['content'];*/

  }

  static async askQuestionAboutPDD(pdd_file_path, question, textUpdate) {

    let text = await extractTextFromPDF(pdd_file_path);


    console.log("------------------");
    console.log("First 1000 characters: ", text.substring(0, 1000));
    console.log("Last 1000 characters: ", text.substring(text.length - 1000));
    console.log("------------------");

    let words = text.split(' ')
    let text_length = words.length;

    if (text_length > 50000) {
      console.log("Warning: The text length is too long, going to truncate")
      text = words.slice(0, 50000).join(' ');
    }


    console.log("Going to talk to Anthropic")

    let prompt = `${HUMAN_PROMPT} You a carbon credits/AFLOU/REDD+ expert & provided Project Design Document (PDD). Analyze it to answer "${text}"? [START OF PDD]\n${text} \n [END OF PDD] 
    Based on the PDD, citing relevant section numbers, answer: "${question}"
    Answer: \n ${AI_PROMPT}`

    await fs.writeFile("anthropic-prompt-latest.txt", prompt);


    console.log(prompt.substring(0, 10000));


    const anthropic_response = await anthropic_client.completeStream({
      prompt: prompt,
      stop_sequences: [HUMAN_PROMPT],
      max_tokens_to_sample: 2048,
      temperature: 0.1,
      model: "claude-v1",
    }, {
      onOpen: (response) => {
        console.log("[cadTrustKnowledge.js] Anthropic Opened stream, HTTP status code", response.status);
      },
      onUpdate: (completion) => {
        const newCompletion = completion.completion;
        const appendedString = newCompletion.slice(previousCompletion.length);
        console.log("[cadTrustKnowledge.js] onComplete", completion);
        console.log("[cadTrustKnowledge.js] Appended string", appendedString);
        previousCompletion = newCompletion;
        textUpdate(appendedString);
      },
    }
    );

    console.log(anthropic_response)

    return anthropic_response['completion'];

  }


  static async searchForCarbonProject(registry, query, insights, textCallback, fileCallback) {
    console.log("Going to search for carbon project", query);
    console.log("[cadTrustKnowledge.js]",__dirname);

    return await searchForVerraProject(query, insights, textCallback, fileCallback);

    return;

    const fileName = 'data/verra_all_projects.tsv';
    const text = await fs.readFile(fileName, 'utf8');

    console.log("------------------");
    console.log("First 1000 characters: ", text.substring(0, 1000));
    console.log("Last 1000 characters: ", text.substring(text.length - 1000));
    console.log("------------------");

    let words = text.split(' ')
    let text_length = words.length;

    if (text_length > 70000) {
      console.log("Warning: The text length is too long, going to truncate")
      text = words.slice(0, 70000).join(' ');
    }



    let currentDate = new Date().toJSON().slice(0, 10);

    let prompt = `${HUMAN_PROMPT} [Date Now ${currentDate}]. You a carbon credits/AFLOU/REDD+ expert and an SQL expert good with dates. Analyze TSV of projects with SQL Query "${name}" projects. Be very detailed and meticulous, search through all rows. \n[START OF TSV]\n${text} \n [END OF TSV] 
    Query: "${name}"
    [Date Now ${currentDate}]
    [If user asks "Registration Date"/"Start Date", try to compare with "Crediting Period Start Date". Be very careful, meticulous and mathematical with dates]
    [If there are no results, try your best to find best top 10 similar results to the query]
    

    Template: "

    Answer: \n ${AI_PROMPT}`

    await fs.writeFile("anthropic-prompt-latest-verra.txt", prompt);


    console.log(prompt.substring(0, 10000));


    let anthropic_response = await anthropic_client
      .complete({
        prompt: prompt,
        stop_sequences: [HUMAN_PROMPT],
        max_tokens_to_sample: 1024,
        temperature: 0,
        model: "claude-v1",
      });

    return anthropic_response['completion'];

  }

  /*static async searchForCarbonProject(registry, name) {
 
 
    const headers = {
      'Accept': 'application/json',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
      'Content-Type': 'application/json',
      'Cookie': 'ASPSESSIONIDQEQADTSB=DPEBCBGCPMMFDKALLKEOAGEM',
      'Origin': 'https://registry.verra.org',
      'Referer': 'https://registry.verra.org/app/search/VCS/All%20Projects',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"'
    }
 
    const jsonData = {
      "program": "VCS",
      "resourceName": name,
      "resourceStatuses": [
        "VCS_EX_CRD_PRD_VER_REQUESTED",
        "VCS_EX_CRD_PRD_REQUESTED",
        "VCS_EX_INACTIVE",
        "VCS_EX_ONHOLD",
        "VCS_EX_REGISTERED",
        "VCS_EX_REG_VER_APPR_REQUESTED",
        "VCS_EX_REGISTRATION_REQUESTED",
        "VCS_EX_REJ",
        "VCS_EX_UNDER_DEVELOPMENT_CLD",
        "VCS_EX_UNDER_DEVELOPMENT_OPN",
        "VCS_EX_UNDER_VALIDATION_CLD",
        "VCS_EX_UNDER_VALIDATION_OPN",
        "VCS_EX_CRED_TRANS_FRM_OTHER_PROG",
        "VCS_EX_WITHDRAWN"
      ]
    }
 
    let verraResponse = await axios.post('https://registry.verra.org/uiapi/resource/resource/search?maxResults=10&$count=true&$skip=0&$top=50', jsonData, {
      headers: headers
    })
 
    console.log(verraResponse)
    const fileName = 'data/cadt-search-results.txt'
    const data = await fs.readFile(fileName, 'utf8');
    let gptMessageHistory = [
      { "role": "system", "content": data },
      { "role": "user", "content": JSON.stringify(verraResponse.data) }
    ]
    console.log(gptMessageHistory)
    console.log("Going to talk to chatgpt")
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: gptMessageHistory,
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })
    console.log(response)
    return response.data.choices[0]['message']['content'];
 
  }*/

}

module.exports = CADTrustKnowledge;

