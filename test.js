/*
This is a Node.js demo of taking a hard coded prompt and generating 3 images from it.
*/

import 'dotenv/config';
import fs from 'fs';
import slugify from '@sindresorhus/slugify';

import { Readable } from 'stream';
import { finished } from 'stream/promises';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

async function getAccessToken(id, secret) {

	const params = new URLSearchParams();

	params.append('grant_type', 'client_credentials');
	params.append('client_id', id);
	params.append('client_secret', secret);
	params.append('scope', 'openid,AdobeID,firefly_enterprise,firefly_api');
	
	let resp = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', 
		{ 
			method: 'POST', 
			body: params
		}
	);

	let data = await resp.json();
	return data.access_token;
}

/*
size options: 1408x1024 (Landscape 4:3), 1024x1408 (Portrait 3:4), 1024x1024 (Square 1:1), 1792x1024 (Widescreen 16:9), 1024x1792 (Vertical 9:16)
n options: 1-4
contentClass options: photo, art
styles options: see docs, lots of options
*/
async function textToImage(text, id, token, size="1024x1024", n=1, contentClass, styles=[]) {

	let [ width, height ] = size.split('x');
	let body = {
		"n":3,
		"prompt":text,
		"size":{
			"width":width,
			"height":height
		}
	}

	if(contentClass) body.contentClass = contentClass;

	let req = await fetch('https://firefly-beta.adobe.io/v2/images/generate', {
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

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

const prompt = 'a humanized unicorn wearing a leather jacket and looking tough';

console.log('Getting access token...');
let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

console.log('Now generating my images...');
let result = await textToImage(prompt, CLIENT_ID, token, '1408x1024', 3, 'art', ['Nostalgic','Antique photo']);
if(!result.outputs) {
	console.log(JSON.stringify(result,null,'\t'));
	process.exit(1);
}

for(let output of result.outputs) {
	let file = `output/${slugify(prompt)}_${output.seed}.jpg`;
	await downloadFile(output.image.presignedUrl, file);
	console.log(`Saved ${file}.`);
}

console.log('Done');