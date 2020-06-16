import { v4 as uuidv4 } from "uuid";
import * as AWS from "aws-sdk";
import { AIJob, McmaException } from "@mcma/core";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";

const S3 = new AWS.S3();
const Translate = new AWS.Translate({ apiVersion: "2017-07-01" });

export async function translateText(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;

    const jobInput = jobAssignmentHelper.jobInput;
    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");

    logger.debug("12. A service to translate the result of Speech to text");

    logger.debug("12.1. get input text file received from job initiator");
    const s3Bucket = inputFile.awsS3Bucket;
    const s3Key = inputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3.getObject({
            Bucket: s3Bucket,
            Key: s3Key,
        }).promise();
    } catch (error) {
        throw new McmaException("Unable to read file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    logger.debug("12.2. tokenize inputtext on full stops '.'");
    const inputText = s3Object.Body.toString().split(".");
    logger.debug(inputText);

    logger.debug("12.3. initialize and start translation job sentence per sentence");
    let SourceLanguage = jobInput.sourceLanguageCode;
    let TargetLanguage = jobInput.targetLanguageCode;
    let translatedText = "";
    for (var i = 0; i < inputText.length; i++) {
        if (inputText[i] !== "") {
            const params = {
                SourceLanguageCode: SourceLanguage || "auto",
                TargetLanguageCode: TargetLanguage,
                Text: inputText[i] + "."
            };

            // call translation service for each sentence
            const data = await Translate.translateText(params).promise();

            if (translatedText === "") {
                translatedText = data.TranslatedText;
            } else {
                translatedText = translatedText + data.TranslatedText;
            }
            // visualise translation after each sentence.
            // console.log(translatedText);
        }
    }
    logger.debug("12.4. visualise translation output");
    logger.debug(translatedText);

    logger.debug("12.5. save translation result into file on output location");
    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".txt",
        Body: translatedText
    };
    await S3.putObject(s3Params).promise();

    logger.debug("12.6. updating JobAssignment with jobOutput");
    jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    }));

    await jobAssignmentHelper.complete();
}
