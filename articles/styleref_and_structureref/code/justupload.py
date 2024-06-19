import os 
import requests 
import json 

#Set our creds based on environment variables.
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')

def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1-stg1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()["access_token"]

def uploadImage(filePath, fileType, id, token):
	with open(filePath,'rb') as file:

		response = requests.post("https://firefly-api-enterprise-stage.adobe.io/v2/storage/image", data=file, headers = {
			"X-API-Key":id, 
			"Authorization":f"Bearer {token}",
			"Content-Type": fileType
		}) 

		return response.json()
	
token = getAccessToken(CLIENT_ID, CLIENT_SECRET)

upload = uploadImage('./source_image.jpg', 'image/jpeg', CLIENT_ID, token)
print(upload)
