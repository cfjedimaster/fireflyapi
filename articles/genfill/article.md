# Using Generative Fill with Firefly Services

Generative Fill is a powerful feature that lets designers modify an existing image by using AI to replace a portion of an image with generated content. This could be a small portion of an image or an entire background behind a central object. Let's take a look at how this can be done with Firefly Services.

## Prerequisites

In order to use this guide, you will need Firefly Services credentials, consisting of a `CLIENT_ID` and `CLIENT_SECRET` value. The code for this guide will make use of the [Firefly REST API](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/api/upload_image/) via Node.js, but could be done in any language, or with the [SDK](https://developer.adobe.com/firefly-services/docs/guides/sdks/). The code demonstrated is using both imports and top-level await so either save your sample as a `.mjs` file or use `"type":"module"` in your `package.json`. Let's get started.

## Generative Fill at a High Level

Before getting into the code, let's consider how generative fill works at a high level.

* You begin with a source image, which can either be uploaded to Firefly Services, or use one of the supported cloud storage providers. For our demo, we'll be using a local image uploaded via the Firefly Upload API.
* You then provide a *masked* version of the image. That mask will be where Firefly adds it's generated content.
* You then specify the desired size. This can be any combination of a height and width between 1 and 2688 pixels.
* You can *optionally* specify a prompt to help Firefly create the filled region. If not specified, Firefly only uses the source image itself as a guide.

## Our Source and Mask Images

Our source image is below and will be uploaded using Firefly's Upload API. As this has been discussed in previous guides, we'll skip over that part, but you can find the complete source in the code listing at the bottom.

![Source image](./dog1.png)

And here is our mask:

![Masked image](./dog1_masked_inverted.png)

**Note:** The Photoshop API has a "Create Mask" endpoint that can be used to automate the creation of a mask, but at this time, the mask is created in a way that does not yet work with the Firefly Generate Fill endpoint. The image mask must be inverted. That could either be done with a second Photoshop API, the ActionJSON endpoint or instead, use one ActionJSON call to do both. This is only a temporary limitation however and will be fixed soon.

## Calling the Generative Fill API

A simple example of the request body required to use Generative Fill may be found below:

```json
{
  "numVariations": 1,
  "size": {
    "width": 2048,
    "height": 2048
  },
  "image": {
    "source": {
      "uploadId": "string"
    },
    "mask": {
      "uploadId": "string"
    }
  }
}
```

More options are available and may be found in the [REST documentation](https://bitter-tiger-28.redoc.ly/#operation/fillImage), also note that as with other endpoints, we can use cloud storage URLs instead of uploaded assets.

Here's a sample function that demonstrates this in action:

```js
async function genFill(maskId, sourceId, width, height, prompt, id, token) {

	let body = {
		numVariations:1,
		size:{
			width,
			height
		},
		prompt,
		image: {
			mask: {
				uploadId: maskId
			},
			source: {
				uploadId: sourceId
			}	
		}
	}


	let req = await fetch('https://firefly-api-enterprise-stage.adobe.io/v3/images/fill', {
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

Now let's consider an example of using this. First, we authenticate and then upload our source and mask (again, using a wrapper to Firefly's upload API, which we'll include in the full listing below). Our prompt is, "a beach at sunset". 

```js
let token = await getAccessToken(CLIENT_ID, CLIENT_SECRET);

let upload = await uploadImage('./dog1_masked_inverted.png', 'image/png', CLIENT_ID, token);
let maskedImage = upload.images[0].id;

upload = await uploadImage('./dog1.png', 'image/png', CLIENT_ID, token);
let sourceImage = upload.images[0].id;
```

Next, we'll call our function, and save the result (as before, using a utility method defined later):

```js
let result = await genFill(maskedImage, sourceImage, 2048, 2048, "a beach at sunset", CLIENT_ID, token);
let fileName = `./output/basic_getfill.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);
```

And our result:

![Generated result](./basic_getfill.jpg)

A more detailed prompt would provide better results, and remember that the masked region could be smaller as well, not the complete background. Here's the complete script containing utilities for authentication, uploading, and downloading.

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

async function genFill(maskId, sourceId, width, height, prompt, id, token) {

	let body = {
		numVariations:1,
		size:{
			width,
			height
		},
		prompt,
		image: {
			mask: {
				uploadId: maskId
			},
			source: {
				uploadId: sourceId
			}	
		}
	}


	let req = await fetch('https://firefly-api-enterprise-stage.adobe.io/v3/images/fill', {
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

let upload = await uploadImage('./dog1_masked_inverted.png', 'image/png', CLIENT_ID, token);
let maskedImage = upload.images[0].id;

upload = await uploadImage('./dog1.png', 'image/png', CLIENT_ID, token);
let sourceImage = upload.images[0].id;

let result = await genFill(maskedImage, sourceImage, 2048, 2048, "a beach at sunset", CLIENT_ID, token);
let fileName = `./output/basic_getfill.jpg`;
await downloadFile(result.outputs[0].image.url, fileName);
```

## Next Steps

For more examples of what's possible with Firefly Services, check the [API reference](https://bitter-tiger-28.redoc.ly/) for a full list of Firefly APIs.
