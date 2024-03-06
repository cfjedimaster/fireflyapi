# Getting Started with Firefly APIs and Node.js

Adobe's Firefly APIs allow for incredibly powerful creative workflows with a simple-to-use REST-based API. In this tutorial, we'll walk you through the process of creating your first implementation of the APIs. Let's get started!

## Prereqs

In order to complete this tutorial, you will need:

* Firefly API credentials. You can sign up for [free trial credentials](https://developer.adobe.com/firefly-api) and use them for this tutorial. You will need two values: `client_id` and `client_secret`. 
* You will want to set these two values are environment variables available in your terminal/shell. How that's done depends on your operating system, but for the Mac (and WSL), you can do:  `export CLIENT_ID=YOURIDHERE` and `export CLIENT_SECRET=YOURSECRETHERE`. Note that our code is going to assume `CLIENT_ID` and `CLIENT_SECRET` - case matters!
* The code for this tutorial will be presented in both Node.js and Python, so one
* Node.js installed and some familiarity with working with it, or JavaScript in general. 

Begin by creating a new script, named `firefly.js`, and save it anywhere on your computer. This will be the script we use to test our integration with Firefly APIs. 

## Step One - Authentication

Time to actually start writing code. We'll begin by declaring a few variables. Remember that we stated earlier that you needed to create two environment variables, the code here depends on it:

```js
/*
Set our creds based on environment variables.
*/
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
```
```python
#Set our creds based on environment variables.
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')
```

To authenticate, we take these two variables and make a POST request to our authentication endpoint: `https://ims-na1.adobelogin.com/ims/token/v3`. We need to pass our credentials along with the requested scopes that allow for access to Firefly. We can wrap up the entire thing in one simple function:

```js
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

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);
```
```python
def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()["access_token"]

token = getAccessToken(CLIENT_ID, CLIENT_SECRET)
```

Note that this isn't handling any errors with the credentials and that's something you would want to have in production code. 

## Step Two - Generate an Image with a Prompt

For our simple demo, we're going to take a prompt and ask Firefly to generate four images from it. As with all APIs, the [API Reference](https://developer.adobe.com/firefly-api/api/) is crucial to understanding whats required and what's optional for your calls. Let's consider the [Text-to-image with optional generative match](https://developer.adobe.com/firefly-api/api/#operation/v2/images/generate) call:

![Screenshot from reference](./shot1.png)

Based on the docs, we can see that the only required parameter is `prompt`. Also, the `n` prompt specifies how many images we want. So the simplest request body we could build would look like so:

```
{
	"prompt":"a cat dancing on a rainbow",
	"n":4
}
```

Let's see this in action! First, we'll build a simple function to call the REST endpoint. It requires our previous client id value and the access token, and our prompt:

```js
async function textToImage(prompt, id, token) {

	let body = {
		"n":4,
		prompt
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

	return await req.json();
}
```
```python
def textToImage(text, id, token):

	data = {
		"prompt":text,
		"n":4,
	}


	response = requests.post("https://firefly-api.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()
```

Note the authentication headers. This is all properly documented but it bears calling out. The token is passed in the `Authorization` header, and the client id in `X-Api-Key`. The result is a JSON string we can then return to the caller. 

Now to make the magic happen:

```js
let prompt = 'a cat dancing on a rainbow';
let result = await textToImage(prompt, CLIENT_ID, token);
console.log(JSON.stringify(result,null,'\t'));
```
```python
prompt = "a cat dancing on a rainbow"
result = textToImage(prompt, CLIENT_ID, token)
print(json.dumps(result, indent=True))
```
We define a basic prompt (please change this to fit your interest!) and call the function we wrote to hit the Firefly API. The result is then just dumped to screen. Here's an example (we removed two results to keep the size down):

```json
{
        "version": "2.10.2",
        "size": {
                "width": 2048,
                "height": 2048
        },
        "predictedContentClass": "art",
        "outputs": [
                {
                        "seed": 1003577025,
                        "image": {
                                "id": "723779df-6388-49b7-81bc-81f735bd2423",
                                "presignedUrl": "https://pre-signed-firefly-prod.s3.amazonaws.com/images/723779df-6388-49b7-81bc-81f735bd2423?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIARDA3TX66LLPDOIWV%2F20240229%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240229T212734Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=4c8cb7c08a954d1990c26308edf13992a479c7da220ae6797252c4f03ad7c39e"
                        }
                },
                {
                        "seed": 2103068358,
                        "image": {
                                "id": "ae302228-e6bb-435e-8e49-6db12b9a619b",
                                "presignedUrl": "https://pre-signed-firefly-prod.s3.amazonaws.com/images/ae302228-e6bb-435e-8e49-6db12b9a619b?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIARDA3TX66LLPDOIWV%2F20240229%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240229T212734Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=c9dccb63e2824b69984b4717204774358ae198d9597d340a712a4563dfe607df"
                        }
                }
        ]
}
```

In theory, you're done! You can copy and paste any of the `presignedUrl` values from the result to see, but lets it one final step and write a quick utility to download those images. First, let's import some file-related modules:

```js
import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
```
```python
import requests 
```

Next, define a simple function that given a URL and filepath, will stream the data to the filesystem (this portion is only required in Node):

```js
async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}
```
```python
def downloadFile(url, filePath):
	with open(filePath,'wb') as output:
		bits = requests.get(url, stream=True).content
		output.write(bits)
```

The last step is to iterate over the results and save each one. To give them unique names, we'll use the `seed` value from the result:

```js
for(let output of result.outputs) {
	let fileName = `./${output.seed}.jpg`;
	await downloadFile(output.image.presignedUrl, fileName);
}
```
```python
for output in result["outputs"]:
	fileName = f'./{output["seed"]}.jpg';
	downloadFile(output["image"]["presignedUrl"], fileName);
```

And that's it! After running, you'll see four images output in the same directory:

![Four sample outputs](./shot2.png)

## Complete Code

Here's the entire code sample. As a reminder, feel free to modify and change the prompt:

```js
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
	
	let resp = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', 
		{ 
			method: 'POST', 
			body: params
		}
	);

	let data = await resp.json();
	return data.access_token;
}

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

async function textToImage(prompt, id, token) {

	let body = {
		"n":4,
		prompt
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

	return await req.json();
}

let prompt = 'a cat dancing on a rainbow';
let result = await textToImage(prompt, CLIENT_ID, token);
console.log(JSON.stringify(result,null,'\t'));

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

for(let output of result.outputs) {
	let fileName = `./${output.seed}.jpg`;
	await downloadFile(output.image.presignedUrl, fileName);
}
```
```python
import os 
import requests 
import json 

#Set our creds based on environment variables.
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')

def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()["access_token"]

token = getAccessToken(CLIENT_ID, CLIENT_SECRET)

def textToImage(text, id, token):

	data = {
		"prompt":text,
		"n":4,
	}


	response = requests.post("https://firefly-api.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()


prompt = "a cat dancing on a rainbow"
result = textToImage(prompt, CLIENT_ID, token)
print(json.dumps(result, indent=True))

def downloadFile(url, filePath):
	with open(filePath,'wb') as output:
		bits = requests.get(url, stream=True).content
		output.write(bits)

for output in result["outputs"]:
	fileName = f'./{output["seed"]}.jpg';
	downloadFile(output["image"]["presignedUrl"], fileName);
```