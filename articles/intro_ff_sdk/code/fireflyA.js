import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

import { FireflyClient } from '@adobe/firefly-apis';

async function downloadFile(url, filePath) {
	let res = await fetch(url);
	const body = Readable.fromWeb(res.body);
	const download_write_stream = fs.createWriteStream(filePath);
	return await finished(body.pipe(download_write_stream));
}

const authOptions = {
    autoRefresh: true,
    serviceEnvironment:'stage'
};

const firefly = await FireflyClient.createWithCredentials(process.env.CLIENT_ID, process.env.CLIENT_SECRET, authOptions);

const resp = await firefly.generateImages({prompt:'a cat riding a unicorn headed into the sunset, dramatic pose'});

for(let output of resp.result.outputs) {
	let fileName = `./${output.seed}.jpg`;
	await downloadFile(output.image.url, fileName);
}

