import * as util from "util";
import * as childProcess from "child_process";

const execFile = util.promisify(childProcess.execFile);

export async function mediaInfo(params: string[]) {
    try {
        const { stdout, stderr } = await execFile("/opt/bin/mediainfo", params);
        return { stdout, stderr };
    } catch (error) {
        console.log("ERROR MEDIAINFO", error);
    }
}
