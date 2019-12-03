const util = require("util");
const path = require("path");
const childProcess = require("child_process");
const execFile = util.promisify(childProcess.execFile);

async function mediaInfo(params) {
    try {
        const { stdout, stderr } = await execFile(path.join(__dirname, "bin/mediainfo"), params);
        return { stdout, stderr };
    } catch (error) {
        console.log("ERROR MEDIAINFO", error);
    }
}

module.exports = {
    mediaInfo
};
