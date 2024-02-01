# ref: https://practicaldatascience.co.uk/data-science/how-to-use-the-dropbox-api-with-python

import dropbox

token = os.environ.get('DROPBOX_ACCESS_TOKEN')


def dropbox_connect(token):
	try:
		dbx = dropbox.Dropbox(token)
	except AuthError as e:
		print('Error connecting to Dropbox with access token: ' + str(e))
	return dbx

def dropbox_list_files(path):

	files = dbx.files_list_folder(path).entries
	files_list = []

	for file in files:
		files_list.append(file.path_display)

	return files_list

dbx = dropbox_connect(token)
files = dropbox_list_files("/FFDemo/input")
print(files)


print("Done")
