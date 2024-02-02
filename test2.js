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
size valid options: Square (2048x2048), Landscape (2304x1792), Portrait (1792x2304), Widescreen (2688x1536)
contentClass options: null, photo, art
n max is 4
*/
async function textToImage(text, id, token, size="1024x1024", n=1, contentClass, styles) {

	let [ width, height ] = size.split('x');
	let body = {
		"size": { width, height }, 
		"n":n,
		"prompt":text
	}

	if(contentClass) body.contentClass = contentClass;
	// Check the docs on this one.
	if(styles) body.styles = styles;
console.log(body);

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

// Credit: https://stackoverflow.com/a/74722656/52160
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
let result = await textToImage(prompt, CLIENT_ID, token, '2304x1792', 3, 'photo', { presets: ['Black_and_white','Antique_photo'] }) ;
if(!result.outputs) {
	console.log(JSON.stringify(result,null,'\t'));
	process.exit(1);
}
console.log(result);
for(let output of result.outputs) {
	let file = `${slugify(prompt)}_${output.seed}.jpg`;
	//await saveBase64(image.base64, file);
	await downloadFile(output.image.presignedUrl, file);
	console.log(`Saved ${file}.`);
}

console.log('Done');