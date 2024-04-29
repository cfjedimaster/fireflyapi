import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

import { FireflyClient } from '@adobe/firefly-apis';
import { ServerToServerTokenProvider } from '@adobe/firefly-services-common-apis';

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

function getAuthProvider(clientId, clientSecret, scopes) {
    const serverToServerAuthDetails = { 
        clientId,
        clientSecret,
        scopes 
    };
    const serverToServerAuthOptions = {
        autoRefresh: true
    }
    return new ServerToServerTokenProvider(serverToServerAuthDetails, serverToServerAuthOptions);
}

// create auth config
const authProvider = getAuthProvider(process.env.CLIENT_ID, process.env.CLIENT_SECRET, 'openid,AdobeID,firefly_enterprise,firefly_api,ff_apis'); 
const config = {
    tokenProvider: authProvider,
    clientId: process.env.CLIENT_ID 
};

const firefly = new FireflyClient(config);

const resp = await firefly.generateImages({prompt:'a cat riding a unicorn headed into the sunset, dramatic pose', n:4});

for(let output of resp.result.outputs) {
	let fileName = `./${output.seed}.jpg`;
	await downloadFile(output.image.presignedUrl, fileName);
}

