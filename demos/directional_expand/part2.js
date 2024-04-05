/*
In this second test, we want to directionally expand in one direction only, to the right.
*/
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { statSync } from 'fs';

import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const FF_CLIENT_ID = process.env.CLIENT_ID;
const FF_CLIENT_SECRET = process.env.CLIENT_SECRET;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const bucket = 'psapitestrkc';

const s3Client = new S3Client({ region: 'us-east-1', credentials: {
		accessKeyId: AWS_ACCESS_KEY_ID, 
		secretAccessKey: AWS_SECRET_ACCESS_KEY
	} 
});

async function getSignedDownloadUrl(path) {
	let command = new GetObjectCommand({ Bucket: bucket, Key:path });
	return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function getSignedUploadUrl(path) {
	let command = new PutObjectCommand({ Bucket: bucket, Key:path });
	return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function upload(url, path) {

	let stream = createReadStream(path);
	let stats = statSync(path);
	let fileSizeInBytes = stats.size;

	// todo: make dynamic
	let fileType = 'image/jpeg';

	return await fetch(url, {
		method:'PUT', 
		headers: {
			'Content-Type':fileType, 
			'Content-Length':fileSizeInBytes
		}, 
		duplex:'half', 
		body:stream
	});

}

async function getAccessToken(id, secret) {

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

async function executeActionJSON(inputURL, outputURL, actionJSON, token, id) {

	let data = {
		"inputs":[{
			"storage":"external",
			"href":inputURL
		}],
		"options":{
			actionJSON
		},
		"outputs":[ {
			"storage":"external",
			"type":"image/jpeg",
			"href":outputURL
		}]
	};


	let resp = await fetch('https://image.adobe.io/pie/psdService/actionJSON', {
		method: 'POST', 
		headers: {
			'Authorization':`Bearer ${token}`,
			'x-api-key': id
		}, 
		body: JSON.stringify(data)
	});

	return await resp.json();

}


async function getJob(url, token, id) {

	let access_token = await token;

	let jobReq = await fetch(url, {
		headers: {
			'Authorization':`Bearer ${token}`,
			'x-api-key': id
		}
	});

	return await jobReq.json();

}

async function pollJob(url, token, id) {
	let doneStatuses = ['running', 'pending'];

	let status = 'running';
	while(doneStatuses.indexOf(status) !== -1) {
		let currentStatus = await getJob(url, token, id);
		let thisStatus;
		if(currentStatus.status) thisStatus = currentStatus.status;
		if(currentStatus.outputs && currentStatus.outputs[0].status) thisStatus = currentStatus.outputs[0].status;
		/*
		So today I discovered that there are 4 different poll job APIs covered in the greater
		bucket of PS APIs. I'm beginning my work to try to get this to work for all, but may 
		kill off this idea completely.
		*/
		if(doneStatuses.indexOf(thisStatus) !== -1) {
			// todo: make this configurable perhaps?
			await delay(1000);
		} else return currentStatus;
	}
}

async function delay(x) {
	return new Promise(resolve => {
		setTimeout(() => resolve(), x);
	});
}

async function uploadImage(filePath, id, token) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;
	// todo: make dynamic
	let fileType = 'image/jpeg';

	let upload = await fetch('https://firefly-beta.adobe.io/v2/storage/image', {
		method:'POST', 
		headers: {
			'Authorization':`Bearer ${token}`, 
			'X-API-Key':id, 
			'Content-Type':fileType, 
			'Content-Length':fileSizeInBytes
		}, 
		duplex:'half', 
		body:stream
	});

	let result = await upload.json();
	if(result.images && result.images.length > 0) return result.images[0];
	else {
		console.log(JSON.stringify(result, null, '\t'));
		throw('Error');
	}
}

async function genFillImage(prompt, source, token, id) {

	let body = {
		prompt, 
		"size":	{ "width": 1792, "height": 1024 },
		"image": {
			"id":source
		}
	}

}

// First, Authenticate
let token = await getAccessToken(FF_CLIENT_ID, FF_CLIENT_SECRET);

// Next, upload source to s3
let uploadPath = await getSignedUploadUrl('walk1.jpg');
await upload(uploadPath, './walk1.jpg');
console.log('Uploaded asset to S3');

// create a link to read the asset
let inputPath = await getSignedDownloadUrl('walk1.jpg');
console.log('Readable URL made for asset');

// Create a link for the result
let outputPath = await getSignedUploadUrl('walk1_out.jpg');
console.log('Writable URL made for result');

// read in our action.json
let actionJSON = JSON.parse(await fs.readFile('./Action.json','utf8'));

// now fire off the call to run it
let job = await executeActionJSON(inputPath, outputPath, actionJSON, token, FF_CLIENT_ID);
console.log('Created ActionJSON job');

let result = await pollJob(job._links.self.href, token, FF_CLIENT_ID);
if(!result.outputs || !result.outputs[0].status === 'succeeded') {
	console.log('ERROR');
	console.log('-'.repeat(80));
	console.log(JSON.stringify(result,null,'\t'));
	process.exit(1);
}

console.log('ActionJSON job done');