import * as util from "util";
import * as path from "path";
import * as childProcess from "child_process";
import { Logger } from "@mcma/core";

const execFile = util.promisify(childProcess.execFile);

export async function ffmpeg(logger: Logger, params: string[]) {
    try {
        return await execFile(path.join(__dirname, "bin/ffmpeg"), params);
    } catch (error) {
        logger.error("Failed to run FFmpeg", error);
        throw error;
    }
}
