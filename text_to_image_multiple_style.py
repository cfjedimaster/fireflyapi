# This was my attempt to build a script that would test multiple styles at once. And while it worked, 
# I soon realized that Firefly supports a HUGE list of styles, so I stopped typing and left it as is.
# This script could be useful to test _some_ styles at once I think. Just edit the styles array to create 
# a shorter(!) list of styles you want to test. I'm also going to build a new version that simply lets you 
# pass in the styles via arguments.

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
		},
		"styles":{
			"presets":styles
		}
	}

	response = requests.post("https://firefly-beta.adobe.io/v2/images/generate", json=data, headers = {
		"X-API-Key":id, 
		"Authorization":f"Bearer {token}",
		"Content-Type":"application/json"
	}) 

	return response.json()

# List of hard coded styles for now
styles = ["photo","art","graphic", "bw", "cool_colors", "golden", "muted_color", "pastel_color", "toned_image", "vibrant_colors", "warm_tone", "closeup", "knolling", "landscape_photography", "macrophotography", "photographed_through_window", "shallow_depth_of_field", "shot_from_above", "shot_from_below", "surface_detail", "wide_angle", "beautiful", "bohemian", "chaotic", "dais", "divine", "electric", "futuristic", "kitschy", "nostalgic", "simple", "antique_photo", "bioluminescent", "bokeh", "color_explosion", "dark", "faded_image", "fisheye"]

if len(sys.argv) < 2:
	print("Usage: python3 test2.py \"prompt\"")
	sys.exit()

prompt = sys.argv[1]
print(f"Generating images based on prompt: {prompt}")

accessToken = getAccessToken(CLIENT_ID, CLIENT_SECRET)['access_token'];

# So you CAN pass an array of styles, but I don't know how it's supposed to work
# when passing different styles, so we're going to do one at  atime
for style in styles:
	print(f"Generating for style {style}")
	response = textToImage(prompt, 2, [style] , CLIENT_ID, accessToken)

	# So, assume a good response, and loop over response.outputs
	for resp in response["outputs"]:
		# todo, make new file based on slug of prompt + seed
		newName = "output/" + slugify(prompt) + "-" + style + "-" + str(resp["seed"]) + ".jpg"
		imgUrl = resp["image"]["presignedUrl"]
		print(f"Saving {newName}")
		with open(newName,'wb') as output:
			bits = requests.get(imgUrl, stream=True).content
			output.write(bits)

print("\nDone")