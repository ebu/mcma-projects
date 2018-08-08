//"use strict";

const util = require("util");
const MCMA_CORE = require("mcma-core");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));

const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

/**
 * get amejob id
 * @param {*} event 
 */
function getAmeJobId(event) {
    let id;

    event.data.ameJobId.forEach(element => {
        if (element) {
            id = element;
            return true;
        }
    });

    return id;
}

/**
 * 
 * @param {*} event 
 * @param {*} context 
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // get ame job id
    let ameJobId = getAmeJobId(event);
    if (!ameJobId) {
        throw new Error("Faild to obtain AmeJob ID");
    }
    console.log("[AmeJobID]:", ameJobId);

    // get result of ame job
    let response = await MCMA_CORE.HTTP.get(ameJobId);
    if (!response.data) {
        throw new Error("Faild to obtain AmeJob");
    }

    // get media info
    let s3Bucket = response.data.jobOutput.outputFile.awsS3Bucket;
    let s3Key = response.data.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }
    let mediainfo = JSON.parse(s3Object.Body.toString());

    // create BMEssence
    mediainfo["@type"] = "BMEssence";
    let bme = mediainfo;

    // register BMEssence
    bme = await resourceManager.create(bme);
    if (!bme.id) {
        throw new Error("Failed to register BMEssence.");
    }
    console.log("[BMEssence ID]:", bme.id);

    // get BMContent
    response = await MCMA_CORE.HTTP.get(event.data.assets);
    if (!response.data) {
        throw new Error("Faild to obtain BMContent");
    }
    let bmc = response.data;

    // append BMEssence ID to BMContent
    bmc["ebucore:hasRelatedResource"] = [];
    bmc["ebucore:hasRelatedResource"].push({ "@id": bme.id });

    // update BMContents
    bmc = await resourceManager.update(bmc);

    // make result path data
    let ebuCoreMain = bme['ebucore:ebuCoreMain'];
    let coreMetadata = ebuCoreMain['ebucore:coreMetadata'][0];
    let format = coreMetadata['ebucore:format'][0]['ebucore:videoFormat'][0]['@videoFormatName'];
    let bitRate = coreMetadata['ebucore:format'][0]['ebucore:videoFormat'][0]['ebucore:bitRate'][0]['#value'];
    let containerFormat = coreMetadata['ebucore:format'][0]['ebucore:containerFormat'][0];
    let codec = containerFormat['ebucore:codec'][0]['ebucore:codecIdentifier'][0]['dc:identifier'][0]['#value'];
    let duration = coreMetadata['ebucore:format'][0]['ebucore:duration'][0];
    let normalPlayTime = duration['ebucore:normalPlayTime'][0]['#value'];

    let data = {
        "normalPlayTime" : normalPlayTime,
        "codec": codec,
        "format": format,
        "bitRate": bitRate,
    };

    return data;
}