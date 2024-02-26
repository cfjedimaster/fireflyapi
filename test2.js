/*
This version demonstrates uploading a reference image as source for the prompt.
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
Upload an image to be used as a reference.
*/
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

	return (await upload.json()).images[0];
}

/*
size valid options: Square (2048x2048), Landscape (2304x1792), Portrait (1792x2304), Widescreen (2688x1536)
contentClass options: null, photo, art
n max is 4
*/
async function textToImage(text, id, token, sourceImage, size="1024x1024", n=1, contentClass) {

	let [ width, height ] = size.split('x');
	let body = {
		"size": { width, height }, 
		"n":n,
		"prompt":text,
		"styles": {
			"referenceImage":{
				"id":sourceImage
			}
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

// Credit: https://stackoverflow.com/a/74722656/52160
async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}



const prompt = 'a humanized unicorn wearing a leather jacket and looking tough';
const source = 'input/red_sunset_car.jpg';

console.log('Getting access token...');
let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

console.log('Uploading source image');
let upload = await uploadImage(source, CLIENT_ID, token);


console.log('Now generating my images...');
let result = await textToImage(prompt, CLIENT_ID, token, upload.id, '2304x1792', 3, 'photo') ;
if(!result.outputs) {
	console.log(JSON.stringify(result,null,'\t'));
	process.exit(1);
}

for(let output of result.outputs) {
	let file = `output/${slugify(prompt)}_${output.seed}_source_${slugify(source)}.jpg`;
	//await saveBase64(image.base64, file);
	await downloadFile(output.image.presignedUrl, file);
	console.log(`Saved ${file}.`);
}

console.log('Done');