const { exec } = require('child_process');

/**
 * Global function to run Linux commands safely
 * @param {string} cmd - The command to run (e.g., 'sinfo')
 * @returns {Promise<string>} - The output of the command
 */
const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                // Return stdout anyway because 'systemctl' returns an error code if service is stopped
                resolve(stdout ? stdout.trim() : 'error');
            } else {
                resolve(stdout.trim());
            }
        });
    });
};

module.exports = { runCommand };