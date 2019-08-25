const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const RpcClient = require('node-json-rpc2');

const { Logger, Locator } = require("mcma-core");

async function translateText(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();
    const hypothesis = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    // get reference file
    const s3Bucket_reference = hypothesis.awsS3Bucket;
    const s3Key_reference = "temp/stt_output_clean.stt";
    let s3Object_reference;
    try {
        s3Object_reference = await S3GetObject({
            Bucket: s3Bucket_reference,
            Key: s3Key_reference,
        });
    } catch (error) {
        throw new Error("Unable to read file in bucket '" + s3Bucket_reference + "' with key '" + s3Key_reference + "' due to error: " + error.message);
    }
    const referenceText = s3Object_reference.Body.toString();
    console.log(referenceText);

    // get hypothesis file
    const s3Bucket_hypothesis = hypothesis.awsS3Bucket;
    const s3Key_hypothesis = hypothesis.awsS3Key;
    let s3Object_hypothesis;
    try {
        s3Object_hypothesis = await S3GetObject({
            Bucket: s3Bucket_hypothesis,
            Key: s3Key_hypothesis,
        });
    } catch (error) {
        throw new Error("Unable to read file in bucket '" + s3Bucket_hypothesis + "' with key '" + s3Key_hypothesis + "' due to error: " + error.message);
    }
    const hypothesisText = s3Object_hypothesis.Body.toString();
    console.log(hypothesisText);


    // start stt benchmarking job
    // worddiffs and word error rate
/*    const config = {
        protocol:'http',//Optional. Will be http by default
        host:'52.30.8.180',
        path:'/api',
        port:'8080',
        method:'POST'//Optional. POST by default
    };
    let params= "{\"ref\":" + referenceText + ",\"hyp\":" + hypothesisText + ", \"dialect\": \"html\"}" ;
    let client = new RpcClient(config);    
    client.call({
        method:"metrics.worddiffs",//Mandatory
        params: params,
        },(err, res)=>{
            if(err){
                console.log(err);
                //Do something
            }
        console.log('wordiffs:',res);//Json parsed.
        });
*/

/*    // write worddiffs result to file
    let s3Params_worddiffs = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "worddiffs.txt",
//        Body: data.TranslatedText
        Body: worddiffs
    }
    await S3PutObject(s3Params_worddiffs);

    // write worderrorrate result to file
    let s3Params_worderr = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "worderr.txt",
//        Body: data.TranslatedText
        Body: worderr
    }
    await S3PutObject(s3Params_worderr);


    // updating JobAssignment with jobOutput
    workerJobHelper.getJobOutput().wordiffs = new Locator({
        awsS3Bucket: s3Params_worddiffs.Bucket,
        awsS3Key: s3Params_worddiffs.Key
    });

    await workerJobHelper.complete();
*/    
}

translateText.profileName = "ValidateSpeechTotext";

module.exports = {
    translateText
};