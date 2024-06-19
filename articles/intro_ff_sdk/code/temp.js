
import { FireflyClient } from '@adobe/firefly-apis';

const authOptions = {
    serviceEnvironment:'stage'
};

const firefly = await FireflyClient.createWithCredentials(process.env.CLIENT_ID, process.env.CLIENT_SECRET, authOptions);
const resp = await firefly.generateImages({prompt:'a cat riding a unicorn headed into the sunset, dramatic pose'});


