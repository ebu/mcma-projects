import * as util from "util";
import * as childProcess from "child_process";

const execFile = util.promisify(childProcess.execFile);

let hostRootDir = "";

export function setHostRootDir(value: string): void {
    hostRootDir = value || "";
    if (hostRootDir.length && hostRootDir[hostRootDir.length - 1] !== "/") {
        hostRootDir += "/";
    }
    hostRootDir = hostRootDir.replace(/\\/g, "/");
}

export async function ffmpeg(logger, params) {
    try {
        const { stdout, stderr } = await execFile(hostRootDir + "exe/ffmpeg.exe", params);

        return {
            stdout: stdout,
            stderr: stderr
        };
    } catch (error) {
        console.log("ERROR FFMPEG", error);
    }
}
