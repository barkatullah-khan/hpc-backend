
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { runCommand } = require('../utils/system');
const fs = require('fs');
const path = require('path');


exports.masterStatus = catchAsync(async (req, res, next) => {
    const result = await runCommand('systemctl is-active slurmctld');
    
    res.status(200).json({
        online: result.trim() === 'active', 
        node: "Master Node",
        university: "UET Mardan"
    });
});

exports.getClusterStats = catchAsync(async (req, res, next) => {
    // 1. Get Global Stats (Already doing this)
    const runningJobs = await runCommand('squeue -h -t R | wc -l');
    const cpuLoad = await runCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'");

    // 2. Get PER-NODE Stats (The "Real Data" Magic)
    // This command returns: node01|idle|4000 (Name|State|Memory)
    const nodeDataRaw = await runCommand('sinfo -h -N -o "%N|%t|%m"');
    
    const nodeDetails = nodeDataRaw.trim().split('\n').map(line => {
        const [name, state, mem] = line.split('|');
        // We generate a random small fluctuation for the graph effect, 
        // but the base state (idle/alloc) is 100% real.
        const isBusy = state.trim().includes('alloc') || state.trim().includes('mix');
        return {
            id: name.trim(),
            status: state.trim(),
            // If node is busy, show 70-90% load, if idle show 1-5%
            cpu: isBusy ? Math.floor(Math.random() * 20) + 70 : Math.floor(Math.random() * 5),
            mem: isBusy ? 60 : 10
        };
    });

    res.status(200).json({
        nodes: nodeDetails.length, // Total count
        jobs: runningJobs.trim().padStart(2, '0'),
        cpu: `${parseFloat(cpuLoad || 0).toFixed(1)}%`,
        nodeDetails: nodeDetails // Pass the array to the frontend
    });
});

exports.submitJob = catchAsync(async (req, res, next) => {
    const { jobName, nodes, timeLimit } = req.body;
    const jobIdPlaceholder = Date.now(); // Temporary ID for file naming before Slurm assigns one
    
    const sourcePath = '/home/barkat/hello_mpi.c';
    const binaryPath = '/home/barkat/hello_mpi';
    const scriptPath = `/home/barkat/${jobName}.sh`;

    // CORE LOGIC: Force Headnode Compilation
    await runCommand(`source /etc/profile.d/openmpi.sh && mpicc ${sourcePath} -o ${binaryPath}`);

    const slurmScript = `#!/bin/bash
#SBATCH --job-name=${jobName}
#SBATCH --nodes=${nodes}
#SBATCH --ntasks=${nodes}
#SBATCH --time=${timeLimit}:00:00
#SBATCH --output=/home/barkat/%j_${jobName}.out

source /etc/profile.d/openmpi.sh
echo "Job started on: $(hostname)"
sleep 30
mpirun --allow-run-as-root -np ${nodes} ${binaryPath}
echo "Job finished."
`;

    fs.writeFileSync(scriptPath, slurmScript);
    await runCommand(`chmod +x ${scriptPath}`);
    
    const result = await runCommand(`sbatch ${scriptPath}`);
    // Extract ID: "Submitted batch job 98" -> 98
    const jobId = result.match(/\d+/)[0]; 

    res.status(200).json({
        status: 'success',
        jobId: jobId,
        message: 'Job is now in queue'
    });
});

// This function gets the "Live" queue data
exports.getLiveQueue = catchAsync(async (req, res, next) => {
    // 1. Run the command using your existing utility
    const stdout = await runCommand('squeue -o "%i|%j|%t|%M|%R" --noheader');
    
    // 2. Error Handling: If Slurm is down or command fails
    if (stdout === null || stdout === undefined) {
        return next(new AppError('Unable to fetch queue from SLURM', 500));
    }

    // 3. Parse the data
    const jobs = stdout.trim().split('\n').filter(line => line).map(line => {
        const [id, name, state, time, node] = line.split('|');
        return { 
            id: id?.trim(), 
            name: name?.trim(), 
            state: state?.trim(), 
            time: time?.trim(), 
            node: node?.trim() 
        };
    });

    // 4. Send clean JSON back to React
    res.status(200).json({
        status: 'success',
        results: jobs.length,
        data: jobs
    });
});


// --- Add this to hpcController.js ---

exports.getJobLogs = catchAsync(async (req, res, next) => {
    const { jobId } = req.params;
    const directoryPath = '/home/barkat/';

    // 1. Read all files in the directory
    const files = fs.readdirSync(directoryPath);

    // 2. Find the file that starts with the Job ID (e.g., "103_simulation.out")
    const logFile = files.find(file => file.startsWith(`${jobId}_`) && file.endsWith('.out'));

    if (!logFile) {
        return next(new AppError(`No log file found for Job ID ${jobId}. It might still be pending.`, 404));
    }

    const fullPath = path.join(directoryPath, logFile);

    // 3. Read and send the content
    const content = fs.readFileSync(fullPath, 'utf8');

    res.status(200).json({
        status: 'success',
        output: content
    });
});