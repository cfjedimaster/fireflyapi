# This collects some stuff from my other scripts, but is meant to be my main CLI tool.

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

def textToImage(text, num, styles, id, token):

	data = {
		"n":num,
		"prompt":text,
		"contentClass":"photo",
		"size":{
			"width":2048,
			"height":2048
		}
	}

	if styles:
		data["styles"] = {}
		data["styles"]["presets"] = styles

	response = requests.post("https://firefly-beta.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()


if len(sys.argv) < 2:
	print("Usage: python3 test2.py \"prompt\" numberOfImages (defaults to 1) styleIds (comma separated list) ")
	sys.exit()

prompt = sys.argv[1]

if len(sys.argv) >= 3:
	num = sys.argv[2]
else:
	num = 1

if len(sys.argv) >= 4:
	styles = sys.argv[3].split(',')
else:
	styles = None

print(f"Generating {num} image(s) based on prompt: {prompt}")

accessToken = getAccessToken(CLIENT_ID, CLIENT_SECRET)['access_token'];

if styles:

	# So you CAN pass an array of styles, but I don't know how it's supposed to work
	# when passing different styles, so we're going to do one at  atime
	for style in styles:
		print(f"Generating for style {style}")
		response = textToImage(prompt, num, [style] , CLIENT_ID, accessToken)

		# So, assume a good response, and loop over response.outputs
		for resp in response["outputs"]:
			# todo, make new file based on slug of prompt + seed
			newName = "output/" + slugify(prompt) + "-" + style + "-" + str(resp["seed"]) + ".jpg"
			imgUrl = resp["image"]["presignedUrl"]
			print(f"Saving {newName}")
			with open(newName,'wb') as output:
				bits = requests.get(imgUrl, stream=True).content
				output.write(bits)

else:
	
	response = textToImage(prompt, num, styles , CLIENT_ID, accessToken)
	for resp in response["outputs"]:
		# todo, make new file based on slug of prompt + seed
		newName = "output/" + slugify(prompt) + "-" + str(resp["seed"]) + ".jpg"
		imgUrl = resp["image"]["presignedUrl"]
		print(f"Saving {newName}")
		with open(newName,'wb') as output:
			bits = requests.get(imgUrl, stream=True).content
			output.write(bits)


print("\nDone")