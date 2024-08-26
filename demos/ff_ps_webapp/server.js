import * as http from 'http';
import fs from 'fs'; 
import { Readable } from 'stream';
import { finished } from 'stream/promises';

const FF_CLIENT_ID = process.env.FF_CLIENT_ID;
const FF_CLIENT_SECRET = process.env.FF_CLIENT_SECRET;

// Just for PDF Services
const REST_API = "https://pdf-services.adobe.io/";


// Firefly Area
async function getFFAccessToken(id, secret) {

	const params = new URLSearchParams();

	params.append('grant_type', 'client_credentials');
	params.append('client_id', id);
	params.append('client_secret', secret);
	params.append('scope', 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis');
	
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
		"numVariations":4,
		"prompt":text,
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

	//console.log('STATUS', req.status);
	//console.log(...req.headers);

	let resp = await req.json();
	return resp;
}

async function delay(x) {
	return new Promise(resolve => {
		setTimeout(() => resolve(), x);
	});
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



// Main Server Area 
async function handler(req, res) {
	console.log('Entered handler.', req.method, req.url);

	if(req.method === 'GET' && req.url === '/') {
		res.writeHead(200, { 'Content-Type':'text/html' });
		res.write(fs.readFileSync('./index.html'));
		res.end();
	} else if(req.method === 'GET' && req.url === '/app.js') {
		res.writeHead(200, { 'Content-Type':'text/html' });
		res.write(fs.readFileSync('./app.js'));
		res.end();
	} else if(req.method === 'POST' && req.url === '/genImage') {

		let body = '';
		req.on('data', chunk => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			body = JSON.parse(body);
			console.log('BODY:\n', JSON.stringify(body, null, '\t'));

			/*
			let result = await textToImage(body.prompt, FF_CLIENT_ID, token);
			*/
			let result = { outputs:null };
			result.outputs = [
    {
        "seed": 743811038,
        "image": {
            "url": "https://pre-signed-firefly-prod.s3-accelerate.amazonaws.com/images/6fdef5f6-4fc9-4193-9871-dd7b946b8879?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIARDA3TX66CSNORXF4%2F20240826%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240826T214831Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=3436810fba0840c3a30086635ae599e240fa900e6108748fa5c9efd0800a557e"
        }
    },
    {
        "seed": 41880612,
        "image": {
            "url": "https://pre-signed-firefly-prod.s3-accelerate.amazonaws.com/images/fb259740-8904-4598-a578-fad3a6a1cbd7?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIARDA3TX66CSNORXF4%2F20240826%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240826T214831Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=ae4ab2cd2c7cfd03e527d9685d1650e436503437aeecce17aeff06bec5a023e3"
        }
    },
    {
        "seed": 1945567999,
        "image": {
            "url": "https://pre-signed-firefly-prod.s3-accelerate.amazonaws.com/images/6afa4643-c496-4ec3-9252-715c7b9c96bb?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIARDA3TX66CSNORXF4%2F20240826%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240826T214831Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=5f6413a15b3392f54b29ec55bfb6ac18a2e69e4794779160267cd916645c6630"
        }
    },
    {
        "seed": 30405309,
        "image": {
            "url": "https://pre-signed-firefly-prod.s3-accelerate.amazonaws.com/images/b2f43c40-2d91-463a-bc11-34a028c59ce6?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIARDA3TX66CSNORXF4%2F20240826%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240826T214831Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=2be5b1fd6a399157e43d7f55bc7a17e10ed59ee5463e8a2e476ee9ac43dd875f"
        }
    }
];
			res.writeHead(200, { 'Content-Type':'application/json' });
			res.write(JSON.stringify(result.outputs));
			res.end();

		});
	} else if(req.method === 'POST' && req.url === '/getImages') {

		let body = '';
		req.on('data', chunk => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			body = JSON.parse(body);
			console.log('BODY:\n', JSON.stringify(body, null, '\t'));

			/*
			let result = await generatePDF(body);
			const fileData = await fetch(result.downloadUri);
			const buffer = await fileData.arrayBuffer();
			const stringifiedBuffer = Buffer.from(buffer).toString('base64');
			*/
			res.writeHead(200, { 'Content-Type':'application/json' });
			//console.log(result);
			res.write('{}');
			res.end();

		});


	}

}
const token = await getFFAccessToken(FF_CLIENT_ID, FF_CLIENT_SECRET);

const server = http.createServer(handler);
server.listen(3000);
console.log('Listening on port 3000!');
