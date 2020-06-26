const AmazonCognitoIdentity = require("amazon-cognito-identity-js");

export async function createCognitoUser(AWS: any, terraformOutput: any) {

    const Cognito = new AWS.CognitoIdentityServiceProvider();

    // 1. (Re)create cognito user for website
    const username = "mcma";
    const tempPassword = "b9BC9aX6B3yQK#nr";
    const password = "%bshgkUTv*RD$sR7";

    try {
        const params = {
            UserPoolId: terraformOutput.cognito_user_pool_id?.value,
            Username: "mcma"
        };

        // console.log(JSON.stringify(params, null, 2));

        await Cognito.adminDeleteUser(params).promise();
        console.log("Deleting existing user");
        // console.log(JSON.stringify(data, null, 2));
    } catch (error) {
    }


    const params = {
        UserPoolId: terraformOutput.cognito_user_pool_id?.value,
        Username: username,
        MessageAction: "SUPPRESS",
        TemporaryPassword: tempPassword
    };

    // console.log(JSON.stringify(params, null, 2));

    console.log("Creating user '" + username + "' with temporary password");
    await Cognito.adminCreateUser(params).promise();

    // console.log(JSON.stringify(data, null, 2));

    const authenticationData = {
        Username: username,
        Password: tempPassword,
    };
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    const poolData = {
        UserPoolId: terraformOutput.cognito_user_pool_id?.value,
        ClientId: terraformOutput.cognito_user_pool_client_id?.value
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const userData = {
        Username: username,
        Pool: userPool
    };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    console.log("Authenticating user '" + username + "' with temporary password");

    return new Promise<void>((resolve, reject) => {
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function (result: any) {
                resolve();
            },

            onFailure: function (err: any) {
                console.log("Unexpected error:", err);
                reject(err);
            },

            newPasswordRequired: (userAttributes: any, requiredAttributes: any) => {
                console.log("Changing temporary password to final password");
                cognitoUser.completeNewPasswordChallenge(password, requiredAttributes, {
                    onSuccess: (ignored: any) => {
                        console.log("User '" + username + "' is ready with password '" + password + "'");
                        resolve();
                    },
                    onFailure: (err: any) => {
                        console.log("Unexpected error:", err);
                        reject(err);
                    }
                });
            }
        });
    });
}
