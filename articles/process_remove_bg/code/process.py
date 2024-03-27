import os
import requests 
import dropbox
import time 
from dropbox.files import CommitInfo, WriteMode

ff_client_id = os.environ.get('CLIENT_ID')
ff_client_secret = os.environ.get('CLIENT_SECRET')
db_refresh_token = os.environ.get('DROPBOX_REFRESH_TOKEN')
db_app_key = os.environ.get('DROPBOX_APP_KEY')
db_app_secret = os.environ.get('DROPBOX_APP_SECRET')

# Base folder to use in Dropbox 
db_base_folder = "/RemoveBGProcess/"

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

def dropbox_get_input_files():
	return dbx.files_list_folder(f'{db_base_folder}input').entries

def getFFAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()['access_token']

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
		
# Connect to Firefly Services and Dropbox
dbx = dropbox_connect(db_app_key, db_app_secret, db_refresh_token)
ff_access_token = getFFAccessToken(ff_client_id, ff_client_secret)

# Get a list of input files to process
input_files = dropbox_get_input_files()

print(f"There are {len(input_files)} file(s) to process.")

for file in input_files:

	print(f"Working on {file.name}")
	# We need two links, a readable for input, and an writeable for output
	read_link = dropbox_get_read_link(file.path_display)
	write_link = dropbox_get_upload_link(f"{db_base_folder}output/{file.name}")

	# Cool, now, kick off the remove BG job
	job = createRemoveBackgroundJob(read_link, write_link, ff_client_id, ff_access_token)

	# Poll and wait for it to finish
	pollJob(job, ff_client_id, ff_access_token)

print("All done.")