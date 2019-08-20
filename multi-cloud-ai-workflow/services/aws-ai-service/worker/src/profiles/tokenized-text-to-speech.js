const util = require("util");
const AWS = require("aws-sdk");

const uuidv4 = require("uuid/v4");

const fs = require("fs");
const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const { ffmpeg } = require("../ffmpeg");

const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const S3DeleteObject = util.promisify(S3.deleteObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const Polly = new AWS.Polly();
const PollyStartSpeechSynthesisTask = util.promisify(Polly.startSpeechSynthesisTask.bind(Polly));

const { Logger, JobAssignment, Locator, AIJob } = require("mcma-core");
const { WorkerJobHelper } = require("mcma-worker");
const { DynamoDbTableProvider, getAwsV4ResourceManager } = require("mcma-aws");


async function tokenizedTextToSpeech(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();
    const inputFile = jobInput.inputFile;
    const voiceId = jobInput.voiceId;
    const jobAssignmentId = workerJobHelper.getJobAssignmentId();

    // get input text file from translation service stored in tempBucket
    const s3Bucket = inputFile.awsS3Bucket;
    console.log(s3Bucket);
    const s3Key = inputFile.awsS3Key;
    console.log(s3Key);

    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to read file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    const inputText = s3Object.Body.toString();


    const params_sm = {
            OutputFormat: 'json',
            OutputS3BucketName: workerJobHelper.getRequest().getRequiredContextVariable("ServiceOutputBucket"),
            OutputS3KeyPrefix:'000-TextTokensSpeechMarksJob-' + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
            Text: inputText,
            SpeechMarkTypes: ["sentence"],
            VoiceId: voiceId,
            TextType: 'text'
        }

        const data = await PollyStartSpeechSynthesisTask(params_sm);
        console.log(data);

}

const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const processTokenizedTextToSpeechJobResult = async (request) => {
    const workerJobHelper = new WorkerJobHelper(
        AIJob,
        dynamoDbTableProvider.table(request.tableName()),
        getAwsV4ResourceManager(request),
        request,
        request.input.jobAssignmentId
    );

    let jobAssignmentId = request.input.jobAssignmentId;
    
 
    try {
        await workerJobHelper.initialize();

        // 2. Retrieve job inputParameters
        let jobInput = workerJobHelper.getJobInput();

        // 4. grab speechmarks 
        let s3Bucket = request.input.outputFile.awsS3Bucket;
        let s3Key = request.input.outputFile.awsS3Key;
        const speechmarks = await S3GetObject({ Bucket: s3Bucket, Key: s3Key });
        let speechmarks_json_a = "{ \"results\": { \"items\": [" + speechmarks.Body.toString().replace(/}/g, '},') + "]}}";
        let speechmarks_json_b = speechmarks_json_a.replace(/[\n]/g, "");
        let speechmarks_json = speechmarks_json_b.replace(',]' , ']');
        //console.log(speechmarks_json);

        // copy speechmarks in in speechmark json file
        let s3Bucket_sm = jobInput.outputLocation.awsS3Bucket;
        let s3Key_sm = jobInput.outputLocation.awsS3KeyPrefix + "speechmarks.json" ;
        let s3Params_sm = {
            Bucket: s3Bucket_sm,
            Key: s3Key_sm,
            Body: speechmarks_json
        }
        await S3PutObject(s3Params_sm);

//        console.log(speechmarks_json);

        // get stt_output_clean from tempBucket
        const s3Bucket_stt = jobInput.inputFile.awsS3Bucket;
        const s3Key_stt = "stt/stt_output_clean.txt";

        let s3Object_stt;
        try {
            s3Object_stt = await S3GetObject({
                Bucket: s3Bucket_stt,
                Key: s3Key_stt,
            });
        } catch (error) {
            throw new Error("Unable to read file in bucket '" + s3Bucket_stt + "' with key '" + s3Key_stt + "' due to error: " + error.message);
        }

        const stt = s3Object_stt.Body.toString();
        console.log(stt);

        let sttJsonData = JSON.parse(stt);
        console.log(sttJsonData);

        let speechmarksJsonData = JSON.parse(speechmarks_json);
        console.log(speechmarksJsonData);

        // generate SSML file with breaks
        let ssldata ="<speak>"; 
        let k=0;
        // time reference in ms
        let t=0;



        for (var j = 0; j < sttJsonData.results.items.length; j++) {
//            console.log(sttJsonData.results.items.length);
            var item = sttJsonData.results.items[j];
            var punctuation = item.alternatives[0];
//            console.log(item.start_time);
            var speechSpeedFactor = 0.5;
            var breakTimeFactor = 1.1;
            var dotTime = 0.3;

            if (j == 0 & item.start_time > 0 ) {
                ssldata = ssldata + "<break time=\"" + item.start_time * breakTimeFactor + "s\"/>";
                // time in ms
                t = t + ((item.start_time * 1000) * breakTimeFactor);


            } else if ( item.type.includes("punctuation") & punctuation.content.includes(".") ) {
                if (j+1 < sttJsonData.results.items.length ){

                    if ((k+1 < speechmarksJsonData.results.items.length)) {

    //                    var previousitem = sttJsonData.results.items[j - 1];
                        var nextitem = sttJsonData.results.items[j + 1];
                        var speechmarksJsonDataItem = speechmarksJsonData.results.items[k];
                        var nextSpeechmarksJsonDataItem = speechmarksJsonData.results.items[k + 1];
                        var translatedSentenceDuration = (nextSpeechmarksJsonDataItem.time - speechmarksJsonDataItem.time) * speechSpeedFactor;
                        console.log(translatedSentenceDuration);

                        ssldata = ssldata  + speechmarksJsonDataItem.value.replace('.','<break time="0.5s"/>');
//                        console.log(speechmarksJsonDataItem.value);
//                        console.log("start-time next item:" + nextitem.start_time * 1000);
//                        console.log("end current sentence:" + t + translatedSentenceDuration);
//                        console.log("break time:" + ((nextitem.start_time * 1000) - (t + translatedSentenceDuration)));
    //                    ssldata = ssldata  + speechmarksJsonDataItem.value.replace('.','<break time="0.3s"/>').replace(',','<break time="0.2s"/>');
                        if ( (((nextitem.start_time * 1000) - (t + translatedSentenceDuration)) / 1000) > 0 ){
                           ssldata = ssldata + "<break time=\"" + ((((nextitem.start_time * 1000) - (t + translatedSentenceDuration)) / 1000) * breakTimeFactor) + "s\"/>";
                           t = t + (((nextitem.start_time * 1000) - (t + translatedSentenceDuration)) * breakTimeFactor) ;
                        }
                    } else {

                        var speechmarksJsonDataItem = speechmarksJsonData.results.items[k];
                        ssldata = ssldata  + speechmarksJsonDataItem.value.replace('.','');

                    }

                    k = k + 1;
                    t = t + translatedSentenceDuration + 500;
                    console.log(t);

                }
                console.log(ssldata);
            }
        }
        ssldata=ssldata + "</speak>";

        // copy ssml file in in ssml txt file
//        console.log(jobInput.outputLocation.awsS3Bucket);
//        console.log(jobInput.outputLocation.awsS3KeyPrefix);
        let s3Bucket_ssml = jobInput.outputLocation.awsS3Bucket;
        let s3Key_ssml = jobInput.outputLocation.awsS3KeyPrefix + "ssml.txt";
        let s3Params_ssml = {
            Bucket: s3Bucket_ssml,
            Key: s3Key_ssml,
            Body: ssldata
        }
        await S3PutObject(s3Params_ssml);

        console.log(ssldata);

        // 4. updating JobAssignment with jobOutput -> ssml txt file
        workerJobHelper.getJobOutput().outputFile = new Locator({
            awsS3Bucket: s3Bucket_ssml,
            awsS3Key: s3Key_ssml
        });
        
        await workerJobHelper.complete();


    } catch (error) {
        Logger.exception(error);
        try {
            await workerJobHelper.fail(error.message);
        } catch (error) {
            Logger.exception(error);
        }
    }


    // Cleanup: Deleting original output file
    try {
        await S3DeleteObject({
            Bucket: request.input.outputFile.awsS3Bucket,
            Key: request.input.outputFile.awsS3Key,
        });
    } catch (error) {
        console.warn("Failed to cleanup ssml translation output file");
    }

}

tokenizedTextToSpeech.profileName = "AWSTokenizedTextToSpeech";

module.exports = {
    tokenizedTextToSpeech,
    processTokenizedTextToSpeechJobResult
};