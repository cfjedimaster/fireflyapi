/*
The purpose of this script is to test the validity of credentials. It will run a test to get tokens, run a Firefly API call, 
and then a Photoshop call.

To test, pass the client id and client secret as arguments:

node credential_test.mjs CLIENTID CLIENTSECRET
*/

if(process.argv.length < 4) {
	console.log('To use this script, you must pass the client id and client secret arguments: node credential_test.msj ID SECRET');
	process.exit();
}

let clientId = process.argv[2];
let clientSecret = process.argv[3];

// Step One - get token

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

	return await resp.json();
}

console.log('Getting access token');
let tokenReq = await getAccessToken(clientId, clientSecret);

if(tokenReq.access_token) {
	console.log('Token successfully retrieved.');
} else {
	console.log('Token not successfully retrieved:');
	console.log(tokenReq);
	process.exit(1);
}

let token = tokenReq.access_token;

// Step Two, kick off a T2I call

async function textToImage(prompt, id, token) {

	let body = {
		prompt
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

	return await req.json();
}

console.log('Attempting Firefly T2I...');
let result = await textToImage('a picture of a test', clientId, token);
if(result.error_code) {
	console.log('There was an error, check the result to ensure it is auth related:\n', result);
	process.exit(1);
}

console.log('Firefly successfully tested.');
let inputURL = result.outputs[0].image.url;

async function makeATJob(input, output, id, token) {
	let data = {
		"inputs": {
			"href": input,
			"storage": "external"
		},
		"outputs": [{
			"href": output,
			"storage": "external",
			"type":"image/jpeg",
			"overwrite": true
		}]
	};				

	let resp = await fetch('https://image.adobe.io/lrService/autoTone', {
		headers: {
			'Authorization':`Bearer ${token}`,
			'x-api-key': id,
			'Content-Type':'application/json'
		}, 
		method:'POST',
		body:JSON.stringify(data)
	});

	return await resp.json();
}

console.log('Attemping a Photoshop Call');
/*
We will use a valid input but a nonsense output url which should be ignored
*/
result = await makeATJob(inputURL, inputURL, clientId, token);

if(result.error_code) {
	console.log('There was an error, check the result to ensure it is auth related:\n', result);
	process.exit(1);
}
console.log('Photoshop successfully tested.');

// All done!