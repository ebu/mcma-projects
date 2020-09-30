export async function uploadWebsiteConfig(AWS: any, terraformOutput: any) {
    const S3 = new AWS.S3();

    const servicesUrl = terraformOutput.service_registry.value.services_url;
    const servicesAuthType = terraformOutput.service_registry.value.auth_type;

    console.log("Uploading deployment configuration to website");
    const config = {
        resourceManager: {
            servicesUrl,
            servicesAuthType,
        },
        aws: {
            region: terraformOutput.aws_region?.value,
            s3: {
                uploadBucket: terraformOutput.upload_bucket?.value
            },
            cognito: {
                userPool: {
                    UserPoolId: terraformOutput.cognito_user_pool_id?.value,
                    ClientId: terraformOutput.cognito_user_pool_client_id?.value
                },
                identityPool: {
                    id: terraformOutput.cognito_identity_pool_id?.value
                }
            }
        }
    };

    const s3Params = {
        Bucket: terraformOutput.website_bucket.value,
        Key: "config.json",
        Body: JSON.stringify(config)
    };

    await S3.putObject(s3Params).promise();
}
