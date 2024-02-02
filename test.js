import 'dotenv/config';
import fs from 'fs/promises';
import slugify from '@sindresorhus/slugify';

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

	let body = {
		"size":size, 
		"n":n,
		"prompt":text, 
		"styles":styles
	}

	if(contentClass) body.contentClass = contentClass;

	let req = await fetch('https://firefly-beta.adobe.io/v1/images/generations', {
		method:'POST',
		headers: {
			'X-Api-Key':id, 
			'Authorization':`Bearer ${token}`,
			'Accept':'application/json+base64', 
			'x-accept-mimetype':'image/jpeg',
			'x-api-variant':'v2',
			'Content-Type':'application/json'
		}, 
		body: JSON.stringify(body)
	});

	let resp = await req.json();
	return resp;
}

// Saving b64 properly isn't hard, but I still though a utility func would be helpful
async function saveBase64(b64, path) {
	return await fs.writeFile(path, b64, 'base64');
}

const prompt = 'a humanized unicorn wearing a leather jacket and looking tough';

console.log('Getting access token...');
let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

console.log('Now generating my images...');
let result = await textToImage(prompt, CLIENT_ID, token, '1408x1024', 3, 'art', ['Nostalgic','Antique photo']);
if(!result.images) {
	console.log(result);
	process.exit(1);
}

for(let image of result.images) {
	let file = `${slugify(prompt)}_${image.seed}.jpg`;
	await saveBase64(image.base64, file);
	console.log(`Saved ${file}.`);
}

console.log('Done');