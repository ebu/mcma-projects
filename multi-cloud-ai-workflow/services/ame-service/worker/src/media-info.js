const util = require("util");
const path = require("path");
const childProcess = require("child_process");
const execFile = util.promisify(childProcess.execFile);

const { Logger } = require("mcma-core");

const mediaInfo = async (params) => {
    try {
        const { stdout, stderr } = await execFile(path.join(__dirname, "bin/mediainfo"), params);
        return { stdout, stderr };
    } catch (error) {
        Logger.error("ERROR MEDIAINFO", error);
    }
}

module.exports = {
    mediaInfo
};