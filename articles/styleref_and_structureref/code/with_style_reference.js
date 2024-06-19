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

async function uploadImage(filePath, fileType, id, token) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;

	let upload = await fetch('https://firefly-api-enterprise-stage.adobe.io/v2/storage/image', {
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

	return await upload.json();
}

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

async function textToImage(prompt, id, token, styleReference) {

	let body = {
		numVariations:1,
		prompt,
		size:{
			width:1792,
			height:2304
		}
	}

	if(styleReference) {
		body.style = {
			imageReference: {
				source: { 
					uploadId: styleReference 
				}
			}
		};
	}

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

let upload = await uploadImage('./source_image.jpg', 'image/jpeg', CLIENT_ID, token);
let styleReference = upload.images[0].id;

let prompt = 'A long-haired cat majestically riding a flying unicorn. The cat is wielding a rainbow shield and sword, pointing the swords tip outwards.';

// First, no style reference
let result = await textToImage(prompt, CLIENT_ID, token);
let fileName = `./output/without_style_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);

// Second, with a reference
result = await textToImage(prompt, CLIENT_ID, token, styleReference);
fileName = `./output/with_style_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);
