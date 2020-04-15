import { config, DynamoDB } from "aws-sdk";
import { DynamoDBMutex } from "./dynamodb-mutex";

const AWS_CREDENTIALS = "../../deployment/aws-credentials.json";

config.loadFromPath(AWS_CREDENTIALS);

const TABLE_NAME = "pt-rovers-mcma-dev-ame-service";

async function sleep(timeout: number) {
    return new Promise((resolve => setTimeout(() => resolve(), timeout)));
}

async function main() {
    const mutex = new DynamoDBMutex("myMutex", process.pid + "", TABLE_NAME);

    for (; ;) {
        console.log(new Date().toISOString() + ": Requesting lock");
        await mutex.lock();
        try {
            console.log(new Date().toISOString() + ": Acquired lock");

            for (let i = 0; i < 3; i++) {
                console.log(new Date().toISOString() + ": Doing stuff while having lock");
                await sleep(1000);
            }
        } finally {
            console.log(new Date().toISOString() + ": Releasing lock");
            await mutex.unlock();
            console.log(new Date().toISOString() + ": Released lock");
        }

        await sleep(1000);
    }
}

main().then(() => console.log("done")).catch(e => console.error(e));
