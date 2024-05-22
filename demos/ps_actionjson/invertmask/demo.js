import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// actionJSON
let action = [
	{
		"_obj": "invert"
	}
];

// Bucket that stores our test files
let s3Client = new S3Client({ region: 'us-east-1' });
let bucket = 'psapitestrkc';

// Credentials for Firefly Services
let CLIENT_ID = process.env.CLIENT_ID;
let CLIENT_SECRET = process.env.CLIENT_SECRET;

async function delay(x) {
	return new Promise(resolve => {
		setTimeout(() => {
			resolve();
		}, x);
	});
}

async function pollJob(jobUrl, id, token) {
	let status = '';

	while(status !== 'succeeded' && status !== 'failed') {

		let resp = await fetch(jobUrl, {
			headers: {
				'Authorization':`Bearer ${token}`,
				'x-api-key': id
			}
		});

		let data = await resp.json();
		//console.log(data);
		if(data.status) status = data.status;
		if(data.outputs && data.outputs[0].status) status = data.outputs[0].status;
		if(status !== 'succeeded' && status !== 'failed') await delay(1000);
	}

	return status;

}

async function getSignedDownloadUrl(path) {
	let command = new GetObjectCommand({ Bucket: bucket, Key:path });
	return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function getSignedUploadUrl(path) {
	let command = new PutObjectCommand({ Bucket: bucket, Key:path });
	return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function getAccessToken(id, secret) {

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

async function createMask(input, output, id, token) {

	let data = {
		"input": {
			"href": input,
			"storage": "external"
  		},
		"output": {
		    "href": output,
		    "storage": "external",
    		"overwrite": true
		}
	};

	let resp = await fetch('https://image.adobe.io/sensei/mask', {
		method: 'POST', 
		headers: {
			'Authorization':`Bearer ${token}`,
			'x-api-key': id
		}, 
		body: JSON.stringify(data)
	});

	return await resp.json();

}

async function createActionJSON(input, output, actionJSON, id, token) {

	let data = {
		"inputs":[{
			"storage":"external",
			"href":input
		}],
		"options":{
			actionJSON
		},
		"outputs":[ {
			"storage":"external",
			"type":"image/png",
			"href":output
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

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);
console.log('Got token for Firefly Services');

let inputURL = await getSignedDownloadUrl('invertmaskdemo/dog1.png');
console.log('Got signed URL to read our input image.');

let outputURL = await getSignedUploadUrl('invertmaskdemo/dog1_masked.png');
console.log('Got signed URL for our output.');

let maskJob = await createMask(inputURL, outputURL, CLIENT_ID, token);
console.log('Created Mask Job, will now start checking status...')

let result = await pollJob(maskJob['_links'].self.href, CLIENT_ID, token);
console.log('Done and assuming success', result);

inputURL = await getSignedDownloadUrl('invertmaskdemo/dog1_masked.png');
let outputInvertedURL = await getSignedUploadUrl('invertmaskdemo/dog1_masked_inverted.png');
console.log('Got signed URL for our inverted URL.');

let actionJob = await createActionJSON(inputURL, outputInvertedURL, action, CLIENT_ID, token);
console.log('Created ActionJSON Job, will now start checking status...', actionJob)

result = await pollJob(actionJob['_links'].self.href, CLIENT_ID, token);
console.log('done');