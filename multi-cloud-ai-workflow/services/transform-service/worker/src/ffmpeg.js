const path = require("path");

const childProcess = require("child_process");
const execFile = util.promisify(childProcess.execFile);

// adding bin folder to process path
process.env["PATH"] = process.env["PATH"] + ":" + process.env["LambdaTaskRoot"] + "/bin";

const ffmpeg = async (params) => {
    try {
        const { stdout, stderr } = await execFile(path.join(__dirname, "bin/ffmpeg"), params);

        return {
            stdout: stdout,
            stderr: stderr
        }
    } catch (error) {
        console.log("ERROR FFMPEG", error);
    }
};

module.exports = {
    ffmpeg
};