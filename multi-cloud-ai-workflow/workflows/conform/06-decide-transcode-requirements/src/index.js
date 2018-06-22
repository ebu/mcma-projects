// require
const AWS = require("aws-sdk");
const async = require("async");
const timecodes = require("node-timecodes");

// Define
const VIDEO_CODEC_H264 = "h.264";
const VIDEO_FORMAT = "MPEG-4";
const VIDEO_SIZE = 2;

// Environment Variable(AWS Lambda)
const THESHOLD_SECONDS = parseInt(process.env.THESHOLD_SECONDS);

/**
 * Retreving BMEssence with metadata
 * @param {*} json BMEssence with metadata
 */
function getBMEssence(json) {
    // Retrieve the value of the specified element(@type = ebucore:BMEssence)
    var graph = json["@graph"]
    var bme = graph.find(function(g) { return g['@type'] == 'ebucore:BMEssence' });
    if (bme === null || bme === undefined) {
        return null;
    }
    return bme;
}

/**
 * Change Byte To Mega Byte
 * @param {*} byte 
 */
function convertBytetoMB(byte) {
    // Change Byte To KB
    var kb = byte / 1024;
    // Change KB To MB
    var mb = kb / 1024
    return mb;
}

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
 * @param {*} callback callback
 */
exports.handler = (event, context, callback) => {
    // Read options from the event.
    console.log("Event:", JSON.stringify(event, null, 2));

    // Description
    // AWS Workflow:
    //  Lambda Step Function: 
    //   Evaluate input file for Transcode based on Technical Metadata and what is required for AI Engine.
    //   Call the correct profile based on rule (duration) Short or Long Transcode.
    //  Evaluation: No Transcode (already proxy file spec - mp4 2 mb h264), Short Transcode, Long Transcode

    // Execute async waterfall
    async.waterfall([
        (callback) => { // Get the technical metadata(BMEssence)
            var bme = getBMEssence(event.payload);
            // Check the value of the BMEssence
            if( bme === null) {
                return callback("Not Found BMEssence with metadata.");
            }
            return callback(null, bme);
        },
        (bme, callback) => { // Add transcode type to workflow parameter
            console.log("BMEssence", JSON.stringify(bme, null, 2));
            // Container Codec
            var codec = bme["ebucore:hasContainerCodec"];
            console.log("Container Codec:", codec);

            // Media Container Format
            var format = bme["ebucore:hasContainerFormat"];
            console.log("Container Format:", format);

            // Media File Size
            var size = parseInt(bme["ebucore:fileSize"]);
            console.log("File Size:", convertBytetoMB(size));

            // // Media Frame Rate
            // var frameRate = bme["ebucore:frameRate"];
            // var vfr = parseFloat(frameRate.split("/")[0]);
            // console.log("vfr:", vfr);
            // var cfr = parseFloat(frameRate.split("/")[1]);
            // console.log("cfr:", cfr);
            // var fps = vfr / cfr;
            // console.log("fps:", fps);
            

            // Media Duration
            var duration = bme["ebucore:duration"].trim();
            console.log("duration:", duration);

            // timecodes.constants.frameRate = fps;
            var seconds = timecodes.toSeconds(duration);
            console.log("seconds:", seconds);

            // timecodes.constants.framerate = 24.975
            // console.log(timecodes.fromSeconds(seconds));

            // Duration PlayTime
            var playtime = bme["ebucore:durationNormalPlayTime"];
            console.log(playtime);
            var hour = playtime.match(/(\d*)H/);
            var min = playtime.match(/(\d*)M/);
            var sec = playtime.match(/(\d*.\d*)S/);
            console.log("Time Code:", hour, min, sec);

            console.log(calcSeconds((hour != null)? parseInt(hour[1]) : 0, parseInt(min[1]), parseFloat(sec[1])));

            // Check mediainfo duration(ebucore:duration)
            // event.workflow_param.transcode = duration > 15 ? "long" : "short";
            callback(null, codec, format, size, seconds);
        },
        (codec, format, size, seconds, callback) => { // transcode type is determined

            if( codec === "h.264" && format === "MPEG-4" && size < 2 ) {
                return callback(null, "none");
            }

            if( seconds >= THESHOLD_SECONDS ) {
                return callback(null, "long");
            } else {
                return callback(null, "short");
            }
        },
        (type, callback) => { // Add Transcode type to Event Data
            event.workflow_param.transcode = { type: type };
            callback();
        }
    ], (err) => {
        // Process results
        if (err) {
            console.error("Error:");
            console.error(err);
        }
        return callback(err, event);
    });
}