//"use strict";

// require
const MCMA_CORE = require("mcma-core");

// Local Define
const VIDEO_FORMAT = "AVC";
const VIDEO_CODEC = "mp42";
const VIDEO_CODEC_ISOM = "isom";
const VIDEO_BITRATE_MB = 2;

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const THESHOLD_SECONDS = parseInt(process.env.THESHOLD_SECONDS);

/**
 * get the registered BMEssence
 */
getBMEssence = async(url) => {

    let response = await MCMA_CORE.HTTP.get(url);

    if (!response.data) {
        throw new Error("Faild to obtain BMContent");
    }

    return response.data;
}

/**
 * calcutate seconds
 * @param {*} hour hour
 * @param {*} minute minute
 * @param {*} seconds seconds
 */
function calcSeconds(hour, minute, seconds) {
    var sec = (hour * 60 * 60) + (minute * 60) + seconds;
    return sec;
}

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 45;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // acquire the registered BMEssence
    let bme = await getBMEssence(event.data.bmEssence);
    
    let technicalMetadata = bme.technicalMetadata;

    let ebuCoreMain = technicalMetadata['ebucore:ebuCoreMain'];
    let coreMetadata = ebuCoreMain['ebucore:coreMetadata'][0];
    let containerFormat = coreMetadata['ebucore:format'][0]['ebucore:containerFormat'][0];
    let duration = coreMetadata['ebucore:format'][0]['ebucore:duration'][0]

    // vaildate parameters
    let video = {
        codec: containerFormat['ebucore:codec'][0]['ebucore:codecIdentifier'][0]['dc:identifier'][0]['#value'],
        bitRate: coreMetadata['ebucore:format'][0]['ebucore:videoFormat'][0]['ebucore:bitRate'][0]['#value'],
        format: coreMetadata['ebucore:format'][0]['ebucore:videoFormat'][0]['@videoFormatName'],
        normalPlayTime: duration['ebucore:normalPlayTime'][0]['#value']
    }

    let codec = video.codec;
    let format = video.format;
    let bitRate = parseFloat(video.bitRate);
    let mbyte = ( parseFloat(bitRate) / 8 ) / ( 1024 * 1024 );

    let data = {
        codec: video.codec,
        format: video.format,
        mbyte: mbyte,
    }
    console.log("[PARAMS]:", JSON.stringify(data, null, 2));

    // check if transcode type is none. (proxy file spec - mp4 2 mb h264)
    if ( (codec === VIDEO_CODEC || codec === VIDEO_CODEC_ISOM) && format === VIDEO_FORMAT && mbyte <= VIDEO_BITRATE_MB ) {
        return "none";
    }

    // check if transcode type is short or long
    var normalPlayTime = video.normalPlayTime;
    var hour = normalPlayTime.match(/(\d*)H/);
    var min = normalPlayTime.match(/(\d*)M/);
    var sec = normalPlayTime.match(/(\d*.\d*)S/);
    var totalSeconds = calcSeconds((hour != null)? parseInt(hour[1]) : 0, (min != null)? parseInt(min[1]) : 0, parseFloat(sec[1]));
    console.log("[Total Seconds]:", totalSeconds);

    if ( totalSeconds <= THESHOLD_SECONDS ) {
        return "short";
    } else {
        return "long";
    }
}