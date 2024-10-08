import os
import requests 
import json 
import sys 
import dropbox
from dropbox.files import CommitInfo, WriteMode
import time 
from slugify import slugify

ff_client_id = os.environ.get('CLIENT_ID')
ff_client_secret = os.environ.get('CLIENT_SECRET')
ps_client_id = os.environ.get('PS_CLIENT_ID')
ps_client_secret = os.environ.get('PS_CLIENT_SECRET')
db_refresh_token = os.environ.get('DROPBOX_REFRESH_TOKEN')
db_app_key = os.environ.get('DROPBOX_APP_KEY')
db_app_secret = os.environ.get('DROPBOX_APP_SECRET')

# The output sizes
sizes = ["1024x1024","1792x1024","1408x1024","1024x1408"]

# Prompts
prompts = [line.rstrip() for line in open('input/prompts.txt','r')]

# Languages and translations
langs = [line.rstrip() for line in open('input/translations.txt','r')]
languages = []
for l in langs:
	language,text = l.split(',')
	languages.append({"language":language, "text":text})

# Products
products = os.listdir("input/products")

# Step One - Auth with Photoshop

def getPhotoshopAccessToken(id, secret):

	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v2?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID")
	return response.json()["access_token"]

def createKOJob(input, output, id, token):
	
	data = {
		"input": {
			"href":input, 
			"storage":"dropbox"
		},
		"output":{
			"href":output, 
			"storage":"dropbox"
		}
	}
	response = requests.post(f"https://image.adobe.io/sensei/cutout", headers = {"Authorization": f"Bearer {token}", "x-api-key": id }, json=data)
	return response.json()

def pollJob(job, id, token):
	jobUrl = job["_links"]["self"]["href"]
	status = "" 
	while status != 'succeeded' and status != 'failed':

		response = requests.get(jobUrl, headers = {"Authorization": f"Bearer {token}", "x-api-key": id })
		json_response = response.json()
		status = json_response["status"]
		#print(json.dumps(json_response,indent=2))
		#print(f"Current status: {status }")
		if status != 'succeeded' and status != 'failed':
			time.sleep(3)
		else:
			return json_response

def pollPSDJob(job, id, token):
	jobUrl = job["_links"]["self"]["href"]
	status = "" 
	while status != 'succeeded' and status != 'failed':

		response = requests.get(jobUrl, headers = {"Authorization": f"Bearer {token}", "x-api-key": id })
		json_response = response.json()
		status = json_response["outputs"][0]["status"]
		if status != 'succeeded' and status != 'failed':
			time.sleep(3)
		else:
			return json_response

ps_access_token = getPhotoshopAccessToken(ps_client_id, ps_client_secret)

# Step Two - for each product, generate one w/o the background

# First, upload them to Dropbox for temp storage
def dropbox_connect(app_key, app_secret, refresh_token):
	try:
		dbx = dropbox.Dropbox(app_key=app_key, app_secret=app_secret, oauth2_refresh_token=refresh_token)
	except AuthError as e:
		print('Error connecting to Dropbox with access token: ' + str(e))
	return dbx

def dropbox_upload(f, folder):
		# hard coded path here, to revisit
		newName = '/FFDemo2/' + folder + '/' + f.split('/')[-1]
		with open(f,'rb') as file:
			dbx.files_upload(file.read(), newName)

def dropbox_get_read_link(path):
	link = dbx.sharing_create_shared_link(path).url
	return link.replace("dl=0","dl=1")

def dropbox_get_upload_link(path):
	commit_info = CommitInfo(path=path, mode=WriteMode.overwrite)
	return dbx.files_get_temporary_upload_link(commit_info).link

dbx = dropbox_connect(db_app_key, db_app_secret, db_refresh_token)

# I handle uploading our products to Dropbox so we can later call the PS API with em.
koProducts = {}
for product in products:
	
	# First, upload the source
	dropbox_upload(f"input/products/{product}", "input")

	# Get a readable link for that
	readableLink = dropbox_get_read_link(f"/FFDemo2/input/{product}")

	# Make a link to upload the result 
	writableLink = dropbox_get_upload_link(f"/FFDemo2/knockout/{product}")

	koJob = createKOJob(readableLink, writableLink, ps_client_id, ps_access_token)
	result = pollJob(koJob, ps_client_id, ps_access_token)

	readableLink = dropbox_get_read_link(f"/FFDemo2/knockout/{product}")
	koProducts[product] = readableLink
	# For now, we assume ok


