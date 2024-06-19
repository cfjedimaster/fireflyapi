---
title: Create Your First Firefly API Implementation - Adobe Firefly API
description: This how-to guides you through the process of integrating Adobe's Firefly workflows into your applications.
keywords:
  - Adobe Firefly Services
  - Firefly API
  - Integrating Firefly Services
  - Developer documentation
  - How-to guides
  - Tutorial
  - Firefly tutorial
  - Firefly API tutorial
  - Get started
  - Environment setup
  - Setup
  - Workflow
  - Credentials
  - Authentication
  - Sample code
  - Generate image
  - Call firefly
  - Sample call
  - Application development
  - First Firefly application
  - Firefly implementation
  - Prompts
  - Getting started with Firefly API
  - Application creation tutorial
  - Step-by-step guide
  - Development workflow
  - Application setup
  - API integration
  - User interface development
  - Backend implementation
  - Frontend development
  - SDK usage
  - Code examples
  - Automate processing
  - Development environment
  - Application deployment
  - Testing and debugging
  - Styles
contributors:
  - https://github.com/nimithajalal
  - https://github.com/cfjedimaster
hideBreadcrumbNav: true
---

# Create your first Firefly API implementation

A step-by-step guide to creating your first implementation of the Firefly API.

The Adobe Firefly API offers a seamless way to integrate powerful creative workflows into your applications using a simple REST-based API. In this tutorial, we'll guide you through creating your first implementation of the Firefly API.

<InlineAlert slots="text" />

This tutorial provides code snippets in both `Node.js` and `Python` for your convenience. Feel free to use the language of your choice to complete the implementation of your first Firefly API.

Let's get started!

## Prerequisites

Before we begin, make sure you have the following:

-   Firefly API credentials. If you don't have them yet, first visit the Firefly Services [Getting Started](../../../guides/get-started.md) guide to obtain a `client_id` and `client_secret`.
-   `Node.js` or `Python` installed on your machine and basic familiarity with `JavaScript` or `Python`.

## Step 1: Set Up Your Environment

Begin by creating a new script, named `firefly.js` (or `firefly.py`), and save it anywhere on your computer. This will be the script we use to test our integration with Firefly API endpoints.

Next, set your `client_id` and `client_secret` as environment variables. For example, on a Mac or in Windows Subsystem for Linux (WSL), you can do the following:

```js
export CLIENT_ID=YOURIDHERE
export CLIENT_SECRET=YOURSECRETHERE
```

Note that our code is going to assume CLIENT_ID and CLIENT_SECRET - case matters!

## Step 2: Authentication

Let's begin by initializing a few variables. As previously mentioned, it is crucial to set up two environment variables, as the following code relies on them:

<CodeBlock slots="heading, code" repeat="2" languages="JavaScript, PYTHON" />

#### Sample code

```js
/* Set our creds based on environment variables.
*/
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
```

#### Sample code

```python
#Set our creds based on environment variables.
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')
```

To authenticate, we take these two variables and make a `POST` request to our authentication endpoint: `https://ims-na1.adobelogin.com/ims/token/v3`. You need to pass your credentials along with the requested scopes that allow for access to Firefly. We can wrap up the entire thing in one simple function:

<CodeBlock slots="heading, code" repeat="2" languages="JavaScript, PYTHON" />

#### Sample code

```js
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

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);
```

#### Sample code

```python
def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis")
	return response.json()["access_token"]

token = getAccessToken(CLIENT_ID, CLIENT_SECRET)
```

<InlineAlert variant="info" slots="text" />

The provided code example does not include error handling for credentials. For production code, it's essential to implement proper error handling to ensure the security and reliability of your application.

## Step 3: Generate an Image with a Prompt

For our demo, we will use Firefly to generate four images from a single prompt.

In this case, we will focus on the `generateImages` functionality, which includes optional generative matching.

<InlineAlert variant="help" slots="text" />

Please refer to the [generateImages](../api/image_generation/index.md) in the API Reference for more details.

Based on the docs, we can see that the only required parameter is prompt. Also, the `numVariations` prompt specifies how many images we want. So the simplest request body we could build would look like so:

```js
{
	"prompt":"a cat dancing on a rainbow",
	"numVariations":4
}
```

Now, let's create a function to generate an image using a prompt.

First, we'll build a simple function to call the REST endpoint.
It requires our previous `client_id` value and the `access_token`, and our prompt:

<CodeBlock slots="heading, code" repeat="2" languages="JavaScript, PYTHON" />

#### Sample code

```js
async function textToImage(prompt, id, token) {

	let body = {
		"numVariations":4,
		prompt
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
```

#### Sample code

```python
def textToImage(text, id, token):

	data = {
		"prompt":text,
		"numVariations":4,
	}


	response = requests.post("https://firefly-api.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()
```

Please ensure you include the authentication headers correctly. Pass the token in the Authorization header and the `client ID` in the `X-Api-Key` header. The API will return a JSON string for you to process and return to the caller.

### Executing the Firefly API Call

We define a simple prompt and call the function to interact with the Firefly API, displaying the result on the screen.

<CodeBlock slots="heading, code" repeat="3" languages="JavaScript, PYTHON, JSON" />

#### Sample code

```js
let prompt = 'a cat dancing on a rainbow';
let result = await textToImage(prompt, CLIENT_ID, token);
console.log(JSON.stringify(result, null, '\t'));
```

#### Sample code

