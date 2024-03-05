# Define our imports and variables
import dropbox
from dropbox.files import CommitInfo, WriteMode
from dropbox.sharing import SharedLinkSettings
import os 
import requests 
import time 
import sys
import json 
from slugify import slugify

ff_client_id = os.environ.get('CLIENT_ID')
ff_client_secret = os.environ.get('CLIENT_SECRET')

# The output sizes
sizes = ["1024x1024","1792x1024","1408x1024","1024x1408"]


# Define a method to get a Firefly access token and call it
def getFFAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api")
	return response.json()['access_token']


ff_access_token = getFFAccessToken(ff_client_id, ff_client_secret)
print("Got Firefly access token.")

def uploadImage(path, id, token):
	
	with open(path,'rb') as file:

		response = requests.post("https://firefly-beta.adobe.io/v2/storage/image", data=file, headers = {
			"X-API-Key":id, 
			"Authorization":f"Bearer {token}",
			"Content-Type": "image/jpeg"
		}) 
		return response.json()


origFile = uploadImage('input/product.jpg', ff_client_id, ff_access_token)
maskFile = uploadImage('input/mask.jpg', ff_client_id, ff_access_token)
origFileId = origFile['images'][0]['id']
maskFileId = maskFile['images'][0]['id']
print("Uploaded image and mask.")

# Define a method to call Firefly Generative Fill, Generative Expand and call them
def generativeFill(text, imageId, maskId, id, token):

	data = {
		"n":1,
		"prompt":text,
		"image":{
			"id":imageId
		},
		"mask":{
			"id":maskId
		}
	}

	response = requests.post("https://firefly-beta.adobe.io/v1/images/fill", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()

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

	return response.json()


prompt = "on a beach, sunset, happy vibes"

print("Generating new images for our desired sizes.")
sizeUrls = []
for size in sizes:
	
	print(f"Generating for prompt \"{prompt}\" and size \"{size}\"")
	fillResult = generativeFill(prompt, origFileId, maskFileId, ff_client_id, ff_access_token)
	expandResult = generativeExpand(fillResult["images"][0]["image"]["id"], size, ff_client_id, ff_access_token)

	imgUrl = expandResult["images"][0]["image"]["presignedUrl"]
	sizeUrls.append(imgUrl)

# Use Photoshop APIs to create a new artboard PSD
db_refresh_token = os.environ.get('DROPBOX_REFRESH_TOKEN')
db_app_key = os.environ.get('DROPBOX_APP_KEY')
db_app_secret = os.environ.get('DROPBOX_APP_SECRET')

ps_client_id = os.environ.get('PS_CLIENT_ID')
ps_client_secret = os.environ.get('PS_CLIENT_SECRET')

def dropbox_connect(app_key, app_secret, refresh_token):
	try:
		dbx = dropbox.Dropbox(app_key=app_key, app_secret=app_secret, oauth2_refresh_token=refresh_token)
	except AuthError as e:
		print('Error connecting to Dropbox with access token: ' + str(e))
	return dbx

def dropbox_get_read_link(path):
	link = dbx.sharing_create_shared_link(path).url
	return link.replace("dl=0","dl=1")

def dropbox_get_upload_link(path):
	commit_info = CommitInfo(path=path, mode=WriteMode.overwrite)
	return dbx.files_get_temporary_upload_link(commit_info).link

def getPhotoshopAccessToken(id, secret):

	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v2?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID")
	return response.json()["access_token"]

def createPSD(psd, sizes, urls, outputs, id, token):
	
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
		data["options"]["layers"].append({
			"name":f"{width}x{height}-product",
			"edit":{},
			"input":{
				"storage":"external", 
				"href":urls[x]
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



dbx = dropbox_connect(db_app_key, db_app_secret, db_refresh_token)
psdOnDropbox = dropbox_get_read_link("/FFDemo/genfill-banner-template.psd")

outputUrls = []
psToken = getPhotoshopAccessToken(ps_client_id, ps_client_secret)
for size in sizes:
	width, height = size.split('x')
	outputUrls.append(dropbox_get_upload_link(f"/FFDemo/Final/{width}x{height}.jpg"))

result = createPSD(psdOnDropbox, sizes, sizeUrls, outputUrls, ps_client_id, psToken)
print("The Photoshop API job is being run...")
finalResult=pollPSDJob(result, ps_client_id, psToken)
print("Done")	