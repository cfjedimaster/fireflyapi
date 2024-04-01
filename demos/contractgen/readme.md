## Quick and Dirty ReadMe

This demo is meant to show a combination of Adobe Firefly Services and Adobe Acrobat Services. The Node server serves up a simple form prompting you for a name, address, and number. Beneath those 3 fields is a text field prompt that integrates with Firefly. The idea is, you type something in, hit the button to generate images, and then select one.

At that point, you can submit the form. Be SURE you select an image first. There's no validation done.

The back end will take your input and use the Document Generation API to return a PDF to you. (Thank you to Joel Geraci for help with converting the result to base64 and using it in Embed.)

