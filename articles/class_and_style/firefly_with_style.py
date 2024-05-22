import os 
import requests 
import json 

#Set our creds based on environment variables.
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')

def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()["access_token"]

def downloadFile(url, filePath):
	with open(filePath,'wb') as output:
		bits = requests.get(url, stream=True).content
		output.write(bits)

def textToImageWithStyle(text, style, id, token):

	data = {
		"prompt":text,
		"contentClass":"art",
		"styles":{
			"presets":[style]
		}
	}


	response = requests.post("https://firefly-api.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()


token = getAccessToken(CLIENT_ID, CLIENT_SECRET)

prompt = "a cat sleeping in a sunbeam"

styles = ["pastel_color","golden","antique_photo","simple"]

for style in styles:
	
	result = textToImageWithStyle(prompt, style, CLIENT_ID, token)
	print(f"Generated style: {style}")

	fileName = f'./{result["outputs"][0]["seed"]}_{style}.jpg'
	downloadFile(result["outputs"][0]["image"]["presignedUrl"], fileName)
