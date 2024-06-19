import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

/*
Set our creds based on environment variables.
*/
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;


async function getAccessToken(id, secret) {

	const params = new URLSearchParams();

	params.append('grant_type', 'client_credentials');
	params.append('client_id', id);
	params.append('client_secret', secret);
	params.append('scope', 'openid,AdobeID,firefly_enterprise,firefly_api,ff_apis');
	
	let resp = await fetch('https://ims-na1-stg1.adobelogin.com/ims/token/v3', 
		{ 
			method: 'POST', 
			body: params
		}
	);

	let data = await resp.json();
	return data.access_token;
}

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

async function textToImage(prompt, id, token, contentClass) {

	let body = {
		numVariations:1,
		prompt,
		size:{
			width:1792,
			height:2304
		}
	}

	if(contentClass) body.contentClass = contentClass;

	let req = await fetch('https://firefly-api-enterprise-stage.adobe.io/v3/images/generate', {
		method:'POST',
		headers: {
			'X-Api-Key':id, 
			'Authorization':`Bearer ${token}`,
			'Content-Type':'application/json'
		}, 
		body: JSON.stringify(body)
	});

	return await req.json();
}

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

let prompt = 'A long-haired cat majestically riding a flying unicorn. The cat is wielding a rainbow shield and sword, pointing the swords tip outwards.';

// First, no class
let result = await textToImage(prompt, CLIENT_ID, token);
let fileName = `./output/v3_noclass.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);

// Second, photo
result = await textToImage(prompt, CLIENT_ID, token, "photo");
fileName = `./output/v3_photo.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);

// Third, art
result = await textToImage(prompt, CLIENT_ID, token, "art");
fileName = `./output/v3_art.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);


