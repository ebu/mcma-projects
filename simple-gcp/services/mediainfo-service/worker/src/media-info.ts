import * as util from "util";
import * as path from "path";
import * as childProcess from "child_process";
import { Logger } from "@mcma/core";

const execFile = util.promisify(childProcess.execFile);

export async function mediaInfo(logger: Logger, params: string[]) {
    try {
        return await execFile(path.join(__dirname, "bin/mediainfo"), params);
    } catch (error) {
        logger.error("Failed to run MediaInfo", error);
        throw error;
    }
}
