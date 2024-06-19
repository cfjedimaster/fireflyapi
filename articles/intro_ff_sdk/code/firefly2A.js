import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

import { FireflyClient } from '@adobe/firefly-apis';

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

const authOptions = {
    autoRefresh: true,
    serviceEnvironment:'stage'
};

const firefly = await FireflyClient.createWithCredentials(process.env.CLIENT_ID, process.env.CLIENT_SECRET, authOptions);

const uploadResp = await firefly.upload(new Blob([await fs.readFile('./source_image.jpg')],{type:'image/jpeg'}));

const resp = await firefly.generateImages({
    prompt:'a cat riding a unicorn headed into the sunset, dramatic pose', 
    style: {
        imageReference: { 
            source: { 
                uploadId:uploadResp.result.images[0].id 
            } 
        }
    }
 });

for(let output of resp.result.outputs) {
	let fileName = `./${output.seed}.jpg`;
	await downloadFile(output.image.url, fileName);
}

