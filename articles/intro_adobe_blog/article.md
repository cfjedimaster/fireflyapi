# Getting Started with Firefly Services
'
This year at Adobe Summit, we announced [Firefly Services](https://www.adobe.com/creativecloud/business/enterprise/firefly.html), a suite of APIs and services that encompass the capabilities of the [Adobe Firefly](https://firefly.adobe.com) website as well as the previously announced Photoshop and Lightroom APIs. These APIs all enable powerful creative workflows with a simple-to-use REST-based API. In this tutorial, we'll walk you through the process of creating your first implementation of the APIs. Let's get started!

## Basics

First, some quick basics:

1) Authentication is required and consists of a client ID and secret value, much like the Photoshop API and Acrobat Services. You exchange this for an access token that can be used for subsequent calls.

2) The Firefly APIs, when working with media, require you to upload the resource to an API endpoint first. This is different from the Photoshop API which requires cloud storage. This will be made more consistent in the future.

3) Results are provided via a cloud storage URL that you can download, or use in further calls.

4) This is all done via REST calls in whatever language, or low-code platform, you wish. 

## Features

Currently, the following endpoints are supported (and again, Firefly "Services" refers to the gen AI stuff, Photoshop, Lightroom, and more, I'm focusing on the generative stuff for this post):

* Upload - used to upload images that are referenced by other methods
* Text to Image - what you see in the [website](https://firefly.adobe.com) - you take a prompt and get images. Like the website, there's a crap ton of tuning options, including using a reference image which would make use of the upload method described above. 
* Generative Expand - take an image and use AI to expand it. Basically, it expands an image with what it thinks makes sense around the existing image. Can use a prompt to help control what's added.
* Generative Fill - same idea, but fills in an area instead. Can also take a prompt.

Check out the [reference](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/api/upload_image/) for full docs.

## Building a Demo

First, grab your credentials, in this case from the environment:

```js
/* Set our creds based on environment variables.
*/
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
```

Second, exchange this for an access token. This is very similar to all the other Adobe IDs with the main exception being the `scope`:

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

Now let's make an image. The [text to image](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/api/image_generation/) API has a *lot* of options, but you can get by with the minimum of just a prompt. We also want to get a bunch of options so we'll change the default limit of 1 to 4:

```json
{
    "prompt":"a stack of papers on top of a desk",
    "n":4
}
```

A basic wrapper function could look like so:

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

This returns, if everything went well, a JSON packet containing links to the results. Here's an example of a result when one image is requested:

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
					"seed": 1613067352,
					"image": {
							"id": "03a221df-98a2-4597-ac2d-3dc1c9b42507",
							"presignedUrl": "https://pre-signed-firefly-prod.s3.amazonaws.com/images/03a221df-98a2-4597-ac2d-3dc1c9b42507?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIARDA3TX66LLPDOIWV%2F20240326%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20240326T192500Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=84dc28624662af7215de720514ee803eed404df2cf10de803b38c878e0ff62c7"
					}
			}
	]
}
```

And that's it. You then just need to write some code to download the bits:

```js
async function downloadFile(url, filePath) {
    let res = await fetch(url);
    const body = Readable.fromWeb(res.body);
    const download_write_stream = fs.createWriteStream(filePath);
    return await finished(body.pipe(download_write_stream));
}
```

Here's one example from the prompt used above, and remember, there are numerous options that could have been tweaked, and the prompt could have been more descriptive.

![Sample Result](./ex1.jpg)

## Getting Started

Most of the code above was taken from the *excellent* [intro guide](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/how-tos/create-your-first-ff-application/) from the Firefly docs that includes both a Node and Python version. To learn more, check out the [developer homepage](https://developer.adobe.com/firefly-services/) for Firefly Services as well. For organization that wish to work with the services, please reach out to your Adobe account representative. 