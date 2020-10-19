import { v4 as uuidv4 } from "uuid";
import * as AWS from "aws-sdk";
import { EnvironmentVariables, McmaException, ProblemDetail } from "@mcma/core";
import { getTableName } from "@mcma/data";
import { ProcessJobAssignmentHelper, ProviderCollection, WorkerRequest } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";
import { PromiseResult } from "aws-sdk/lib/request";

const S3 = new AWS.S3();
const Rekognition = new AWS.Rekognition();
const environmentVariables = EnvironmentVariables.getInstance();

export async function processRekognitionResult(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        await providers.dbTableProvider.get(getTableName(environmentVariables)),
        providers.resourceManagerProvider.get(environmentVariables),
        workerRequest
    );

    const logger = jobAssignmentHelper.logger;

    try {
        await jobAssignmentHelper.initialize();

        // 2. Retrieve job inputParameters
        const jobInput = jobAssignmentHelper.jobInput;

        const rekoJobId = workerRequest.input.jobInfo.rekoJobId;
        const rekoJobType = workerRequest.input.jobInfo.rekoJobType;
        const status = workerRequest.input.jobInfo.status;

        if (status !== "SUCCEEDED") {
            throw new McmaException("AI Rekognition failed job info: rekognition status:" + status);
        }

        // 3. Get the result from the Rekognition service
        let data: any[] = [];
        let dataCelebrity: PromiseResult<AWS.Rekognition.GetCelebrityRecognitionResponse, AWS.AWSError>;
        let dataFace: PromiseResult<AWS.Rekognition.GetFaceDetectionResponse, AWS.AWSError>;
        let dataNextToken;
        switch (rekoJobType) {
            case "StartCelebrityRecognition":
                dataCelebrity = await Rekognition.getCelebrityRecognition({
                    JobId: rekoJobId,
                    SortBy: "TIMESTAMP"
                }).promise();
                data = data.concat(dataCelebrity.Celebrities);
                let count = 0;
                while (dataCelebrity["Celebrities"].length === 1000) {
                    dataNextToken = dataCelebrity["NextToken"];
                    dataCelebrity = await Rekognition.getCelebrityRecognition({
                        JobId: rekoJobId,
                        SortBy: "TIMESTAMP",
                        NextToken: dataNextToken
                    }).promise();
                    if (count < 1) {
                        data = data.concat(dataCelebrity.Celebrities);
                        count++;
                    }
                }
                break;
            case "StartFaceDetection":
                dataFace = await Rekognition.getFaceDetection({
                    JobId: rekoJobId,
                }).promise();
                data = data.concat(dataFace.Faces);
                let count2 = 0;
                while (dataFace["Faces"].length === 1000) {
                    dataNextToken = dataFace["NextToken"];
                    dataFace = await Rekognition.getFaceDetection({
                        JobId: rekoJobId,
                        NextToken: dataNextToken
                    }).promise();
                    if (count2 < 1) {
                        data = data.concat(dataFace.Faces);
                        count2++;
                    }
                }
                break;
            case "StartLabelDetection":
            case "StartContentModeration":
            case "StartPersonTracking":
            case "StartFaceSearch":
                throw new McmaException(rekoJobType + " : Not implemented");
            default:
                throw new McmaException("Unknown rekoJobType");
        }

        if (!data) {
            throw new McmaException("No data was returned by AWS Rekogntion");
        }

        // Logger.debug("data returned by Rekognition", JSON.stringify(data, null, 2));

        // AWS Reko may create empty json element - remove them
        walkclean(data);

        // 3. write Reko output file to output location
        const s3Bucket = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation").bucket;

        let videoFileName = jobInput.get<AwsS3FileLocatorProperties>("inputFile").key;
        videoFileName = videoFileName.replace(".mp4", "").replace("media/", "");
        const newS3Key = "reko_" + "media_" + videoFileName + "_" + rekoJobType + "_" + uuidv4() + ".json";

        const s3Params = {
            Bucket: s3Bucket,
            Key: newS3Key,
            Body: JSON.stringify(data)
        };

        try {
            await S3.putObject(s3Params).promise();
        } catch (error) {
            throw new McmaException("Unable to write output file to bucket '" + s3Bucket + "' with key '" + newS3Key + "' due to error: " + error.message);
        }

        logger.debug("Wrote Reko result file to S3 bucket : " + s3Bucket + " S3 key : " + newS3Key);

        jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
            bucket: s3Bucket,
            key: newS3Key
        }));

        await jobAssignmentHelper.complete();
    } catch (error) {
        logger.error(error.toString());
        try {
            await jobAssignmentHelper.fail(new ProblemDetail({
                type: "uri://mcma.ebu.ch/rfc7807/aws-ai-service/generic-failure",
                title: "Generic failure",
                detail: error.message
            }));
        } catch (error) {
            logger.error(error.toString());
        }
    }
}

function walkclean(x: any) {
    let type: string = typeof x;
    if (x instanceof Array) {
        type = "array";
    }
    if ((type === "array") || (type === "object")) {
        for (let k in x) {
            if (x.hasOwnProperty(k)) {
                const v = x[k];
                if ((v === "") && (type === "object")) {
                    delete x[k];
                } else {
                    walkclean(v);
                }
            }
        }
    }
}
