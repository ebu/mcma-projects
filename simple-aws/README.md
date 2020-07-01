# simple-aws

This example workflow demonstrates the basic usage of MCMA hosted in AWS.

## Requirements for running the example
* Node.js v10.16.3 installed and accessible in PATH. Recommended is to use a node version manager, which allows you to quickly switch between node versions (see more info at [nvm-windows](https://github.com/coreybutler/nvm-windows) for windows support or [nvm](https://github.com/creationix/nvm) for Mac OS and Linux support)
* Terraform v0.12.19 installed and available in PATH. See the [Terraform website](https://www.terraform.io/)
* Java JRE or JDK 1.8 or higher to run Gradle build and deploy scripts
* AWS account

## Setup procedure
1. Clone this repository to your local harddrive
2. Navigate to the `simple-aws` folder.
3. Create file named `gradle.properties`
4. Add the following information to the created file and update the parameter values reflecting your AWS account and Azure account 
```
# Mandatory settings

environmentName=com.your-domain.mcma
environmentType=dev

awsAccountId=<YOUR_AWS_ACCOUNT_ID>
awsAccessKey=<YOUR_AWS_ACCESS_KEY>
awsSecretKey=<YOUR_AWS_SECRET_KEY>
awsRegion=<YOUR_AWS_REGION>

testFilePath=<LOCAL_PATH_TO_A_VIDEO_FILE>
```

5. Save the file.
6. Open command line in `test folder.
7. Execute `gradlew deploy` and let it run. This can take a few minutes.
8. If no errors have occurred until now you have successfully setup the infrastructure in your AWS cloud. Go to https://aws.amazon.com/console/ and sign in to see your cloud infrastructure. In case you do have errors it may be that your environmentName is either too long or not unique enough to guarantee unique names for your cloud resources e.g. bucket names.
9. Execute `gradlew runJobs` to execute metadata and thumbnail extraction jobs on your test file. You will see links to the output files in the console when it finishes.
