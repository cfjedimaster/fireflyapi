import os 
import requests 
import json
import sys
from slugify import slugify

CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')

def getAccessToken(id, secret):
	response = requests.post(f"https://ims-na1.adobelogin.com/ims/token/v3?client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=openid,AdobeID,firefly_enterprise,firefly_api")
	return response.json()


def uploadImage(path, id, token):
	
	with open(path,'rb') as file:

		response = requests.post("https://firefly-beta.adobe.io/v2/storage/image", data=file, headers = {
			"X-API-Key":id, 
			"Authorization":f"Bearer {token}",
			"Content-Type": "image/jpeg"
		}) 
		return response.json()


def generativeExpand(image, num, size, prompt, id, token):

	width, height = size.split("x")

	data = {
		"n":3,
		"prompt":prompt,
		"contentClass":"photo",
		"size":{
			"width":width,
			"height":height
		},
		"image":{
				"id":imageId
		}
	}

	response = requests.post("https://firefly-beta.adobe.io/v1/images/expand", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 
	
	return response.json()

accessToken = getAccessToken(CLIENT_ID, CLIENT_SECRET)['access_token']

image = uploadImage("input/cat_godzilla.jpg", CLIENT_ID, accessToken)
imageId = image["images"][0]["id"]

response = generativeExpand(imageId, 1, "1792x1024", "dogs flying in airplanes", CLIENT_ID, accessToken)
#print(json.dumps(response, indent=2))

for resp in response["images"]:
	# todo, make new file based on slug of prompt + seed
	newName = "output/" + "expandexample" + "-" + str(resp["seed"]) + ".jpg"
	imgUrl = resp["image"]["presignedUrl"]
	print(f"Saving {newName}")
	with open(newName,'wb') as output:
		bits = requests.get(imgUrl, stream=True).content
		output.write(bits)

print("\nDone")
