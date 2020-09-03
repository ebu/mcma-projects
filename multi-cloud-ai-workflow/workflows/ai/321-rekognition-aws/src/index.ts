import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";
import { BMContent } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-321-rekognition-aws", process.env.LogGroupName);

type InputEvent = {
    input: {
        bmContent: string;
    },
    data: {
        awsRekognition: {
            "0": {
                data: {
                    awsCelebritiesJobId: string[];
                };
            };
            "1": {
                data: {
                    awsEmotionsJobId: string[];
                };
            };
        }
    }
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
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }
        // awsCelebrities
        let awsCelebritiesJobId = event.data.awsRekognition["0"].data.awsCelebritiesJobId.find(id => id);
        if (!awsCelebritiesJobId) {
            throw new McmaException("Failed to obtain awsCelebritiesJobId");
        }
        let awsCelebritiesJob = await resourceManager.get<Job>(awsCelebritiesJobId);
        let awsCelebritiesJobOutput = new JobParameterBag(awsCelebritiesJob.jobOutput);
        let awsCelebritiesOutputFile = awsCelebritiesJobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        let awsCelebritiesS3Bucket = awsCelebritiesOutputFile.bucket;
        let awsCelebritiesS3Key = awsCelebritiesOutputFile.key;
        let awsCelebritiesJobS3Object;
        try {
            awsCelebritiesJobS3Object = await S3.getObject({
                Bucket: awsCelebritiesS3Bucket,
                Key: awsCelebritiesS3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to load celebrities info file in bucket '" + awsCelebritiesS3Bucket + "' with key '" + awsCelebritiesS3Key + "' due to error: " + error.message);
        }
        let celebritiesResult = JSON.parse(awsCelebritiesJobS3Object.Body.toString());
        // awsEmotions
        let awsEmotionsJobId = event.data.awsRekognition["1"].data.awsEmotionsJobId.find(id => id);
        if (!awsEmotionsJobId) {
            throw new McmaException("Failed to obtain awsEmotionsJobId");
        }
        let awsEmotionsJob = await resourceManager.get<Job>(awsEmotionsJobId);
        let awsEmotionsJobOutput = new JobParameterBag(awsEmotionsJob.jobOutput);
        let awsEmotionsOutputFile = awsEmotionsJobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        let awsEmotionsS3Bucket = awsEmotionsOutputFile.bucket;
        let awsEmotionsS3Key = awsEmotionsOutputFile.key;
        let awsEmotionsJobS3Object;
        try {
            awsEmotionsJobS3Object = await S3.getObject({
                Bucket: awsEmotionsS3Bucket,
                Key: awsEmotionsS3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to load emotions info file in bucket '" + awsEmotionsS3Bucket + "' with key '" + awsEmotionsS3Key + "' due to error: " + error.message);
        }
        let emotionsResult = JSON.parse(awsEmotionsJobS3Object.Body.toString());
        let celebritiesEmotionsScores = createCelebritiesEmotionsScores(celebritiesResult, emotionsResult);
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);
        if (!bmContent.awsAiMetadata) {
            bmContent.awsAiMetadata = {};
        }
        bmContent.awsAiMetadata.celebritiesEmotions = celebritiesEmotionsScores;
        await resourceManager.update(bmContent);

    } catch (error) {
        logger.error("Failed to do rekognition AWS");
        logger.error(error.toString());
        throw new McmaException("Failed to do rekognition AWS", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}


function createCelebritiesEmotionsScores(celebrityRecognitionJSON: any, faceRecognitionJSON: any) {
    if ((celebrityRecognitionJSON !== undefined) && (faceRecognitionJSON !== undefined)) {
        let celebritiesAndFacesList = flattenFiles(celebrityRecognitionJSON, faceRecognitionJSON);
        let celebritiesList = createCelebritiesList(celebritiesAndFacesList);
        let emotionsList = createFacesList(celebritiesAndFacesList);
        return genScoreCelebrity(celebritiesAndFacesList, celebritiesList, emotionsList);
    }
}

function genScoreCelebrity(celebrities_faces_list: any[], celebritiesList: any[], emotionsList: any[]) {
    let celebrityScore: any = {};
    for (let celebrityItem of celebritiesList) {
        let celebrityEmotions: any = {};
        for (let emotionItem of emotionsList) {
            celebrityEmotions[emotionItem] = 0;
            celebrityEmotions["counter"] = 0;
        }
        celebrityScore[celebrityItem] = celebrityEmotions;
    }
    for (let nameItem of celebritiesList) {
        for (let celebrities_faces_listItem of celebrities_faces_list) {
            if (nameItem === celebrities_faces_listItem.Celebrity.Name) {
                if ("Emotions" in celebrities_faces_listItem.FaceReko) {
                    celebrityScore[nameItem]["counter"] += 1;
                    let celebritiesEmotions = celebrities_faces_listItem.FaceReko.Emotions;
                    for (let celebritiesEmotionsItem of celebritiesEmotions) {
                        celebrityScore[nameItem][celebritiesEmotionsItem["Type"]] += celebritiesEmotionsItem["Confidence"];
                    }
                }
            }
        }
    }
    for (let celebrityItem of celebritiesList) {
        let counter = celebrityScore[celebrityItem]["counter"];
        let emotions = celebrityScore[celebrityItem];
        celebrityScore[celebrityItem]["counter"] = counter;
        if (counter === 0) {
            for (let emotionItem in emotions) {
                celebrityScore[celebrityItem][emotionItem] = 0;
            }
        } else {
            for (let emotionItem in emotions) {
                celebrityScore[celebrityItem][emotionItem] = celebrityScore[celebrityItem][emotionItem] / counter;
            }
        }
        celebrityScore[celebrityItem]["counter"] = counter;
    }
    return celebrityScore;
}

function createCelebritiesList(celebritiesAndFacesList: any[]) {
    let celebritiesList: any[] = [];
    for (let celebritiesAndFacesItem of celebritiesAndFacesList) {
        let celebrityName = celebritiesAndFacesItem.Celebrity.Name;
        if (!celebritiesList.includes(celebrityName)) {
            celebritiesList.push(celebrityName);
        }
    }
    return celebritiesList;
}

function createFacesList(celebritiesAndFacesList: any[]) {
    let emotionsList: any[] = [];
    for (let celebritiesAndFacesItem of celebritiesAndFacesList) {
        let faceReko = celebritiesAndFacesItem.FaceReko;
        if (faceReko.Emotions) {
            let faceRekoEmotions = faceReko.Emotions;
            for (let faceRekoEmotionsItem of faceRekoEmotions) {
                if (!emotionsList.includes(faceRekoEmotionsItem.Type)) {
                    emotionsList.push(faceRekoEmotionsItem.Type);
                }
            }
        }
    }
    return emotionsList;
}

function flattenFiles(celebrityRecognitionJSON: any, faceRecognitionJSON: any) {
    let celebritiesList = [];
    let facesList = [];
    for (let i = 0; i < celebrityRecognitionJSON.length; i++) {
        console.log(celebrityRecognitionJSON[i]);
        let celebrity = celebrityRecognitionJSON[i];
        let celebrityTemp: any = {};
        celebrityTemp["Timestamp"] = celebrity.Timestamp;
        celebrityTemp["Celebrity"] = celebrity.Celebrity;
        celebritiesList.push(celebrityTemp);
    }
    for (let i = 0; i < faceRecognitionJSON.length; i++) {
        let face = faceRecognitionJSON[i];
        let faceTemp: any = {};
        faceTemp["Timestamp"] = face.Timestamp;
        let faceTempFace = face.Face;
        delete faceTempFace["Pose"];
        delete faceTempFace["Quality"];
        faceTemp["Face"] = faceTempFace;
        facesList.push(faceTemp);
    }
    return mergeFacesAndCelebrities(celebritiesList, facesList);
}

function mergeFacesAndCelebrities(celebritiesList: any[], facesList: any[], threshold = 5) {
    let facesIndexes = [];
    let facesScores = [];
    for (const [celebrityIndex, celebrityValue] of celebritiesList.entries()) {
        let boundingBoxCelebrity = [];
        let celebrityX;
        let celebrityY;
        if (celebrityValue.Celebrity.Face) {
            boundingBoxCelebrity = [
                celebrityValue.Celebrity.Face.BoundingBox.Left,
                celebrityValue.Celebrity.Face.BoundingBox.Top,
                celebrityValue.Celebrity.Face.BoundingBox.Left + celebrityValue.Celebrity.Face.BoundingBox.Width,
                celebrityValue.Celebrity.Face.BoundingBox.Top + celebrityValue.Celebrity.Face.BoundingBox.Height,
            ];
            let celebrityLandmarks = celebrityValue.Celebrity.Face.Landmarks;
            let celebrityLeftEyeCoordinates = getLeftEyeCoordinates(celebrityLandmarks);
            celebrityX = celebrityLeftEyeCoordinates.x;
            celebrityY = celebrityLeftEyeCoordinates.y;
        } else {
            boundingBoxCelebrity = [
                celebrityValue.Celebrity.BoundingBox.Left,
                celebrityValue.Celebrity.BoundingBox.Top,
                celebrityValue.Celebrity.BoundingBox.Left + celebrityValue.Celebrity.BoundingBox.Width,
                celebrityValue.Celebrity.BoundingBox.Top + celebrityValue.Celebrity.BoundingBox.Height,
            ];
        }
        let facesScoresArray = [];
        let facesIndexesArray = [];
        let lefteyeScoreArray = [];
        for (const [faceIndex, faceValue] of facesList.entries()) {
            let boundingBoxFace = [
                faceValue.Face.BoundingBox.Left,
                faceValue.Face.BoundingBox.Top,
                faceValue.Face.BoundingBox.Left + faceValue.Face.BoundingBox.Width,
                faceValue.Face.BoundingBox.Top + faceValue.Face.BoundingBox.Height,
            ];
            let boundingBoxesArea = faceValue.Face.BoundingBox.Width * faceValue.Face.BoundingBox.Height;
            let distance = celebrityValue.Timestamp - faceValue.Timestamp;
            let faceLeftEyeCoordinates = getLeftEyeCoordinates(faceValue.Face.Landmarks);
            let faceX = faceLeftEyeCoordinates.x;
            let faceY = faceLeftEyeCoordinates.y;
            let faceScore = -1;
            let lefteyeScore = 1;
            if (Math.abs(distance) < 1000) {
                if (Math.abs(distance) > 1) {
                    faceScore = getIntersectionRatio(boundingBoxFace, boundingBoxCelebrity, 1e-5);
                } else {
                    faceScore = getIntersectionRatio(boundingBoxFace, boundingBoxCelebrity, 1e-5) * 10;
                }
                if ((celebrityX !== undefined) && (faceX !== undefined) && (celebrityY !== undefined) && (faceY !== undefined)) {
                    lefteyeScore = Math.sqrt((celebrityX - faceX) ** 2 + (celebrityY - faceY) ** 2) / Math.sqrt(boundingBoxesArea);
                }
            }
            if (faceScore > 0) {
                facesScoresArray.push(faceScore);
                lefteyeScoreArray.push(lefteyeScore);
                facesIndexesArray.push(faceIndex);
            }
        }
        if (facesScoresArray.length > 0) {
            let totalScoreArray = [];
            for (const [index, value] of facesScoresArray.entries()) {
                totalScoreArray.push(value / (lefteyeScoreArray[index] + 0.1));
            }
            let celebrityDetected = argMax(totalScoreArray);
            facesIndexes[celebrityIndex] = facesIndexesArray[celebrityDetected];
            facesScores[celebrityIndex] = totalScoreArray[celebrityDetected];
        }
    }
    let celebritiesAndFacesList = [...celebritiesList];
    for (const [index, value] of celebritiesAndFacesList.entries()) {
        if (facesScores[index] > threshold) {
            let emotionsList = facesList[facesIndexes[index]]["Face"]["Emotions"];
            let sumRatio = 0;
            for (let emotion of emotionsList) {
                sumRatio = sumRatio + emotion["Confidence"];
            }
            let emotionsListNormalized = [];
            for (let emotion of emotionsList) {
                emotion["Confidence"] = emotion["Confidence"] / (sumRatio * 0.01);
                emotionsListNormalized.push(emotion);
            }
            facesList[facesIndexes[index]]["Face"]["Emotions"] = emotionsListNormalized;
            celebritiesAndFacesList[index]["FaceReko"] = facesList[facesIndexes[index]]["Face"];
            celebritiesAndFacesList[index]["FaceReko"]["EmotionScore"] = facesScores[index];
        } else {
            celebritiesAndFacesList[index]["FaceReko"] = {};
            celebritiesAndFacesList[index]["FaceReko"]["EmotionScore"] = facesScores[index];
        }
    }
    return (celebritiesAndFacesList);
}

function argMax(array: any[]) {
    return array.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
}

function getIntersectionRatio(a: number[], b: number[], epsilon = 1e-5) {
    let x1 = Math.max(a[0], b[0]);
    let y1 = Math.max(a[1], b[1]);
    let x2 = Math.min(a[2], b[2]);
    let y2 = Math.min(a[3], b[3]);
    let width = (x2 - x1);
    let height = (y2 - y1);
    if ((width < 0) || (height < 0)) {
        return 0;
    }
    let areaOverlapped = width * height;
    let areaA = (a[2] - a[0]) * (a[3] - a[1]);
    let areaB = (b[2] - b[0]) * (b[3] - b[1]);
    let areaCombined = Math.min(areaA, areaB);
    return Math.abs(areaOverlapped / (areaCombined + epsilon));
}

function getLeftEyeCoordinates(celebrityLandmarks: any[]) {
    let xCoord;
    let yCoord;
    for (let celebrityLandmark of celebrityLandmarks) {
        if (celebrityLandmark.Type === "eyeLeft") {
            xCoord = celebrityLandmark.X;
            yCoord = celebrityLandmark.Y;
        }
    }
    return { x: xCoord, y: yCoord };
}
