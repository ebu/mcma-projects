//"use strict";

const fs = require("fs");
const util = require("util");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');
const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const Cognito = new AWS.CognitoIdentityServiceProvider();
const CognitoAdminCreateUser = util.promisify(Cognito.adminCreateUser.bind(Cognito));
const CognitoAdminDeleteUser = util.promisify(Cognito.adminDeleteUser.bind(Cognito));

global.fetch = require('node-fetch');
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");

const convertTerraformOutputToJSON = (content) => {
    let object = {};

    let lines = content.split("\n");
    for (const line of lines) {
        var parts = line.split(" = ");

        if (parts.length === 2) {
            object[parts[0]] = parts[1];
        }
    }

    return object;
}

const main = async () => {
    if (process.argv.length !== 3) {
        console.error("Missing input file");
        process.exit(1);
    }

    try {
        let terraformOutput = convertTerraformOutputToJSON(fs.readFileSync(process.argv[2], "utf8"));

        let servicesUrl = terraformOutput.services_url;
        let servicesAuthType = terraformOutput.services_auth_type;
        let servicesAuthContext = terraformOutput.services_auth_context;

        // 1. (Re)create cognito user for website
        let username = "mcma";
        let tempPassword = "b9BC9aX6B3yQK#nr";
        let password = "%bshgkUTv*RD$sR7";

        try {
            let params = {
                UserPoolId: terraformOutput.cognito_user_pool_id,
                Username: "mcma"
            }

            // console.log(JSON.stringify(params, null, 2));

            let data = await CognitoAdminDeleteUser(params);
            console.log("Deleting existing user");
            // console.log(JSON.stringify(data, null, 2));
        } catch (error) {
        }

        try {
            let params = {
                UserPoolId: terraformOutput.cognito_user_pool_id,
                Username: username,
                MessageAction: "SUPPRESS",
                TemporaryPassword: tempPassword
            }

            // console.log(JSON.stringify(params, null, 2));

            console.log("Creating user '" + username + "' with temporary password");
            let data = await CognitoAdminCreateUser(params);

            // console.log(JSON.stringify(data, null, 2));

            let authenticationData = {
                Username: username,
                Password: tempPassword,
            };
            let authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
            let poolData = {
                UserPoolId: terraformOutput.cognito_user_pool_id,
                ClientId: terraformOutput.cognito_user_pool_client_id
            };
            let userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
            let userData = {
                Username: username,
                Pool: userPool
            };
            let cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

            console.log("Authenticating user '" + username + "' with temporary password");
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: function (result) {
                },

                onFailure: function (err) {
                    console.log("Unexpected error:", err);
                },

                newPasswordRequired: (userAttributes, requiredAttributes) => {
                    console.log("Changing temporary password to final password");
                    cognitoUser.completeNewPasswordChallenge(password, requiredAttributes, {
                        onSuccess: (session) => {
                            console.log("User '" + username + "' is ready with password '" + password + "'");
                        },
                        onFailure: (err) => {
                            console.log("Unexpected error:", err);
                        }
                    });
                }
            });
        } catch (error) {
            console.log("Failed to setup user due to error:", error);
        }

        // 2. Uploading configuration to website
        console.log("Uploading deployment configuration to website");
        let config = {
            resourceManager: {
                servicesUrl,
                servicesAuthType,
                servicesAuthContext,
            },
            aws: {
                region: terraformOutput.aws_region,
                s3: {
                    uploadBucket: terraformOutput.upload_bucket
                },
                cognito: {
                    userPool: {
                        UserPoolId: terraformOutput.cognito_user_pool_id,
                        ClientId: terraformOutput.cognito_user_pool_client_id
                    },
                    identityPool: {
                        id: terraformOutput.cognito_identity_pool_id
                    }
                }
            }
        }

        let s3Params = {
            Bucket: terraformOutput.website_bucket,
            Key: "config.json",
            Body: JSON.stringify(config)
        }

        await S3PutObject(s3Params);
    } catch (error) {
        if (error.response) {
            console.error(JSON.stringify(error.response.data.message, null, 2));
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}
main();