// Requires Node 21.7.0
process.loadEnvFile();

import * as http from 'http';
import fs from 'fs'; 
import { Readable } from 'stream';
import { finished } from 'stream/promises';

const FF_CLIENT_ID = process.env.FF_CLIENT_ID;
const FF_CLIENT_SECRET = process.env.FF_CLIENT_SECRET;
const PDF_SERVICES_CLIENT_ID = process.env.PDF_SERVICES_CLIENT_ID;
const PDF_SERVICES_CLIENT_SECRET = process.env.PDF_SERVICES_CLIENT_SECRET;

// Just for PDF Services
const REST_API = "https://pdf-services.adobe.io/";

// Pointer to Word doc template
const TEMPLATE = './template.docx';

// Firefly Area

async function getFFAccessToken(id, secret) {

	const params = new URLSearchParams();

	params.append('grant_type', 'client_credentials');
	params.append('client_id', id);
	params.append('client_secret', secret);
	params.append('scope', 'openid,AdobeID,firefly_enterprise,firefly_api,ff_apis');
	
	let resp = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', 
		{ 
			method: 'POST', 
			body: params
		}
	);

	let data = await resp.json();
	return data.access_token;
}

async function textToImage(text, id, token) {

	let body = {
		"n":4,
		"prompt":text,
		"size":{
			"width":"1024",
			"height":"1024"
		}
	}

	let req = await fetch('https://firefly-api.adobe.io/v2/images/generate', {
		method:'POST',
		headers: {
			'X-Api-Key':id, 
			'Authorization':`Bearer ${token}`,
			'Content-Type':'application/json'
		}, 
		body: JSON.stringify(body)
	});

	//console.log('STATUS', req.status);
	//console.log(...req.headers);

	let resp = await req.json();
	return resp;
}

// Acrobat Services Area
async function delay(x) {
	return new Promise(resolve => {
		setTimeout(() => resolve(), x);
	});
}

async function getAccessToken(id, secret) {

	const params = new URLSearchParams();
	params.append('client_id', id);
	params.append('client_secret', secret);

	let resp = await fetch('https://pdf-services-ue1.adobe.io/token', { 
		method: 'POST', 
		headers: {
			'Content-Type':'application/x-www-form-urlencoded'
		},
		body:params 
	});

	let data = await resp.json();
	return data.access_token;
}

async function getUploadData(mediaType, token, clientId) {

	let body = {
		'mediaType': mediaType
	};
	body = JSON.stringify(body);

	let req = await fetch(REST_API+'assets', {
		method:'post',
		headers: {
			'X-API-Key':clientId,
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

async function upload(filePath, mediaType) {
	let uploadData = await getUploadData(mediaType, aasToken, PDF_SERVICES_CLIENT_ID);
	await uploadFile(uploadData.uploadUri, filePath, mediaType);
	return uploadData;
}

async function apiWrapper(endpoint, body) {

	body = JSON.stringify(body);

	let req = await fetch(REST_API+endpoint, {
		method:'post',
		headers: {
			'X-API-Key':PDF_SERVICES_CLIENT_ID,
			'Authorization':`Bearer ${aasToken}`,
			'Content-Type':'application/json'
		},
		body: body
	});

	return req.headers.get('location');
}

async function createDocumentGenerationJob(asset, outputFormat, data) {

	let body = {
		'assetID': asset.assetID,
		'outputFormat': outputFormat, 
		'jsonDataForMerge':data
	};

	return await apiWrapper('operation/documentgeneration',body);

}

async function pollJob(url) {


	let status = null;
	let asset; 

	while(status !== 'done') {
		let req = await fetch(url, {
			method:'GET',
			headers: {
				'X-API-Key':PDF_SERVICES_CLIENT_ID,
				'Authorization':`Bearer ${aasToken}`,
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

async function generatePDF(data) {
	// first, upload the template
	let template = await upload(TEMPLATE, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
	console.log('uploaded the template');
	let docJob = await createDocumentGenerationJob(template, 'pdf', data);
	console.log(docJob);
	return await pollJob(docJob);
}

// Main Server Area 
async function handler(req, res) {
	console.log('Entered handler.', req.method, req.url);

	if(req.method === 'GET' && req.url.indexOf('favicon.ico') === -1) {
		res.writeHead(200, { 'Content-Type':'text/html' });
		res.write(fs.readFileSync('./index.html'));
		res.end();
	} else if(req.method === 'POST' && req.url === '/genImage') {

		let body = '';
		req.on('data', chunk => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			body = JSON.parse(body);
			console.log('BODY:\n', JSON.stringify(body, null, '\t'));

			let result = await textToImage(body.prompt, FF_CLIENT_ID, token);

			res.writeHead(200, { 'Content-Type':'application/json' });
			res.write(JSON.stringify(result.outputs));
			res.end();

		});
	} else if(req.method === 'POST' && req.url === '/genPDF') {

		let body = '';
		req.on('data', chunk => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			body = JSON.parse(body);
			console.log('BODY:\n', JSON.stringify(body, null, '\t'));

			let result = await generatePDF(body);
			const fileData = await fetch(result.downloadUri);
			const buffer = await fileData.arrayBuffer();
			const stringifiedBuffer = Buffer.from(buffer).toString('base64');

			res.writeHead(200, { 'Content-Type':'text/plain' });
			//console.log(result);
			res.write(stringifiedBuffer);
			res.end();

		});


	}

}

const token = await getFFAccessToken(FF_CLIENT_ID, FF_CLIENT_SECRET);
const aasToken = await getAccessToken(PDF_SERVICES_CLIENT_ID, PDF_SERVICES_CLIENT_SECRET);

const server = http.createServer(handler);
server.listen(3000);
console.log('Listening on port 3000!');
