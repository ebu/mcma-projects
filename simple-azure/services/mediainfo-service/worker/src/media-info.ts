import * as util from "util";
import * as childProcess from "child_process";
import { Logger } from "@mcma/core";

const execFile = util.promisify(childProcess.execFile);

let hostRootDir = "";

export function setHostRootDir(value: string): void {
    hostRootDir = value || "";
    if (hostRootDir.length && hostRootDir[hostRootDir.length - 1] !== "/") {
        hostRootDir += "/";
    }
    hostRootDir = hostRootDir.replace(/\\/g, "/");
}

export async function mediaInfo(logger: Logger, params: string[]) {
    try {
        const { stdout, stderr } = await execFile(hostRootDir + "exe/MediaInfo.exe", params);
        return { stdout, stderr };
    } catch (error) {
        logger.error("ERROR MEDIAINFO", error);
    }
}
