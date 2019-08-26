const util = require("util");
const uuidv4 = require("uuid/v4");

const http = require('http');

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const fs = require("fs");
const fsWriteFile = util.promisify(fs.writeFile);
const fsAppendFile = util.promisify(fs.appendFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const RpcClient = require('node-json-rpc2').Client;

const { Logger, Locator } = require("mcma-core");

async function validateSpeechToText(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();
    const hypothesis = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    // get hypothesis file - results from stt sent from step 31 as input parameter in job call
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

    // get reference file stored in temp starting from tempBucket provided from step 31 as input parameter in job call
    const s3Key_reference = "temp/stt_output_clean.txt";
    let s3Object_reference;
    try {
        s3Object_reference = await S3GetObject({
            Bucket: s3Bucket_hypothesis,
            Key: s3Key_reference,
        });
    } catch (error) {
        throw new Error("Unable to read file in bucket '" + s3Bucket_hypothesis + "' with key '" + s3Key_reference + "' due to error: " + error.message);
    }
    const referenceText = JSON.parse(s3Object_reference.Body.toString());
    console.log(referenceText.results.transcripts[0].transcript);

    // start stt benchmarking job
    let client = new RpcClient({
        protocol:'http',//Optional. Will be http by default
        host:'52.30.8.180',
        path:'/api',
        port:'8080',
        method:'POST'//Optional. POST by default
    });    
    let params={};
    params.ref = referenceText.results.transcripts[0].transcript;
    params.hyp = hypothesisText;
    params.dialect = "html";
    // worddiffs
    let request_wd = {};
    request_wd.jsonrpc = "2.0";
    request_wd.id = "79idqltpu8";
    request_wd.params = params;
    request_wd.method = "metrics.worddiffs";
    console.log(request_wd);

    Bucket_worddiffs = outputLocation.awsS3Bucket;
    Key_worddiffs = (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "sttbenchmarking/worddiffs.txt";
    let output = encodeURI(Bucket_worddiffs + "/" + Key_worddiffs);

    await client.call(request_wd,
        (err, res)=>{
            if(err){
                console.log(err);
                //Do something
            }
        console.log('wordiffs:',res);//Json parsed.
        // write worddiffs result to the output location
        fsAppendFile(output, res, function (err) {
          if (err) throw err;
          console.log('File is created successfully.');
          });
        });

//    fsUnlink(output);


    // Word error rate
/*    let request_err = {};
    request_err.jsonrpc = "2.0";
    request_err.id = "79idqltpu8";
    request_err.params = params;
    request_err.method = "metrics.wer";
    console.log(request_err);
    client.call(request_err,
        (err, res)=>{
            if(err){
                console.log(err);
                //Do something
            }
        console.log('word error rate:',res);//Json parsed.
        });
*/

    // updating JobAssignment with jobOutput
    workerJobHelper.getJobOutput().outputFile = new Locator({
        awsS3Bucket: Bucket_worddiffs,
        awsS3Key: Key_worddiffs
    });
    await workerJobHelper.complete();
    
}

validateSpeechToText.profileName = "ValidateSpeechToText";

module.exports = {
    validateSpeechToText
};