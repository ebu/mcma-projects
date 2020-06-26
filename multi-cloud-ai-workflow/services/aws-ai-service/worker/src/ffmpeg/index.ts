import * as util from "util";
import * as childProcess from "child_process";
import { McmaException } from "@mcma/core";

const execFile = util.promisify(childProcess.execFile);

export async function ffmpeg(params: string[]) {
    try {
        const { stdout, stderr } = await execFile("/opt/bin/ffmpeg", params);

        return {
            stdout: stdout,
            stderr: stderr
        };
    } catch (error) {
        console.log("ERROR FFMPEG", error);
        throw new McmaException("Failed to execute ffmpeg", error);
    }
}
