const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const Translate = new AWS.Translate({ apiVersion: "2017-07-01" });
const TranslateText = util.promisify(Translate.translateText.bind(Translate));

const { Logger, Locator } = require("mcma-core");

async function translateText(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();
    const inputFile = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    // get input text file
    const s3Bucket = inputFile.awsS3Bucket;
    const s3Key = inputFile.awsS3Key;

    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to read file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    const inputText = s3Object.Body.toString().split('.');
    console.log(inputText);

    // start translation job


    let SourceLanguage = jobInput.sourceLanguageCode;
    let TargetLanguage = jobInput.targetLanguageCode;

    let translatedText = "";
    for (var i=0; i<inputText.length; i++){
        if (inputText[i]!=""){
            const params = {
                SourceLanguageCode: SourceLanguage || "auto",
                TargetLanguageCode: TargetLanguage,
                Text: inputText[i] + "."
                };

            Logger.debug("Invoking translation service with parameters", JSON.stringify(params, null, 2));

            const data = await TranslateText(params);

            if (translatedText==="") {
                translatedText = data.TranslatedText;
            } else {
                translatedText = translatedText + data.TranslatedText;
            }
//            console.log(translatedText);
        }
    }
    console.log(translatedText);

    // write result to file
    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".txt",
//        Body: data.TranslatedText
        Body: translatedText
    }

    await S3PutObject(s3Params);

    // updating JobAssignment with jobOutput
    workerJobHelper.getJobOutput().outputFile = new Locator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await workerJobHelper.complete();
}

translateText.profileName = "AWSTranslateText";

module.exports = {
    translateText
};