```python
prompt = "a cat dancing on a rainbow"
result = textToImage(prompt, CLIENT_ID, token)
print(json.dumps(result, indent=True))
```

#### Response

```js
{
 "size": {
  "width": 2048,
  "height": 2048
 },
 "outputs": [
  {
   "seed": 295213121,
   "image": {
    "uploadId": "014c2235-f2e9-47be-98a9-33bc9d62568b",
    "url": "https://pre-signed-firefly-stage.s3.amazonaws.com/images/014c2235-f2e9-47be-98a9-33bc9d62568b?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA55EBG7KCZFCHQDZT%2F20240510%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240510T145429Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=a91dfaf608f5f539c80339778aa1bd45dc8698fc35bd32ba41e93d0d2e288632"
   }
  },
  {
   "seed": 295109025,
   "image": {
    "uploadId": "1c1ae898-0709-4a28-bb6d-1c677189a03b",
    "url": "https://pre-signed-firefly-stage.s3.amazonaws.com/images/1c1ae898-0709-4a28-bb6d-1c677189a03b?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA55EBG7KCZFCHQDZT%2F20240510%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240510T145429Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=88bf526592ef5e72e016619c470a346789403660933f05f523af467704ebb0b8"
   }
  },
  {
   "seed": 779747824,
   "image": {
    "uploadId": "e56845cd-bf6d-4242-b1db-2eb357c821a5",
    "url": "https://pre-signed-firefly-stage.s3.amazonaws.com/images/e56845cd-bf6d-4242-b1db-2eb357c821a5?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA55EBG7KCZFCHQDZT%2F20240510%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240510T145429Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=77d4b996909b04cfe1e892c12345f28d97b47a43e79bdf8ae91a36a87eac73a3"
   }
  },
  {
   "seed": 1081574056,
   "image": {
    "uploadId": "0985b3be-5961-409a-a6e5-8a31e44e6aed",
    "url": "https://pre-signed-firefly-stage.s3.amazonaws.com/images/0985b3be-5961-409a-a6e5-8a31e44e6aed?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA55EBG7KCZFCHQDZT%2F20240510%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240510T145429Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=0fc4ff2e7b0545208fc5b08f1bb18d265b429166d0e0bfbe49b411aa01142bae"
   }
  }
 ],
 "photoSettings": {
  "aperture": 1.2,
  "shutterSpeed": 0.0005,
  "fieldOfView": 14
 },
 "contentClass": "art"
}
```

This function sends a POST request to the Firefly API with the prompt and retrieves the generated images. Replace `a cat dancing on a rainbow` with your desired prompt.

You can copy and paste any of the `url` values from the result to view the images.

## Step 4: Downloading Images from Firefly API

Let's see how you can write a quick utility to download these images.

### Import the Required Modules

First, import the necessary file-related modules and the requests modules for Node or Python:

<CodeBlock slots="heading, code" repeat="2" languages="JavaScript, PYTHON" />

#### Sample code

```js
import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
```

#### Sample code

```python
import requests 
```

### Define the `downloadFile` function

Create a function that takes a URL and a file path as arguments, and downloads the file from the URL to the specified path.

<CodeBlock slots="heading, code" repeat="2" languages="JavaScript, PYTHON" />

#### Sample code

```js
async function downloadFile(url, filePath) {
    let res = await fetch(url);
    const body = Readable.fromWeb(res.body);
    const download_write_stream = fs.createWriteStream(filePath);
    return await finished(body.pipe(download_write_stream));
}
```

#### Sample code

```python
def downloadFile(url, filePath):
	with open(filePath,'wb') as output:
		bits = requests.get(url, stream=True).content
		output.write(bits)
```

### Iterate over the results and save each image

Finally, iterate over the results and save each image with a unique file name using the seed value from the result:

<CodeBlock slots="heading, code" repeat="2" languages="JavaScript, PYTHON" />

#### Sample code

```js
for(let output of result.outputs) {
    let fileName = `./${output.seed}.jpg`;
    await downloadFile(output.image.url, fileName);
}
```

#### Sample code

```python
for output in result["outputs"]:
    fileName = f'./{output["seed"]}.jpg';
    downloadFile(output["image"]["url"], fileName);
```

After running these steps, you'll see four images output in the same directory.

**Sample output**

![a cat dancing on a rainbow](../)

## Complete Code

Here's the entire code sample. As a reminder, feel free to modify and change the prompt.

<InlineAlert variant="warning" slots="title, text" />

IMPORTANT

Note that this Node.js code uses imports and top-level `await`, so you must either use the `.mjs` extension on your script file or ensure you have a `package.json` with `type: "module"`.

<CodeBlock slots="heading, code" repeat="2" languages="JavaScript, PYTHON" />

#### Sample code

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
	
	let resp = await fetch('https://ims-na1-stg1.adobelogin.com/ims/token/v3', 
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
		"numVariations":4,
		prompt
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
	await downloadFile(output.image.url, fileName);
}
```

#### Sample code

```python
import os 
import requests 
import json 

#Set our creds based on environment variables.
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')

def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1-stg1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()["access_token"]

token = getAccessToken(CLIENT_ID, CLIENT_SECRET)

def textToImage(text, id, token):

	data = {
		"prompt":text,
		"numVariations":4,
	}


	response = requests.post("https://firefly-api-enterprise-stage.adobe.io/v3/images/generate", json=data, headers = {
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
	fileName = f'./{output["seed"]}.jpg'
	downloadFile(output["image"]["url"], fileName)
```