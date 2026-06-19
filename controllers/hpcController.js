
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
    // FIXED: Count ALL jobs currently tracked by slurm (both Pending 'PD' and Running 'R')
    const totalQueueCount = await runCommand('squeue -h | wc -l');
    const cpuLoad = await runCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'");

    // Get PER-NODE Stats
    const nodeDataRaw = await runCommand('sinfo -h -N -o "%N|%t|%m"');
    
    let trueIdleCount = 0; // Guard tracking variable

    const nodeDetails = nodeDataRaw.trim().split('\n').filter(line => line).map(line => {
        const [name, state, mem] = line.split('|');
        const cleanState = state.trim();

        // FIXED: Count the node ONLY if it's completely 'idle' (ignores down*, drained, alloc)
        if (cleanState === 'idle') {
            trueIdleCount++;
        }

        const isBusy = cleanState.includes('alloc') || cleanState.includes('mix');
        return {
            id: name.trim(),
            status: cleanState,
            cpu: isBusy ? Math.floor(Math.random() * 20) + 70 : Math.floor(Math.random() * 5),
            mem: isBusy ? 60 : 10
        };
    });

    res.status(200).json({
        // FIXED: We pass 'trueIdleCount' here so user dashboards see the real, ready capacity!
        nodes: trueIdleCount, 
        jobs: totalQueueCount.trim().padStart(2, '0'), // Accurately reflects 1
        cpu: `${parseFloat(cpuLoad || 0).toFixed(1)}%`,
        nodeDetails: nodeDetails // Admin pages still get the full array unchanged!
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
sleep 10
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
    const stdout = await runCommand('squeue -o "%i|%j|%t|%M|%R" --noheader');
    
    if (stdout === null || stdout === undefined) {
        return next(new AppError('Unable to fetch queue from SLURM', 500));
    }

    const jobs = stdout.trim().split('\n').filter(line => line).map(line => {
        const [id, name, state, time, node] = line.split('|');
        const rawState = state?.trim().toUpperCase();

        // Normalizing Slurm abbreviations to map with your frontend table expectations cleanly
        let displayStatus = 'QUEUED';
        if (['R', 'RUNNING'].includes(rawState)) displayStatus = 'RUNNING';
        if (['PD', 'PENDING'].includes(rawState)) displayStatus = 'QUEUED';

        return { 
            id: id?.trim(), 
            name: name?.trim(), 
            // Setting 'status' & 'state' flags concurrently to prevent component parsing drops
            status: displayStatus,
            state: displayStatus, 
            time: time?.trim(), 
            node: node?.trim() === 'None' || !node ? 'Pending Allocation' : node?.trim()
        };
    });

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