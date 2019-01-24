const transform = require('./transform');
const fs = require('fs');
const MCMA_CORE = require("mcma-core");

const AWS = require("aws-sdk");

const awsV4AuthenticatorConfig = {
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
}

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator(awsV4AuthenticatorConfig);

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const resourceManagerConfig = {
    servicesUrl: process.env.SERVICES_URL,
    servicesAuthType: process.env.SERVICES_AUTH_TYPE,
    servicesAuthContext: process.env.SERVICES_AUTH_CONTEXT,
    authProvider
}

const appRouter = function (app) {

    app.get('/', function (req, res) {
        console.log(JSON.stringify(awsV4AuthenticatorConfig, null, 2));

        console.log(JSON.stringify(resourceManagerConfig, null, 2));

        res.status(200).send('Welcome to MCMA EC2 Transform Service');
    });

    app.post('/new-transform-job', async (req, res, next) => {
        try {
            if (req.body) {
                res.sendStatus(200);

                let job = req.body;

                try {
                    const output = await transform.start(job.input);
                    job.status = "COMPLETED";
                    job.output = output;
                } catch (error) {
                    job.status = "FAILED";
                    job.statusMessage = error.message;
                }

                let resourceManager = new MCMA_CORE.ResourceManager(resourceManagerConfig);

                console.log('Send Callback:', job);
                try {
                    await resourceManager.sendNotification(job);
                } catch (error) {
                    console.log(error.toString())
                }
            } else {
                res.status(400).send({ error: 'No job found in given assignment' });
            }
        } catch (e) {
            next(e);
        }
    });


    app.get('/log', function (req, res) {
        let log = fs.readFileSync('deployment.log', 'utf-8');
        res.send(log);
    });
};

module.exports = appRouter;