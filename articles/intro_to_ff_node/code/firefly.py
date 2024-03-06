import os 
import requests 
import json 

#Set our creds based on environment variables.
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')

def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api,ff_apis")
	return response.json()["access_token"]

token = getAccessToken(CLIENT_ID, CLIENT_SECRET)

def textToImage(text, id, token):

	data = {
		"prompt":text,
		"n":4,
	}


	response = requests.post("https://firefly-api.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()


prompt = "a cat dancing on a rainbow"
result = textToImage(prompt, CLIENT_ID, token)
print(json.dumps(result, indent=True))

def downloadFile(url, filePath):
	with open(filePath,'wb') as output:
		bits = requests.get(url, stream=True).content
		output.write(bits)

for output in result["outputs"]:
	fileName = f'./{output["seed"]}.jpg';
	downloadFile(output["image"]["presignedUrl"], fileName);
