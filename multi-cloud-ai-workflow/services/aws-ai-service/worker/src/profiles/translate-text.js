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

    Logger.debug("12. A service to translate the result of Speech to text");

    Logger.debug("12.1. get input text file received from job initiator");
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

    Logger.debug("12.2. tokenize inputtext on full stops '.'");
    const inputText = s3Object.Body.toString().split('.');
    console.log(inputText);

    Logger.debug("12.3. initialize and start translation job sentence per sentence");
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

            // call translation service for each sentence
            const data = await TranslateText(params);

            if (translatedText==="") {
                translatedText = data.TranslatedText;
            } else {
                translatedText = translatedText + data.TranslatedText;
            }
            // visualise translation after each sentence.
            // console.log(translatedText);
        }
    }
    Logger.debug("12.4. visualise translation output");
    console.log(translatedText);

    Logger.debug("12.5. save translation result into file on output location");
    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".txt",
//        Body: data.TranslatedText
        Body: translatedText
    }
    await S3PutObject(s3Params);

    Logger.debug("12.6. updating JobAssignment with jobOutput");
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