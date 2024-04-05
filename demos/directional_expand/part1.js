/*
In this first test, we're going to call gen expand on the source and demonstrate the native behavior of just expanding from the center.
*/
import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

const FF_CLIENT_ID = process.env.CLIENT_ID;
const FF_CLIENT_SECRET = process.env.CLIENT_SECRET;

async function getFFAccessToken(id, secret) {

	const params = new URLSearchParams();

	params.append('grant_type', 'client_credentials');
	params.append('client_id', id);
	params.append('client_secret', secret);
	params.append('scope', 'scope=openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis');
	
	let resp = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', 
		{ 
			method: 'POST', 
			body: params
		}
	);

	let data = await resp.json();
	return data.access_token;
}

async function uploadImage(filePath, id, token) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;
	// todo: make dynamic
	let fileType = 'image/jpeg';

	let upload = await fetch('https://firefly-api.adobe.io/v2/storage/image', {
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

	return (await upload.json()).images[0].id;
}

async function genExpand(imageId, size, id, token) {

	let [ width, height ] = size.split('x');

	let body = {
		image: {
			id:imageId
		}, 
		size: {
			width, height 
		}
	}

	let req = await fetch('https://firefly-api.adobe.io/v1/images/expand', {
		method:'POST', 
		headers: {
			'Authorization':`Bearer ${token}`, 
			'content-type':'application/json',
			'X-API-Key':id,
			'x-accept-mimetype':'image/jpeg'
		}, 
		body:JSON.stringify(body)
	});

	return (await req.json());
}

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

// Get our access token
let token = await getFFAccessToken(FF_CLIENT_ID, FF_CLIENT_SECRET);
console.log('Got token');

// Upload the source image 
let orig = await uploadImage('./walk1.jpg', FF_CLIENT_ID, token);
console.log('Uploaded image', orig);

// Call expand
let result = await genExpand(orig, '1792x1024', FF_CLIENT_ID, token);

// Download sample
let url = result.images[0].image.presignedUrl;
await downloadFile(url, './walk1_normal_expand.jpg');
console.log('Result downloaded.');