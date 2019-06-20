function transcribeAudio() {
    throw new Error("Profile '" + transcribeAudio.profileName + "' has not been implemented.");
}

transcribeAudio.profileName = "AzureTranscribeAudio";

module.exports = {
    transcribeAudio
};