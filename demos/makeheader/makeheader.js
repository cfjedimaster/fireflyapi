// Requires Node 21.7.0
process.loadEnvFile();
import { styleText } from 'node:util';
import { v4 as uuid4 } from 'uuid';
import open from 'open';
import fs from 'fs';

const FF_CLIENT_ID = process.env.FF_CLIENT_ID;
const FF_CLIENT_SECRET = process.env.FF_CLIENT_SECRET;

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
		"n":4,
		"prompt":text,
		"size":{
			"width":"2304",
			"height":"1792"
		}
	}

	let req = await fetch('https://firefly-api.adobe.io/v2/images/generate', {
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


if(process.argv.length < 3) {
	console.log(styleText('red', 'Usage: makeheader.js <<prompt>>'));
	process.exit(1);
} 

const prompt = process.argv[2];

console.log(styleText('green', `Generating headers for: ${prompt}`));

let token = await getFFAccessToken(FF_CLIENT_ID, FF_CLIENT_SECRET);
let result = await textToImage(prompt, FF_CLIENT_ID, token);

console.log(styleText('green', 'Results generated - creating preview...'));

let html = `
<style>
img {
	max-width: 650px;
}

.results {
	display: grid;
	grid-template-columns: repeat(2, 50%);
}
</style>
<h2>Results for Prompt: ${prompt}</h2>
<div class="results">
`;

result.outputs.forEach(i => {
	html += `<p><img src="${i.image.presignedUrl}"></p>`;
});

html += '</div>';

//console.log(JSON.stringify(result, null, '\t'));
let filename = `${uuid4()}.html`;
fs.writeFileSync(filename, html, 'utf8');
await open(filename, {
	wait: true
});
fs.unlinkSync(filename);