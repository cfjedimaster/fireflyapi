# Firefly/Photoshop Automation Demo

The Python code in this folder illustrates the power of connecting multiple different Firefly and Photoshop APIs calls together to create a powerful workflow. At a high level, this workflow will:

* Given a set of text prompts...
* A set of desired sizes...
* A list of languages and translations...
* A reference image used in generative calls
* And a set of products

Will use Firefly to generate a new image based on each prompt and the reference image, resize it for each desired size. It will then place the product, with it's original background removed, into the Firefly generated content, and finally use a PSD template to output multiple images with the proper text based on a translation.

As an example, given:

10 prompts
5 products
4 sizes
3 translations

The result will be 10x5x4x3, or **600** unique images. 

Let's now look into the flow in a detailed manner. (Note - the code in its current form was optimized for demonstration in a video. Later versions will be properly organized.) 

# Requirements

In order to use the demo code, you must have the following credentials:

* Valid Firefly API credentials, defined in environment variables `CLIENT_ID` and `CLIENT_SECRET`
* Valid Photoshop API credentials defined in environment variables `PS_CLIENT_ID` and `PS_CLIENT_SECRET`
* Dropbox credentials defined in environment variables `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`. Note, getting the refresh token for Dropbox is silly difficult. This [post](https://stackoverflow.com/questions/70641660/how-do-you-get-and-use-a-refresh-token-for-the-dropbox-api-python-3-x) walks you through the process.

You will also need to create a Dropbox folder, `FFDemo2`. Obviously, that could be dynamic in a later version of the demo. In this folder, you must have the Photoshop PSD file, `genfill-banner-template-text-comp.psd`. In order to make the workflow a bit simpler, we start off with this stored in cloud storage so our code doesn't have to handle uploading it. And in a 'real world' use case, the PSD would be stored as such.

## Defining Inputs

As mentioned above, the workflow is driven by prompts, products, sizes, and translations. Here's how they are defined.

* Prompts are loaded from `prompts.txt`, which each line being one prompt. 
* Products are a directory of product images found in `input/products`. 
* Sizes are defined in code: `sizes = ["1024x1024","1792x1024","1408x1024","1024x1408"]` Note that Firefly APIs take sizes in separate `width` and `height` attributes but I wanted to make it simpler to use in code. 
* Translations are loaded from `translations.txt`, with a line per translation. Each line consists of a language code and translated text. For example: `fr,Fantastique!`
* The reference image may be found in `input/sourc_image.jpg`. 

## The Process

Again, please make note of what was mentioned above. The organization of this file is optimized for a video asset and will change in the future.

The code begins by defining various variables (credentials, prompts, products, and so forth). 

Next, for each product, we upload the product to Dropbox so that the Photoshop API can access it. These are stored in `/FFDemo2/input`. For each uploaded product, we call the [Remove Background](https://developer.adobe.com/photoshop/photoshop-api-docs/api/#tag/Photoshop/operation/cutout) API on the image. The result is stored in `FFDemo2/knockout`. Finally, we create a Dropbox readable link for the result for later use. 

Now the script moves on to Firefly. It begins by using the [Upload](https://developer.adobe.com/firefly-beta/api/#operation/v2/storage/image) API to store the reference image.

At this point, the script begins its loop. 

For each **prompt**, we first use the Firefly [Text to Image](https://developer.adobe.com/firefly-beta/api/#operation/v2/images/generate) API with the prompt and reference image. 

Next, for each **size**, we use the Firefly [Generative Expand](https://developer.adobe.com/firefly-beta/api/#operation/v1/images/expand) API to create a resized version of the initially generated asset. (Currently, this file is also stored locally for video demonstration purposes.) 

Then, for each **language** and for each **product**, and for each **size**, we create a set of output URLs, basically Dropbox links that will let us save results, and put them into an array.

This is all passed to the Photoshop [Apply PSD Edits](https://developer.adobe.com/photoshop/photoshop-api-docs/api/#tag/Photoshop/operation/documentOperations) API. This call includes:

* A reference to the original PSD, that includes spots for images, products, and text
* The Firefly-generated images
* The text for the language.

The result is an image in `FFDemo2/output` named by the language, the prompt, the size, and a current date value in seconds. 

## History

2/21/2024: Initial creation of this document.