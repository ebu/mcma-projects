import * as util from "util";
import * as childProcess from "child_process";

const execFile = util.promisify(childProcess.execFile);

export async function ffmpeg(params) {
    try {
        const { stdout, stderr } = await execFile("/opt/bin/ffmpeg", params);

        return {
            stdout: stdout,
            stderr: stderr
        };
    } catch (error) {
        console.log("ERROR FFMPEG", error);
    }
}
