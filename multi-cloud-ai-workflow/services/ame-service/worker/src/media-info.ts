import * as util from "util";
import * as childProcess from "child_process";
import { McmaException } from "@mcma/core";

const execFile = util.promisify(childProcess.execFile);

export async function mediaInfo(params: string[]) {

    try {
        const { stdout, stderr } = await execFile("/opt/bin/mediainfo", params);
        return { stdout, stderr };
    } catch (error) {
        console.log("ERROR MEDIAINFO", error);
        throw new McmaException("Failed to run media info", error);
    }
}
