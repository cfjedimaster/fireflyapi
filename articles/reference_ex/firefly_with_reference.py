import os 
import requests 

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

def uploadImage(path, id, token):
	with open(path,'rb') as file:

		response = requests.post("https://firefly-api.adobe.io/v2/storage/image", data=file, headers = {
			"X-API-Key":id, 
			"Authorization":f"Bearer {token}",
			"Content-Type": "image/jpeg"
		}) 

	# Simplify the return a bit... 
	return response.json()["images"][0]["id"]
	
def textToImageWithReference(text, reference, id, token):

	data = {
		"prompt":text
	}

	if reference != "":
		data["styles"] = {
			"referenceImage": { "id":reference } 
		}

	response = requests.post("https://firefly-api.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()


token = getAccessToken(CLIENT_ID, CLIENT_SECRET)

uploadResult = uploadImage("./source_image.jpg", CLIENT_ID, token)
print("Uploaded reference image.")

prompt = "a cat sleeping in a sunbeam"

result = textToImageWithReference(prompt, "", CLIENT_ID, token)

fileName = './without.jpg'
downloadFile(result["outputs"][0]["image"]["presignedUrl"], fileName)
print("Downloaded example WITHOUT a reference.")

result = textToImageWithReference(prompt, uploadResult, CLIENT_ID, token)

fileName = './with.jpg'
downloadFile(result["outputs"][0]["image"]["presignedUrl"], fileName)
print("Downloaded example WITH a reference.")

