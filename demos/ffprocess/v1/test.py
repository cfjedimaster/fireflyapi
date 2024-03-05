import dropbox
from dropbox.files import CommitInfo, WriteMode
from dropbox.sharing import SharedLinkSettings
import os 
import requests 
import time 
import sys
import json 

ff_client_id = os.environ.get('CLIENT_ID')
ff_client_secret = os.environ.get('CLIENT_SECRET')

db_refresh_token = os.environ.get('DROPBOX_REFRESH_TOKEN')
db_app_key = os.environ.get('DROPBOX_APP_KEY')
db_app_secret = os.environ.get('DROPBOX_APP_SECRET')

ps_client_id = os.environ.get('PS_CLIENT_ID')
ps_client_secret = os.environ.get('PS_CLIENT_SECRET')

# Load and defined an actionJSON command set for use later.
f = open('action.json')
actionJSON = json.load(f)
f.close()


def dropbox_connect(app_key, app_secret, refresh_token):
	try:
		dbx = dropbox.Dropbox(app_key=app_key, app_secret=app_secret, oauth2_refresh_token=refresh_token)
	except AuthError as e:
		print('Error connecting to Dropbox with access token: ' + str(e))
	return dbx

def dropbox_list_files(path):

	files = dbx.files_list_folder(path).entries
	files_list = []

	for file in files:
		files_list.append(file.path_display)

	return files_list

def dropbox_get_read_link(path):
	#settings = SharedLinkSettings(allow_download=True)
	#foo = dbx.sharing_create_shared_link_with_settings(path, settings)
	#print(foo)
	#return foo
	
	# Ray, for now I think we can 'hack' the link by replacing dl=0 with dl=1
	# I want to revisit this
	link = dbx.sharing_create_shared_link(path).url
	return link.replace("dl=0","dl=1")


def dropbox_get_upload_link(path):
	commit_info = CommitInfo(path=path, mode=WriteMode.overwrite)
	return dbx.files_get_temporary_upload_link(commit_info).link

# https://www.dropboxforum.com/t5/Dropbox-API-Support-Feedback/Downloading-a-file-from-using-the-Python-Dropbox-API/td-p/230194
def dropbox_download(f):
	metadata, file = dbx.files_download(f)
	myfile = f.split('/')[-1]
	out = open('temp/' + myfile, 'wb')
	out.write(file.content)
	out.close()

def dropbox_upload(f):
		print('upload', f)
		newName = '/FFDemo/output/' + f.split('/')[-1]
		with open(f,'rb') as file:
			dbx.files_upload(file.read(), newName)
			
def getPhotoshopAccessToken(id, secret):

	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v2?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID")
	return response.json()["access_token"]

def createMaskJob(input, output, id, token):
	
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

	response = requests.post(f"https://image.adobe.io/sensei/mask", headers = {"Authorization": f"Bearer {token}", "x-api-key": id }, json=data)
	return response.json()

def createActionJSONJob(input, output, json, id, token):
	data = {
		"inputs": [{
			"href":input, 
			"storage":"dropbox"
		}],
		"options":{
			"actionJSON":json
		},
		"outputs":[{
			"href":output, 
			"storage":"dropbox",
			"type": "image/jpeg"
		}]
	}

	response = requests.post(f"https://image.adobe.io/pie/psdService/actionJSON", headers = {"Authorization": f"Bearer {token}", "x-api-key": id }, json=data)
	return response.json()

# This is used to poll for our mask job, but actionjson is different so we made another version
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

def pollAJJob(job, id, token):
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

def getFFAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api")
	return response.json()['access_token']

def uploadImage(path, id, token):
	
	with open(path,'rb') as file:

		response = requests.post("https://firefly-beta.adobe.io/v2/storage/image", data=file, headers = {
			"X-API-Key":id, 
			"Authorization":f"Bearer {token}",
			"Content-Type": "image/jpeg"
		}) 
		return response.json()

def generativeFill(text, imageId, maskId, id, token):

	data = {
		"n":1,
		"prompt":text,
		"size":{
			"width":1792,
			"height":1024
		},
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

######################################################################


dbx = dropbox_connect(db_app_key, db_app_secret, db_refresh_token)
print("Connected to Dropbox")

files = dropbox_list_files("/FFDemo/input")
print(f"We have {len(files)} to process.")


input = dropbox_get_read_link(files[0])
print(f"Generated a read URL for the file: {input}")

# Generate a temp place for the output based on input filename
filename = files[0].split('/')[-1]
uploadfilename = "/FFDemo/temp/masked_" + filename
upload = dropbox_get_upload_link(uploadfilename)
print("Generated an upload URL to store the image mask.")

ps_access_token = getPhotoshopAccessToken(ps_client_id, ps_client_secret)
print("Got a Photoshop API access token.")

job = createMaskJob(input, upload, ps_client_id, ps_access_token)
print("Image Mask job created.")

# for now, we assume success
print("Polling the job...")
result = pollJob(job, ps_client_id, ps_access_token)

if result["status"] == "failed":
	print("PS Job failed.")
	print(json.dumps(result,indent=2))
	sys.exit()

print("Done creating the mask.")

# Now flip the mask
masklink = dropbox_get_read_link(uploadfilename) 
uploadinvertedfilename = "/FFDemo/temp/masked_inverted_" + filename
uploadinverted = dropbox_get_upload_link(uploadinvertedfilename)

job = createActionJSONJob(masklink, uploadinverted, actionJSON, ps_client_id, ps_access_token)
result = pollAJJob(job, ps_client_id, ps_access_token)
if result["outputs"][0]["status"] == "failed":
	print("PS Action JSON Job failed.")
	print(json.dumps(result,indent=2))
	sys.exit()

print("Done creating the inverted mask.")

# Connect to FF
ff_access_token = getFFAccessToken(ff_client_id, ff_client_secret)
print("Got my Firefly access token.")

# Ok, now we need to upload the original image and the mask.
# First, download from Dropbox
dropbox_download(files[0])
dropbox_download(uploadinvertedfilename)

origFile = uploadImage('temp/' + filename, ff_client_id, ff_access_token)
maskFile = uploadImage('temp/masked_inverted_' + filename, ff_client_id, ff_access_token)
origFileId = origFile['images'][0]['id']
maskFileId = maskFile['images'][0]['id']
print("We've downloaded our files from Dropbox and uploaded to Firefly.")

fillResult = generativeFill("on a beach, sunset, happy vibes", origFileId, maskFileId, ff_client_id, ff_access_token)
print("Generated image is created.")
#print(json.dumps(fillResult,indent=2))

toSendToDropbox = []
for resp in fillResult["images"]:
	# todo, make new file based on slug of prompt + seed
	newName = "temp/" + str(resp["seed"]) + ".jpg"
	imgUrl = resp["image"]["presignedUrl"]
	print(f"Saving {newName} to temporary storage")
	with open(newName,'wb') as output:
		bits = requests.get(imgUrl, stream=True).content
		output.write(bits)

	dropbox_upload(newName)

# Then, upload to Dropbox output
print("Done")
