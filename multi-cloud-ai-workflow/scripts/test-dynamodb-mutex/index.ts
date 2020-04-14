import { config, DynamoDB } from "aws-sdk";

const AWS_CREDENTIALS = "../../deployment/aws-credentials.json";

config.loadFromPath(AWS_CREDENTIALS);

const TABLE_NAME = "pt-rovers-mcma-dev-ame-service";

class DynamoDBMutex {
    private readonly dc: DynamoDB.DocumentClient;
    private readonly random: number;
    private hasLock: boolean;
    private tableKey: { partitionKey: string, sortKey?: string };

    constructor(public mutexName: string, private mutexHolder: string, private tableName: string, private lockTimeout: number = 60000) {
        this.dc = new DynamoDB.DocumentClient();
        this.random = Math.random() * 2147483648 << 0;
        this.hasLock = false;
    }

    private async initializeTableKey() {
        if (!this.tableKey) {
            const dynamoDB = new DynamoDB();

            const data = await dynamoDB.describeTable({
                TableName: this.tableName
            }).promise();

            const tableKey: any = {};

            for (const key of data.Table.KeySchema) {
                switch (key.KeyType) {
                    case "HASH":
                        tableKey.partitionKey = key.AttributeName;
                        break;
                    case "RANGE":
                        tableKey.sortKey = key.AttributeName;
                        break;
                }
            }

            this.tableKey = tableKey;
        }
    }

    private generateTableKey() {
        const Key = {};
        if (this.tableKey.sortKey) {
            Key[this.tableKey.partitionKey] = "Mutex";
            Key[this.tableKey.sortKey] = this.mutexName;
        } else {
            Key[this.tableKey.partitionKey] = "Mutex-" + this.mutexName;
        }
        return Key;
    }

    private generateTableItem() {
        const Item = {};
        if (this.tableKey.sortKey) {
            Item[this.tableKey.partitionKey] = "Mutex";
            Item[this.tableKey.sortKey] = this.mutexName;
        } else {
            Item[this.tableKey.partitionKey] = "Mutex-" + this.mutexName;
        }
        Item["mutexHolder"] = this.mutexHolder;
        Item["random"] = this.random;
        Item["timestamp"] = Date.now();
        return Item;
    }

    private async sleep(timeout: number) {
        return new Promise((resolve => setTimeout(() => resolve(), timeout)));
    }

    private async getLockData() {
        const record = await this.dc.get({
            TableName: this.tableName,
            Key: this.generateTableKey(),
            ConsistentRead: true
        }).promise();

        return record?.Item;
    }

    private async putLockData() {
        await this.dc.put({
            TableName: this.tableName,
            Item: this.generateTableItem(),
            Expected: {
                resource_id: {
                    Exists: false
                }
            }
        }).promise();
    }

    private async deleteLockData(random) {
        await this.dc.delete({
            TableName: this.tableName,
            Key: this.generateTableKey(),
            ConditionExpression: "#rnd = :v",
            ExpressionAttributeNames: { "#rnd": "random" },
            ExpressionAttributeValues: { ":v": random }
        }).promise();
    }

    async lock() {
        if (this.hasLock) {
            throw new Error("Cannot lock when already locked");
        }

        await this.initializeTableKey();

        while (!this.hasLock) {
            try {
                await this.putLockData();
                const lockData = await this.getLockData();
                this.hasLock = lockData?.mutexHolder === this.mutexHolder && lockData?.random === this.random;
            } catch (error) {
                const lockData = await this.getLockData();
                if (lockData) {
                    if (lockData.timestamp < Date.now() - this.lockTimeout) {
                        // removing lock in case it's held too long by other thread
                        console.warn("Deleting stale lock from '" + lockData.mutexHolder + " with id " + lockData.random);
                        try {
                            await this.deleteLockData(lockData.random);
                        } catch (error) {
                        }
                    }
                }
            }

            if (!this.hasLock) {
                this.sleep(500);
            }
        }
    }

    async unlock() {
        if (!this.hasLock) {
            throw new Error("Cannot unlock when not locked");
        }
        await this.initializeTableKey();

        await this.deleteLockData(this.random);
        this.hasLock = false;
    }
}

async function sleep(timeout: number) {
    return new Promise((resolve => setTimeout(() => resolve(), timeout)));
}

async function main() {
    const mutex = new DynamoDBMutex("myMutexName", process.pid + "", TABLE_NAME);

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
