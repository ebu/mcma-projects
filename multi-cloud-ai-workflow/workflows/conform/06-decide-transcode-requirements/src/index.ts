import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, JobBaseProperties, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { BMEssence } from "@local/common";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-06-decide-transcode-requirements", process.env.LogGroupName);

// Local Define
const VIDEO_FORMAT = "AVC";
const VIDEO_CODEC = "mp42";
const VIDEO_CODEC_ISOM = "isom";
const VIDEO_BITRATE_MB = 2;

// Environment Variable(AWS Lambda)
const ThresholdSeconds = parseInt(process.env.ThresholdSeconds);

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

type InputEvent = {
    data: {
        bmEssence: string;
    };
} & JobBaseProperties;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        // send update notification
        try {
            event.progress = 45;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // acquire the registered BMEssence
        let bme = await resourceManager.get<BMEssence>(event.data.bmEssence);

        let technicalMetadata = bme.technicalMetadata;

        let ebuCoreMain = technicalMetadata["ebucore:ebuCoreMain"];
        let coreMetadata = ebuCoreMain["ebucore:coreMetadata"][0];
        let containerFormat = coreMetadata["ebucore:format"][0]["ebucore:containerFormat"][0];
        let duration = coreMetadata["ebucore:format"][0]["ebucore:duration"][0];

        // vaildate parameters
        let video = {
            codec: containerFormat["ebucore:codec"][0]["ebucore:codecIdentifier"][0]["dc:identifier"][0]["#value"],
            bitRate: coreMetadata["ebucore:format"][0]["ebucore:videoFormat"][0]["ebucore:bitRate"][0]["#value"],
            format: coreMetadata["ebucore:format"][0]["ebucore:videoFormat"][0]["@videoFormatName"],
            normalPlayTime: duration["ebucore:normalPlayTime"][0]["#value"]
        };

        let codec = video.codec;
        let format = video.format;
        let bitRate = parseFloat(video.bitRate);
        let mbyte = (bitRate / 8) / (1024 * 1024);

        let data = {
            codec: video.codec,
            format: video.format,
            mbyte: mbyte,
        };
        logger.info("[PARAMS]:", JSON.stringify(data, null, 2));

        // check if transcode type is none. (proxy file spec - mp4 2 mb h264)
        if ((codec === VIDEO_CODEC || codec === VIDEO_CODEC_ISOM) && format === VIDEO_FORMAT && mbyte <= VIDEO_BITRATE_MB) {
            return "none";
        }

        // check if transcode type is short or long
        var normalPlayTime = video.normalPlayTime;
        var hour = normalPlayTime.match(/(\d*)H/);
        var min = normalPlayTime.match(/(\d*)M/);
        var sec = normalPlayTime.match(/(\d*.\d*)S/);
        var totalSeconds = calcSeconds((hour != null) ? parseInt(hour[1]) : 0, (min != null) ? parseInt(min[1]) : 0, parseFloat(sec[1]));
        logger.info("[Total Seconds]:", totalSeconds);

        if (totalSeconds <= ThresholdSeconds) {
            return "short";
        } else {
            return "long";
        }
    } catch (error) {
        logger.error("Failed to decide trancode requirements");
        logger.error(error.toString());
        throw new McmaException("Failed to decide trancode requirements", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
