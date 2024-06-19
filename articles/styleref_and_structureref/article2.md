# Generating Firefly Images with Reference Style and Structure Sources

In our [previous guide](https://wiki.corp.adobe.com/display/devex/Using+Content+Class+and+Style+Presets), we demonstrated two settings that give developers more control over their generated assets - the content class and style preset. As stated then, these were just a few of the possible options available when generating your results. In this guide, we'll look at two more:

* Using an existing image as a style reference
* Using an existing image as a structure reference

## Prerequisites

In order to use this guide, you will need Firefly Services credentials, consisting of a CLIENT_ID  and CLIENT_SECRET  value. The code for this guide will make use of the Firefly REST API via Node.js, but could be done in any language, or with the [SDK](https://developer.adobe.com/firefly-services/docs/guides/sdks/). The code demonstrated uses both imports and top-level await, so either save your sample as a .mjs file or use `"type":"module"` in your package.json. 

## Working with Reference Images

Before we get into both examples, let's discuss how to work with your existing assets as reference images. The APIs discussed today allow you to reference images in two ways.

First, you can place your media on cloud storage and generate temporary readable URLs for them. However, these URLs may only be used with S3, Sharepoint, and Dropbox. 

Secondly, images may be uploaded via the Upload API. This API lets you send a source image (in either PNG, JPEG, or WebP format) and returns a unique ID that can be used in later calls, like the ones we will demonstrate below. 

Using the [Upload API](https://bitter-tiger-28.redoc.ly/#operation/upload) requires a file, of course, as well as the mime type. Here is an example function that demonstrates this. It assumes a previously created access token using a `CLIENT_ID` and `CLIENT_SECRET` value.

```js
async function uploadImage(filePath, fileType, id, token) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;

	let upload = await fetch('https://firefly-api-enterprise-stage.adobe.io/v2/storage/image', {
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

	return await upload.json();
}
```

The result of this call will be a JSON object containing the ID of the image:

```json
{
	"images": [
		{"id": "9035f157-4105-4a63-913b-c120285dd799"}
	]
}
```

## Using a Reference Image for Style

For our first example, we will be using a reference image to impact the style of our result. Given a standard prompt, we'll call the Text to Image API both with, and without this setting so you can compare the differences.

First, our source image. Note the color and fire imagery:

![Source image](./source_image.jpg)

To use this source image, we use the upload ID and retrieve the ID value. (Don't forget, you can also use cloud storage.) This ID can be passed to the Text to Image API like so, specifically the `style.styleReference` portion.

```json
{
	"numVariations":1,
	"prompt":"some prompt",
	"size":{
		"width":1792,
		"height":2304
	}, 
	"style": {
		"imageReference":{
			"source":{
				"uploadId":"The ID value of the uploaded style reference"
			}
		}
	}
}
```

Let's look at an example of this. The following script is mostly utility methods covered before (getting the access token, uploading an image, and simple method to download results):

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

async function uploadImage(filePath, fileType, id, token) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;

	let upload = await fetch('https://firefly-api-enterprise-stage.adobe.io/v2/storage/image', {
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

	return await upload.json();
}

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}
```

Now let's build a wrapper function to text to image that optionally allows you to pass the ID of an uploaded image:

```js
async function textToImage(prompt, id, token, styleReference) {

	let body = {
		numVariations:1,
		prompt,
		size:{
			width:1792,
			height:2304
		}
	}

	if(styleReference) {
		body.style = { 
			imageReference: {
				source: { 
					uploadId: styleReference 
				}
			}
		};
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

Finally, our test code. It will authenticate, upload the style reference, and then make two call using the same prompt, one with the style reference and one without:

```js
let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

let upload = await uploadImage('./source_image.jpg', 'image/jpeg', CLIENT_ID, token);
let styleReference = upload.images[0].id;

let prompt = 'A long-haired cat majestically riding a flying unicorn. The cat is wielding a rainbow shield and sword, pointing the swords tip outwards.';

// First, no style reference
let result = await textToImage(prompt, CLIENT_ID, token);
let fileName = `./output/without_style_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);

// Second, with a reference
result = await textToImage(prompt, CLIENT_ID, token, styleReference);
fileName = `./output/with_style_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);
```

Given our prompt, here's the initial result with no style:

![Without style reference](./without_style_reference.jpg)

And here's the result with the reference:

![With style reference](./with_style_reference.jpg)

The difference is striking.

Here's the complete script for this example:

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

async function uploadImage(filePath, fileType, id, token) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;

	let upload = await fetch('https://firefly-api-enterprise-stage.adobe.io/v2/storage/image', {
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

	return await upload.json();
}

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

async function textToImage(prompt, id, token, styleReference) {

	let body = {
		numVariations:1,
		prompt,
		size:{
			width:1792,
			height:2304
		}
	}

	if(styleReference) {
		body.style = { 
			imageReference: {
				source: { 
					uploadId: styleReference 
				}
			}
		};
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

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

let upload = await uploadImage('./source_image.jpg', 'image/jpeg', CLIENT_ID, token);
let styleReference = upload.images[0].id;

let prompt = 'A long-haired cat majestically riding a flying unicorn. The cat is wielding a rainbow shield and sword, pointing the swords tip outwards.';

// First, no style reference
let result = await textToImage(prompt, CLIENT_ID, token);
let fileName = `./output/without_style_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);

// Second, with a reference
result = await textToImage(prompt, CLIENT_ID, token, styleReference);
fileName = `./output/with_style_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);
```

## Working with Structure References

The next feature we'll demonstrate is using an image as a *structure* reference. As you can imagine, this tells Firefly to use the source not as a 'design reference', ie, trying to match color schemes and styling, but more the actual structure of the source image itself. 

First, as with the style reference example, when you've uploaded your image you can reference it in the your data sent to the API:

```json
{
	"numVariations":1,
	"prompt":"some prompt",
	"size":{
		"width":1792,
		"height":2304
	}, 
	"structure":{
		"imageReference":{
			"source":{
				"uploadId":"The ID value of the uploaded structure reference"
			}
		}
	}
}
```

Note that as with `styleReference`, cloud storage URLs may be used as well. To demonstrate this, once again we'll use a simple wrapper to the Text to Image API that optionally takes the ID of an image to use as the structure reference:

```js
async function textToImage(prompt, id, token, structureReference) {

	let body = {
		numVariations:1,
		prompt,
		size:{
			width:1792,
			height:2304
		}
	}

	if(structureReference) {
		body.structure = {
			imageReference: {
				source: { 
					uploadId: structureReference 
				}
			}
		};
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

Let's consider this as a structure reference:

![Structure reference](./cat_writing_laptop.jpg)

Note the position of the cat, the direction it is facing, and so forth. Now consider this prompt: "picture of a poodle with colorful fur looking majestic"

Without the structure reference, we get:

![Without structure reference](./without_structure_reference.jpg)

Now compare it to the one where the structure reference was used:

![With structure reference](./with_structure_reference.jpg)

Again, the difference is striking. Here's the complete script used for this demo:

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

async function uploadImage(filePath, fileType, id, token) {

	let stream = fs.createReadStream(filePath);
	let stats = fs.statSync(filePath);
	let fileSizeInBytes = stats.size;

	let upload = await fetch('https://firefly-api-enterprise-stage.adobe.io/v2/storage/image', {
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

	return await upload.json();
}

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

async function textToImage(prompt, id, token, structureReference) {

	let body = {
		numVariations:1,
		prompt,
		size:{
			width:1792,
			height:2304
		}
	}

	if(structureReference) {
		body.structure = {
			imageReference: {
				source: { 
					uploadId: structureReference 
				}
			}
		};
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

let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

let upload = await uploadImage('./cat_writing_laptop.jpg', 'image/jpeg', CLIENT_ID, token);
let structureReference = upload.images[0].id;

let prompt = 'picture of a poodle with colorful fur looking majestic';

// First, no structure reference
let result = await textToImage(prompt, CLIENT_ID, token);
let fileName = `./output/without_structure_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);

// Second, with a reference
result = await textToImage(prompt, CLIENT_ID, token, structureReference);
fileName = `./output/with_structure_reference.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);
```

## Next Steps

While we've now demonstrated two powerful ways to influence Firefly when generating images, there's still much more that can be tweaked in your code. Check the [API reference](https://bitter-tiger-28.redoc.ly/) for a full list of those options.