# Step Three - Auth with Firefly

def getFFAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api")
	return response.json()['access_token']


ff_access_token = getFFAccessToken(ff_client_id, ff_client_secret)
print("Got Firefly access token.")

# Step Four - Upload the reference image

def uploadImage(path, id, token):
	
	with open(path,'rb') as file:

		response = requests.post("https://firefly-beta.adobe.io/v2/storage/image", data=file, headers = {
			"X-API-Key":id, 
			"Authorization":f"Bearer {token}",
			"Content-Type": "image/jpeg"
		}) 

		# Simplify the return a bit... 
		return response.json()["images"][0]["id"]

referenceImage = uploadImage('input/source_image.jpg', ff_client_id, ff_access_token)
print("Reference image uploaded.")


def textToImage(text, imageId, id, token):

	data = {
		"n":1,
		"prompt":text,
		"contentClass":"photo",
		"size":{
			"width":2048,
			"height":2048
		},
		"styles":{
			"referenceImage":{
				"id":imageId
			}
		}
	}

	response = requests.post("https://firefly-beta.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()["outputs"][0]["image"]["id"]

def generativeExpand(imageId, size, id, token):

	width, height = size.split('x')

	data = {
		"n":1,
		"image":{
			"id":imageId
		},
		"size":{
			"width":width, 
			"height":height
		}
	}

	response = requests.post("https://firefly-beta.adobe.io/v1/images/expand", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()["images"][0]["image"]["presignedUrl"]

def createPSD(psd, koProduct, sizes, sizeUrls, outputs, text, id, token):

	data = {
		"inputs": [{
			"href":psd, 
			"storage":"dropbox"
		}],
		"options":{
			"layers":[
			]
		},
		"outputs":[]
	}

	for (x,size) in enumerate(sizes):
		width, height = size.split('x')
		url = sizeUrls[size]
		data["options"]["layers"].append({
			"name":f"{width}x{height}-text",
			"edit":{},
			"text":{
				"content":text
			}
		})

		data["options"]["layers"].append({
			"name":f"{width}x{height}-background",
			"edit":{},
			"input":{
				"storage":"external", 
				"href":url
			}
		})

		data["options"]["layers"].append({
			"name":f"{width}x{height}-product",
			"edit":{},
			"input":{
				"storage":"external", 
				"href":koProduct
			}
		})

		data["outputs"].append({
			"href":outputs[x], 
			"storage":"dropbox",
			"type":"image/jpeg",
			"trimToCanvas":True,
			"layers":[{
				"name":f"{width}x{height}"
			}]
	
		})

	#print(json.dumps(data, indent=2))
	response = requests.post(f"https://image.adobe.io/pie/psdService/documentOperations", headers = {"Authorization": f"Bearer {token}", "x-api-key": id }, json=data)
	return response.json()

theTime = time.time()
for prompt in prompts:
	
	# Step Five - For each prompt, generate a new background using prompt and reference
	print(f"Generating an image with prompt: {prompt}.")
	newImage = textToImage(prompt, referenceImage, ff_client_id, ff_access_token)

	# I store a key from size to the image
	sizeImages = {}

	# I'm using later when generating final results.
	psdOnDropbox = dropbox_get_read_link("/FFDemo2/genfill-banner-template-text-comp.psd")

	for size in sizes:
		# Step Siz - For each size, generate an expanded background
		print(f"Generating an expanded one at size {size}")
		expandedBackground = generativeExpand(newImage, size, ff_client_id, ff_access_token)
		sizeImages[size] = expandedBackground
		# Save a copy as well

		newName = f"backgroundtemp/{slugify(prompt)}-{size}-{theTime}.jpg"
		with open(newName,'wb') as output:
			bits = requests.get(expandedBackground, stream=True).content
			output.write(bits)


	for lang in languages:
		
		for product in products:
			
			print(f'Working with language {lang["language"]} and {product}')

			outputUrls = []

			for size in sizes:
				width, height = size.split('x')
				outputUrls.append(dropbox_get_upload_link(f"/FFDemo2/output/{lang['language']}-{slugify(prompt)}-{width}x{height}-{theTime}.jpg"))

			result = createPSD(psdOnDropbox, koProducts[product], sizes, sizeImages, outputUrls, lang["text"], ps_client_id, ps_access_token)
			print("The Photoshop API job is being run...")
			finalResult=pollPSDJob(result, ps_client_id, ps_access_token)

print("Done.")