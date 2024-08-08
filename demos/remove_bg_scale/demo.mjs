import { Dropbox } from 'dropbox';

// Credentials for Firefly Services
let CLIENT_ID = process.env.CLIENT_ID;
let CLIENT_SECRET = process.env.CLIENT_SECRET;

// Credentials for Dropbox
let DB_APP_KEY = process.env.DROPBOX_APP_KEY;
let DB_APP_SECRET = process.env.DROPBOX_APP_SECRET;
let DB_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;

// Initialize Dropbox access
let dbx = new Dropbox({
	clientId:DB_APP_KEY,
	clientSecret:DB_APP_SECRET,
	refreshToken:DB_REFRESH_TOKEN
});

async function getSignedDownloadUrl(path) {
	return (await dbx.filesGetTemporaryLink({path})).result.link;
}

async function getSignedUploadUrl(path) {
	return (await dbx.filesGetTemporaryUploadLink({commit_info: {path}})).result.link;
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

async function removeBG(input, output, id, token) {

	let data = {
		"input": {
			"href": input,
			"storage": "dropbox"
  		},
		"output": {
		    "href": output,
		    "storage": "dropbox",
    		"overwrite": true
		}
	};

	let resp = await fetch('https://image.adobe.io/sensei/cutout', {
		method: 'POST', 
		headers: {
			'Authorization':`Bearer ${token}`,
			'x-api-key': id
		}, 
		body: JSON.stringify(data)
	});

	return await resp.json();

}

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
		if(data.status) status = data.status;
		if(status !== 'succeeded' && status !== 'failed') await delay(1000);
	}

	return status;

}

let inputURL = await getSignedDownloadUrl('/RemoveBGProcess/input/raymond-camden-high.jpg');
console.log('Got signed URL to read our input image.');

let outputURL = await getSignedUploadUrl('/RemoveBGProcess/output/raymond-camden-high.jpg');
console.log('Got signed URL for our output.');

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);
console.log('Got token for Firefly Services');

let bgJob = await removeBG(inputURL, outputURL, CLIENT_ID, token);
console.log('Created Remove BG Job, will now start checking status...')

let result = await pollJob(bgJob['_links'].self.href, CLIENT_ID, token);
console.log('Done and assuming success', result);

