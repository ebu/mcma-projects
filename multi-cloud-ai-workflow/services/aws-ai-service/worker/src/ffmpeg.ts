import * as path from "path";
import * as util from "util";

import * as childProcess from "child_process";

const execFile = util.promisify(childProcess.execFile);

// adding bin folder to process path
process.env["PATH"] = process.env["PATH"] + ":" + process.env["LambdaTaskRoot"] + "/bin";

export async function ffmpeg(params: string[]) {
    try {
        const { stdout, stderr } = await execFile(path.join(__dirname, "bin/ffmpeg"), params);

        return {
            stdout: stdout,
            stderr: stderr
        };
    } catch (error) {
        console.log("ERROR FFMPEG", error);
    }
}
