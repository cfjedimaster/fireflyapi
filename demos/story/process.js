import slugify from '@sindresorhus/slugify';
import open from 'open';

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import mime from 'mime';

const MODEL_NAME = "gemini-1.5-pro";
const API_KEY = process.env.GEMINI_API;

const FF_CLIENT_ID = process.env.FF_CLIENT_ID;
const FF_CLIENT_SECRET = process.env.FF_CLIENT_SECRET;

const PDF_CLIENT_ID = process.env.PDF_CLIENT_ID;
const PDF_CLIENT_SECRET = process.env.PDF_CLIENT_SECRET;
const PDF_REST_API = "https://pdf-services.adobe.io/";

const schema = `
{
	"description":"A short story with summaries.",
	"type":"array",
	"items": {
		"type":"object",
		"properties": {
			"text": {
				"type":"string",
				"description":"A paragraph of text for the story."
			},
			"summary": {
				"type":"string",
				"description":"A one-sentence summary of the story."
			}
		},
		"required":["text","summary"]
	},
	"minItems":4,
	"maxItems":4
}
`;

async function generateStory(story) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.9,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
	responseMimeType:'application/json',
	responseSchema:JSON.parse(schema)
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  const parts = [
    {text: story},
  ];

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig,
    safetySettings,
  });

  return result.response.text();
}

async function getFFAccessToken(id, secret) {

	const params = new URLSearchParams();

	params.append('grant_type', 'client_credentials');
	params.append('client_id', id);
	params.append('client_secret', secret);
	params.append('scope', 'firefly_api,ff_apis,openid,AdobeID,session,additional_info,read_organizations');
	
	let resp = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', 
		{ 
			method: 'POST', 
			body: params
		}
	);

	return (await resp.json()).access_token;
}

async function textToImage(text, id, token) {

	let body = {
		"numVariations":1,
		"prompt":text,
		"contentClass":"art",
		"size":{
			"width":"1024",
			"height":"1024"
		}
	}

	let req = await fetch('https://firefly-api.adobe.io/v3/images/generate', {
		method:'POST',
		headers: {
			'X-Api-Key':id, 
			'Authorization':`Bearer ${token}`,
			'Content-Type':'application/json'
		}, 
		body: JSON.stringify(body)
	});

	let resp = await req.json();
	return resp;
}

async function getPDFAccessToken(id, secret) {

	return new Promise(async (resolve, reject) => {

		const params = new URLSearchParams();
		params.append('client_id', id);
		params.append('client_secret', secret);

		let resp = await fetch('https://pdf-services-ue1.adobe.io/token', 
			{ 
				method: 'POST', 
				body: params,
				headers: {
				'Content-Type':'application/x-www-form-urlencoded'
			},
		}
		);

		let data = await resp.json();
		resolve(data.access_token);

	});
}

async function getUploadData(mediaType,id,token) {

	let body = {
		'mediaType': mediaType
	};
	body = JSON.stringify(body);

	let req = await fetch(PDF_REST_API+'/assets', {
		method:'post',
		headers: {
			'X-API-Key':id,
			'Authorization':`Bearer ${token}`,
			'Content-Type':'application/json'
		},
		body: body
	});

	let data = await req.json();
	return data;
}

async function uploadFile(url, filePath, mediaType) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;

	let upload = await fetch(url, {
		method:'PUT', 
		redirect:'follow',
		headers: {
			'Content-Type':mediaType, 
			'Content-Length':fileSizeInBytes
		},
		duplex:'half',
		body:stream
	});

	if(upload.status === 200) return;
	else {
		throw('Bad result, handle later.');
	}

}

/*
I simplify the process of uploading. 
*/
async function upload(filePath, id, token) {
	let mediaType = mime.getType(filePath);
	let uploadData = await getUploadData(mediaType, id, token);
	await uploadFile(uploadData.uploadUri, filePath, mediaType);
	return uploadData;
}

async function createDocumentGenerationJob(asset, data, id, token) {

	let body = {
		'assetID': asset.assetID,
		'outputFormat': 'pdf', 
		'jsonDataForMerge':data
	};

	body = JSON.stringify(body);

	let req = await fetch(PDF_REST_API+'operation/documentgeneration', {
		method:'post',
		headers: {
			'X-API-Key':id,
			'Authorization':`Bearer ${token}`,
			'Content-Type':'application/json'
		},
		body: body
	});

	return req.headers.get('location');
}

// Lame function to add a delay to my polling calls
async function delay(x) {
	return new Promise(resolve => {
		setTimeout(() => resolve(), x);
	});
}

async function pollJob(url, id, token) {
	let status = null;
	let asset; 

	while(status !== 'done') {
		let req = await fetch(url, {
			method:'GET',
			headers: {
				'X-API-Key':id,
				'Authorization':`Bearer ${token}`,
			}
		});

		let res = await req.json();
		status = res.status;
		if(status === 'done') {
			/*
			For everything (so far) but Extract, it's res.asset
			For extract, there's .content which points to the zip, 
			.resource which points to the whole zip
			*/
			if(res.asset) asset = res.asset;
			else if(res.content && res.resource) {
				asset = { content: res.content, resource: res.resource};
			}
		} else if(status === 'failed') {
			throw(res.error);
		} else {
			await delay(2000);
		}
	}

	return asset;
}


async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

/*
I'll sit and poll the job and then dl for you when complete.
*/
async function downloadWhenDone(job, downloadPath, id, token) {

	let jobResult = await pollJob(job, id, token);
	await downloadFile(jobResult.downloadUri, downloadPath);
	return;
}

if(process.argv.length < 3) {
	console.log('Pass your story idea at the prompt: node process.js "Write a four paragraph story about a magical cat, appropriate for a young reader."');
	process.exit(1);
} 

let storyPrompt = process.argv[2];

let story = JSON.parse(await generateStory(storyPrompt));
console.log('Text and summaries of story generated.');


let ff_token = await getFFAccessToken(FF_CLIENT_ID, FF_CLIENT_SECRET);
console.log('Authenticated with Firefly');

for(let p of story) {
	console.log(`Generating a picture from ${p.summary}`);
	let result = await textToImage(p.summary, FF_CLIENT_ID, ff_token);
	let imgResult = result.outputs[0];

	p.image = `<img src="${imgResult.image.url}">`

	await delay(5 * 1000);
}

let pdf_token = await getPDFAccessToken(PDF_CLIENT_ID, PDF_CLIENT_SECRET);
console.log('Authenticated with PDF Services.');

let docTemplate = await upload('./story.docx', PDF_CLIENT_ID, pdf_token);
console.log('Word doc template uploaded.');

let job = await createDocumentGenerationJob(docTemplate, { paragraphs: story }, PDF_CLIENT_ID, pdf_token);
let output = `./output/story-${slugify(new Date().getTime().toString())}.pdf`;
await downloadWhenDone(job, output, PDF_CLIENT_ID, pdf_token);
console.log(`Done and saved to ${output}`);
await open(output);
