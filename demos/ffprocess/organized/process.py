import os
import requests 
import dropbox
from dropbox.files import CommitInfo, WriteMode
import time 
from slugify import slugify

ff_client_id = os.environ.get('CLIENT_ID')
ff_client_secret = os.environ.get('CLIENT_SECRET')
db_refresh_token = os.environ.get('DROPBOX_REFRESH_TOKEN')
db_app_key = os.environ.get('DROPBOX_APP_KEY')
db_app_secret = os.environ.get('DROPBOX_APP_SECRET')

# Base folder to use in Dropbox 
db_base_folder = "/FFProcess/"

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

# Products sources from a set of images.
products = os.listdir("input/products")

def createRemoveBackgroundJob(input, output, id, token):
	
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

		if "status" in json_response:
			status = json_response["status"]
		elif "status" in json_response["outputs"][0]:
			status = json_response["outputs"][0]["status"]
			
		if status != 'succeeded' and status != 'failed':
			time.sleep(3)
		else:
			return json_response

def dropbox_connect(app_key, app_secret, refresh_token):
	try:
		dbx = dropbox.Dropbox(app_key=app_key, app_secret=app_secret, oauth2_refresh_token=refresh_token)
	except AuthError as e:
		print('Error connecting to Dropbox with access token: ' + str(e))
	return dbx

def dropbox_upload(f, folder):
		newName = folder + '/' + f.split('/')[-1]
		with open(f,'rb') as file:
			dbx.files_upload(file.read(), newName)

def dropbox_get_read_link(path):
	link = dbx.sharing_create_shared_link(path).url
	return link.replace("dl=0","dl=1")

def dropbox_get_upload_link(path):
	commit_info = CommitInfo(path=path, mode=WriteMode.overwrite)
	return dbx.files_get_temporary_upload_link(commit_info).link


def getFFAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()['access_token']

def createOutput(psd, koProduct, sizes, sizeUrls, outputs, text, id, token):

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

	response = requests.post(f"https://image.adobe.io/pie/psdService/documentOperations", headers = {"Authorization": f"Bearer {token}", "x-api-key": id }, json=data)
	return response.json()

def uploadImage(path, id, token):
	
	with open(path,'rb') as file:

		response = requests.post("https://firefly-api.adobe.io/v2/storage/image", data=file, headers = {
			"X-API-Key":id, 
			"Authorization":f"Bearer {token}",
			"Content-Type": "image/jpeg"
		}) 

		# Simplify the return a bit... 
		return response.json()["images"][0]["id"]


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

	response = requests.post("https://firefly-api.adobe.io/v2/images/generate", json=data, headers = {
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

	response = requests.post("https://firefly-api.adobe.io/v1/images/expand", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()["images"][0]["image"]["presignedUrl"]


# Connect to Firefly Services and Dropbox
dbx = dropbox_connect(db_app_key, db_app_secret, db_refresh_token)
ff_access_token = getFFAccessToken(ff_client_id, ff_client_secret)
print("Connected to Firefly and Dropbox APIs.")

referenceImage = uploadImage('input/source_image.jpg', ff_client_id, ff_access_token)
print("Reference image uploaded.")

# We use this to remember where are product images w/ the backgrounds are stored.
rbProducts = {}
for product in products:
	
	# First, upload the source
	dropbox_upload(f"input/products/{product}", f"{db_base_folder}input")

	# Get a readable link for that
	readableLink = dropbox_get_read_link(f"{db_base_folder}input/{product}")

	# Make a link to upload the result 
	writableLink = dropbox_get_upload_link(f"{db_base_folder}knockout/{product}")

	rbJob = createRemoveBackgroundJob(readableLink, writableLink, ff_client_id, ff_access_token)
	result = pollJob(rbJob, ff_client_id, ff_access_token)

	readableLink = dropbox_get_read_link(f"{db_base_folder}knockout/{product}")
	rbProducts[product] = readableLink
	# For now, we assume ok


theTime = time.time()
for prompt in prompts:
	
	# For each prompt, generate a new background using prompt and reference
	print(f"Generating an image with prompt: {prompt}.")
	newImage = textToImage(prompt, referenceImage, ff_client_id, ff_access_token)

	# I store a key from size to the image
	sizeImages = {}

	for size in sizes:
		# For each size, generate an expanded background
		print(f"Generating an expanded one at size {size}")
		expandedBackground = generativeExpand(newImage, size, ff_client_id, ff_access_token)
		sizeImages[size] = expandedBackground


	# I'm using this later when generating final results.
	psdOnDropbox = dropbox_get_read_link(f"{db_base_folder}genfill-banner-template-text-comp.psd")

	for lang in languages:
		
		for product in products:
			
			print(f'Working with language {lang["language"]} and {product}')

			outputUrls = []

			for size in sizes:
				width, height = size.split('x')
				outputUrls.append(dropbox_get_upload_link(f"{db_base_folder}output/{lang['language']}-{slugify(prompt)}-{slugify(product)}-{width}x{height}-{theTime}.jpg"))

			result = createOutput(psdOnDropbox, rbProducts[product], sizes, sizeImages, outputUrls, lang["text"], ff_client_id, ff_access_token)
			print("The Photoshop API job is being run...")
			finalResult=pollJob(result, ff_client_id, ff_access_token)

print("Done.")