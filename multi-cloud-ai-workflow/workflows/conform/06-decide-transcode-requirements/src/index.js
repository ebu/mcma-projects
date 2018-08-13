//"use strict";

// require
const AWS = require("aws-sdk");
const MCMA_CORE = require("mcma-core");
const timecodes = require("node-timecodes");

// Define
const VIDEO_CODEC_H264 = "h.264";
const VIDEO_FORMAT = "mp42";
const VIDEO_BITRATE_MB = 2;

const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

// Environment Variable(AWS Lambda)
const THESHOLD_SECONDS = parseInt(process.env.THESHOLD_SECONDS);

/**
 * calcutate seconds
 * @param {*} hour 
 * @param {*} minute 
 * @param {*} seconds 
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

    // temporary hack until we have both short and long transcoding implemented
    if (1 === 1) {
        return "none";
    }

    let video = event.data.video;

    let codec = video.codec;
    let format = video.format;
    let bitRate = parseFloat(video.bitRate);
    let mbyte = ( parseFloat(bitRate) / 8 ) / ( 1024 * 1024 );

    // check if transcode type is none. (proxy file spec - mp4 2 mb h264)
    if ( codec === VIDEO_CODEC_H264 && format === VIDEO_FORMAT && mbyte <= VIDEO_BITRATE_MB ) {
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