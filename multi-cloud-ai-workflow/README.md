# multi-cloud-ai-workflow

This example worklow demonstrates how you can leverage AI technologies from multiple cloud vendors in a single media workflow


## Requirements for running the example
* Node.js v8.10.0 installed and accessible in PATH. Recommended is to use a node version manager, which allows you to quickly switch between node versions (see more info at [nvm-windows](https://github.com/coreybutler/nvm-windows) for windows support or [nvm](https://github.com/creationix/nvm) for Mac OS and Linux support)
* Latest version of Terraform and available in PATH. See the [Terraform website](https://www.terraform.io/)
* Java JRE or JDK 1.8 or higher to run Gradle build and deploy scripts
* AWS account

## Setup procedure
1. Clone this repository to your local harddrive
2. Navigate to the `multi-cloud-ai-workflow` folder.
3. Create file named gradle.properties
4. Add the following informaton to the created file and update the parameter values reflecting your AWS account 
```
environmentName=com.your-domain.mcma.multi-cloud-ai-workflow
environmentType=dev

awsAccountId=<YOUR_AWS_ACCOUNT_ID>
awsAccessKey=<YOUR_AWS_ACCESS_KEY>
awsSecretKey=<YOUR_AWS_SECRET_KEY>
awsRegion=<YOUR_AWS_REGION>
```

5. Save the file.
6. Open command line in `multi-cloud-ai-workflow` folder.
7. Execute `gradlew deploy` and let it run. This can take a few minutes.
8. If no errors have occured until now you have successfully setup the infrastructure in your AWS cloud. Go to https://aws.amazon.com/console/ and sign in to see your cloud infrastructure.
